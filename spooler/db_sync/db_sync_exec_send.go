package db_sync

import (
	"context"
	"fmt"
	"r3/cache"
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
			if err := storeJobDateNow(j.Id, "attempt"); err != nil {
				return err
			}
			rows, err := doSendFetch(ctx, j, relationId, rel.AttributeIdPk, recordIds)
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
			if err := storeJobDateNow(j.Id, "success"); err != nil {
				return err
			}
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

func doSendFetch(ctx context.Context, j types.DbSyncJob, relationId, attributeIdPk uuid.UUID, recordIds []int64) ([][]any, error) {

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

func doSendStore(ctx context.Context, j types.DbSyncJob, rows [][]any) error {

	// store records to external DB
	dbExt, err := getExtCon(ctx, j.HostId)
	if err != nil {
		if err == types.ErrHostInactive {
			log.Info(log.ContextDbSync, "skipping job for inactive host")
			return nil
		}
		return err
	}
	defer dbExt.Close()

	tx, err := dbExt.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	stmt, err := tx.PrepareContext(ctx, j.CodeSql)
	if err != nil {
		return err
	}

	for _, values := range rows {
		if _, err := stmt.ExecContext(ctx, values...); err != nil {
			return err
		}
	}
	if err := tx.Commit(); err != nil {
		return err
	}

	log.Info(log.ContextDbSync, fmt.Sprintf("saved %d loaded rows to external DB", len(rows)))
	return nil
}
