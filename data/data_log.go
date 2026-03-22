package data

import (
	"context"
	"encoding/json"
	"errors"
	"r3/cache"
	"r3/db"
	"r3/handler"
	"r3/tools"
	"r3/types"
	"slices"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// delete data change logs according to retention settings
func DelLogsBackground() error {
	ctx, ctxCanc := context.WithTimeout(context.Background(), db.CtxDefTimeoutDbTask)
	defer ctxCanc()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	cache.Schema_mx.RLock()
	defer cache.Schema_mx.RUnlock()

	for _, r := range cache.RelationIdMap {

		// delete logs for relations with no retention
		if !r.RetentionCount.Valid && !r.RetentionDays.Valid {

			if _, err := tx.Exec(ctx, `
				DELETE FROM instance.data_log
				WHERE id IN (
					SELECT data_log_id
					FROM instance.data_log_value
					WHERE attribute_id IN (
						SELECT id
						FROM app.attribute
						WHERE relation_id = $1
					)
				)
			`, r.Id); err != nil {
				return err
			}
			continue
		}

		// delete logs according to retention settings
		now := tools.GetTimeUnix()

		if _, err := tx.Exec(ctx, `
			DELETE FROM instance.data_log AS p
			WHERE p.relation_id = $1
			
			-- exclude retained change logs per record by count
			AND p.id NOT IN (
				SELECT id
				FROM instance.data_log
				WHERE relation_id = p.relation_id
				AND record_id_wofk = p.record_id_wofk
				ORDER BY date_change DESC
				LIMIT $2
			)
			
			-- exclude retained change logs by age
			AND date_change < $3
		`, r.Id, r.RetentionCount.Int32, now-(int64(r.RetentionDays.Int32)*86400)); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// get data change logs for specified record and attributes
func GetLogs_tx(ctx context.Context, tx pgx.Tx, relationId uuid.UUID, attributeIds []uuid.UUID, recordIds []int64, loginId int64) ([]types.DataLog, error) {

	cache.Schema_mx.RLock()
	defer cache.Schema_mx.RUnlock()

	if !authorizedAttributes(loginId, attributeIds, types.AccessRead) {
		return nil, errors.New(handler.ErrUnauthorized)
	}

	rows, err := tx.Query(ctx, `
		SELECT d.id, d.relation_id, d.record_id_wofk, d.date_change, d.comment, COALESCE(lm.name_display, l.name, ''), d.login_id_wofk IS NULL,
			CASE
				WHEN d.comment IS NULL THEN (
					SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
						'attributeId',   attribute_id,
						'attributeIdNm', attribute_id_nm,
						'outsideIn',     outside_in,
						'value',         value
					))
					FROM instance.data_log_value
					WHERE data_log_id  = d.id
					AND   attribute_id = ANY($3)
				)
				ELSE '[]'::JSONB
			END
		FROM instance.data_log as d
		LEFT JOIN instance.login      AS l  ON l.id        = d.login_id_wofk
		LEFT JOIN instance.login_meta AS lm ON lm.login_id = l.id
		WHERE d.relation_id    = $1
		AND   d.record_id_wofk = ANY($2)
		AND (
			d.comment is NOT NULL
			OR d.id IN (
				SELECT data_log_id
				FROM instance.data_log_value
				WHERE attribute_id = ANY($3)
			)
		)
	`, relationId, recordIds, attributeIds)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	logs := make([]types.DataLog, 0)
	for rows.Next() {
		var l types.DataLog
		var valuesJson []byte
		if err := rows.Scan(&l.Id, &l.RelationId, &l.RecordId, &l.DateChange, &l.Comment, &l.LoginName, &l.IsSystem, &valuesJson); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(valuesJson, &l.Attributes); err != nil {
			return nil, err
		}
		logs = append(logs, l)
	}
	return logs, nil
}

// set data change log for specific record that was either created or updated
func setLog_tx(ctx context.Context, tx pgx.Tx, relationId uuid.UUID, attributes []types.DataSetAttribute,
	fileAttributeIndexes []int, wasCreated bool, valuesOld []any, recordId int64, loginId int64) error {

	// new record, apply logs for record and its attribute values
	if wasCreated {
		logId, err := setLogRecord_tx(ctx, tx, relationId, loginId, recordId)
		if err != nil {
			return err
		}
		for _, attribute := range attributes {
			if attribute.Value == nil {
				// ignore null values for new record
				continue
			}
			if err := setLogValue_tx(ctx, tx, logId, attribute); err != nil {
				return err
			}
		}
		return nil
	}

	// existing record, apply log if any attribute values changed
	// compare old to new attribute values
	attributeChangedIndexes := make([]int, 0)
	for i, atr := range attributes {

		// special case: file attributes
		// new value is always delta (file uploaded/removed/etc.), old value is not needed
		if slices.Contains(fileAttributeIndexes, i) {
			if atr.Value == nil {
				continue
			}

			var v types.DataSetFileChanges
			vJson, err := json.Marshal(atr.Value)
			if err != nil {
				return err
			}
			if err := json.Unmarshal(vJson, &v); err != nil {
				return err
			}
			if len(v.FileIdMapChange) != 0 {
				attributeChangedIndexes = append(attributeChangedIndexes, i)
			}
			continue
		}

		// both values are nil, no change
		if valuesOld[i] == nil && atr.Value == nil {
			continue
		}

		// only one value is nil, definite change
		if valuesOld[i] == nil || atr.Value == nil {
			attributeChangedIndexes = append(attributeChangedIndexes, i)
			continue
		}

		// compare JSON representations of old and new values
		jsonOld, err := json.Marshal(valuesOld[i])
		if err != nil {
			return err
		}
		jsonNew, err := json.Marshal(atr.Value)
		if err != nil {
			return err
		}
		if string(jsonOld) != string(jsonNew) {
			attributeChangedIndexes = append(attributeChangedIndexes, i)
		}
	}

	if len(attributeChangedIndexes) == 0 {
		// return if no attribute values changed for existing record
		return nil
	}

	logId, err := setLogRecord_tx(ctx, tx, relationId, loginId, recordId)
	if err != nil {
		return err
	}

	// log value even if null, as a change to null is still a change
	for _, i := range attributeChangedIndexes {
		if err := setLogValue_tx(ctx, tx, logId, attributes[i]); err != nil {
			return err
		}
	}
	return nil
}
func setLogRecord_tx(ctx context.Context, tx pgx.Tx, relationId uuid.UUID, loginId int64, recordId int64) (uuid.UUID, error) {

	logId, err := uuid.NewV4()
	if err != nil {
		return logId, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO instance.data_log (id, relation_id, login_id_wofk, record_id_wofk, date_change)
		VALUES ($1,$2,$3,$4,$5)
	`, logId, relationId, loginId, recordId, tools.GetTimeUnix()); err != nil {
		return logId, err
	}
	return logId, nil
}
func setLogValue_tx(ctx context.Context, tx pgx.Tx, logId uuid.UUID, atr types.DataSetAttribute) error {

	valueJson, err := json.Marshal(atr.Value)
	if err != nil {
		return err
	}

	valueInput := pgtype.Text{
		String: string(valueJson),
		Valid:  true,
	}

	if string(valueJson) == "null" {
		valueInput.Valid = false
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO instance.data_log_value (data_log_id, attribute_id, attribute_id_nm, outside_in, value)
		VALUES ($1,$2,$3,$4,$5)
	`, logId, atr.AttributeId, atr.AttributeIdNm, atr.OutsideIn, valueInput); err != nil {
		return err
	}
	return nil
}
