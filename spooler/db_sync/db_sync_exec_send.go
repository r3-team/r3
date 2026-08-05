package db_sync

import (
	"context"
	"fmt"
	"r3/cache"
	"r3/cache/cache_dbSync"
	"r3/data"
	"r3/db"
	"r3/log"
	"r3/types"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func doSend(jobs []types.DbSyncJob, jobType types.DbSyncJobType, relationIdMapRecords map[uuid.UUID][]int64) error {

	// SEND changes to external DB(s)
	// if any job fails, we keep all record IDs for job type/relation combination
	//  upside: our spooler does not need to keep track of individual record to job combination success states
	//  downside: successful jobs (if multiple exist for same job type/relation) will be repeated (indempotent SQL is needed)
	for relationId, recordIds := range relationIdMapRecords {

		rel, err := cache.GetRelationById(relationId)
		if err != nil {
			return err
		}

		ctx, ctxCanc := context.WithTimeout(context.Background(), db.CtxDefTimeoutDbSync)
		defer ctxCanc()

		anyFailures := false
		for _, j := range jobs {
			if j.JobType != jobType || len(j.Joins) == 0 || j.Joins[0].RelationId != relationId {
				continue
			}
			storeJobDateAttempt(j.Id, j.Name)

			// fetch local record data based on job type
			var rows [][]any
			if j.JobType == types.DbSyncJobTypeSendDelete {
				rows, err = doSendFetchDeleted(ctx, j, relationId, recordIds)
			} else {
				rows, err = doSendFetchActive(ctx, j, relationId, rel.AttributeIdPk, recordIds)
			}
			if err != nil {
				log.Error(log.ContextDbSync, fmt.Sprintf("failed to execute job '%s'", j.Name), err)
				anyFailures = true
				continue
			}
			if err := doSendStore(ctx, j, rows); err != nil {
				log.Error(log.ContextDbSync, fmt.Sprintf("failed to execute job '%s'", j.Name), err)
				anyFailures = true
				continue
			}
			storeJobDateSuccess(j.Id, j.Name, len(rows))
		}

		// delete spooled records if all jobs were successful
		if !anyFailures {
			if err := spoolRecordsDel(jobType, relationId, recordIds); err != nil {
				return err
			}
		}
	}
	return nil
}

func doSendFetchActive(ctx context.Context, j types.DbSyncJob, relationId, attributeIdPk uuid.UUID, recordIds []int64) ([][]any, error) {

	// fetch record data from local DB
	dataGet := types.DataGet{
		RelationId:  relationId,
		IndexSource: 0,
		Limit:       len(recordIds),
	}
	for _, join := range j.Joins {
		if join.Index == 0 {
			continue
		}
		dataGet.Joins = append(dataGet.Joins, types.DataGetJoin{
			AttributeId: join.AttributeId.Bytes,
			Index:       join.Index,
			IndexFrom:   join.IndexFrom,
			Connector:   join.Connector,
		})
	}
	for _, c := range j.Columns {
		dataGet.Expressions = append(dataGet.Expressions, types.DataGetExpression{
			AttributeId: pgtype.UUID{Bytes: c.AttributeId, Valid: true},
			Index:       c.Index})
	}
	dataGet.Filters = append(dataGet.Filters, types.DataGetFilter{
		Connector: "AND",
		Index:     0,
		Operator:  "= ANY",
		Side0:     types.DataGetFilterSide{AttributeId: pgtype.UUID{Bytes: attributeIdPk, Valid: true}},
		Side1:     types.DataGetFilterSide{Value: recordIds},
	})

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var query string
	results, _, err := data.Get_tx(ctx, tx, dataGet, -1, &query)
	if err != nil {
		return nil, err
	}

	rows := make([][]any, len(results))
	for i, result := range results {
		rows[i] = result.Values
	}

	log.Info(log.ContextDbSync, fmt.Sprintf("loaded %d rows from local DB system", len(rows)))
	return rows, nil
}

func doSendFetchDeleted(ctx context.Context, j types.DbSyncJob, relationId uuid.UUID, recordIds []int64) ([][]any, error) {

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	rows, err := tx.Query(ctx, `
		SELECT record_data_deleted
		FROM instance_db_sync.send_spool
		WHERE job_type       = $1
		AND   relation_id    = $2
		AND   record_id_wofk = ANY($3)
	`, types.DbSyncJobTypeSendDelete, relationId, recordIds)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// lookup attribute names for every job column
	// data field for deleted records contains all OLD values as JSONB, key = attribute name
	columnAtrNames := make([]string, len(j.Columns))
	for i, column := range j.Columns {
		atr, err := cache.GetAttributeById(column.AttributeId)
		if err != nil {
			return nil, err
		}
		columnAtrNames[i] = atr.Name
	}

	resultRows := make([][]any, 0, len(recordIds))
	for rows.Next() {
		var d map[string]any
		if err := rows.Scan(&d); err != nil {
			return nil, err
		}

		values := make([]any, len(columnAtrNames))
		for i, name := range columnAtrNames {

			value, exists := d[name]
			if exists {
				values[i] = value
			} else {
				values[i] = nil
			}
		}
		resultRows = append(resultRows, values)
	}
	return resultRows, nil
}

func doSendStore(ctx context.Context, j types.DbSyncJob, rows [][]any) error {

	if len(rows) == 0 {
		return nil
	}

	// get host details for job
	host, err := cache_dbSync.GetHostById(j.HostId)
	if err != nil {
		return err
	}
	if !host.Active {
		log.Info(log.ContextDbSync, fmt.Sprintf("skipping job '%s' for inactive host '%s'", j.Name, host.Name))
		return nil
	}

	// save records to external DB
	dbExt, err := getExtCon(ctx, host)
	if err != nil {
		return err
	}
	defer dbExt.Close()

	tx, err := dbExt.BeginTx(ctx, nil)
	if err != nil {
		return err
	}

	if host.DbType == types.DbSyncDbTypeClickhouse {
		// clickhouse works differently to regular RDBMS - it´s more like a append-only system for larger sets
		// SQL is supported, but it does not offer all features and execution differs, some aspects:
		//  * prepared statements generally do not provide much of a benefit, UPDATES do not support them outright
		//  * UPDATES are generally slow and should be avoided - to execute one, an ALTER TABLE statement is required (ALTER TABLE X UPDATE Y SET ...)
		//  * a native connector (in constrast to database/sql) is available to execute large INSERT batches (what clickhouse is more built for)
		for _, values := range rows {
			if _, err := tx.ExecContext(ctx, j.CodeSql, values...); err != nil {
				return err
			}
		}
	} else {
		stmt, err := tx.PrepareContext(ctx, j.CodeSql)
		if err != nil {
			return err
		}
		for _, values := range rows {
			if _, err := stmt.ExecContext(ctx, values...); err != nil {
				return err
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	log.Info(log.ContextDbSync, fmt.Sprintf("sent %d row changes to external DB", len(rows)))
	return nil
}
