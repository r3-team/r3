package data_enc

import (
	"context"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v4"
)

func GetKeys_tx(ctx context.Context, tx pgx.Tx, relationId uuid.UUID,
	recordIds []int64, loginId int64) ([]string, error) {

	encKeys := make([]string, 0)

	if len(recordIds) == 0 {
		return encKeys, nil
	}

	if err := tx.QueryRow(ctx, `
		SELECT ARRAY(
			SELECT k.key_enc
			FROM instance.record_key AS k
			JOIN UNNEST($1::int[])
				WITH ORDINALITY t(record_id_wofk,sort)
				USING (record_id_wofk)
			WHERE k.login_id = $2
			AND k.relation_id = $3
			ORDER BY t.sort
		)
	`, recordIds, loginId, relationId).Scan(&encKeys); err != nil {
		return encKeys, err
	}
	return encKeys, nil
}

func DeleteKeys_tx(ctx context.Context, tx pgx.Tx, relationId uuid.UUID,
	recordId int64, loginIds []int64) error {

	if len(loginIds) == 0 {
		return nil
	}

	_, err := tx.Exec(ctx, `
		DELETE FROM instance.record_key
		WHERE relation_id = $1
		AND record_id_wofk = $2
		AND login_id ANY($3)
	`, relationId, recordId, loginIds)

	return err
}

func StoreKeys_tx(ctx context.Context, tx pgx.Tx, relationId uuid.UUID,
	recordId int64, keys []types.DataSetEncKeys) error {

	if len(keys) == 0 {
		return nil
	}

	if _, err := tx.Prepare(ctx, "store_keys", `
		INSERT INTO instance.record_key (relation_id, record_id_wofk, login_id, key_enc)
		VALUES ($1,$2,$3,$4)
	`); err != nil {
		return err
	}

	for _, k := range keys {
		if _, err := tx.Exec(ctx, "store_keys", relationId, recordId, k.LoginId, k.KeyEnc); err != nil {
			return err
		}
	}
	return nil
}
