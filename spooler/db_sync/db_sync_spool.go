package db_sync

import (
	"context"
	"r3/db"
	"r3/types"

	"github.com/gofrs/uuid/v5"
)

func spoolRecordsDel(jobType types.DbSyncJobType, relationId uuid.UUID, recordIds []int64) error {

	ctx, ctxCanc := context.WithTimeout(context.Background(), db.CtxDefTimeoutDbSync)
	defer ctxCanc()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `
		DELETE FROM instance_db_sync.send_spool
		WHERE job_type       = $1
		AND   relation_id    = $2
		AND   record_id_wofk = ANY($3)
	`, jobType, relationId, recordIds); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func spoolRecordsGet() (map[types.DbSyncJobType]map[uuid.UUID][]int64, error) {

	r := make(map[types.DbSyncJobType]map[uuid.UUID][]int64)

	ctx, ctxCanc := context.WithTimeout(context.Background(), db.CtxDefTimeoutDbSync)
	defer ctxCanc()

	// get spooled records from local DB
	// we execute 3 job types in order: INSERT, UPDATE, DELETE
	// we otherwise do not care about record change timestamps, as they are irrelevant (references stay valid if INSERT->UPDATE->DELETE)
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return r, err
	}
	defer tx.Rollback(ctx)

	rows, err := tx.Query(ctx, `
		SELECT job_type, relation_id, ARRAY_AGG(record_id_wofk)
		FROM instance_db_sync.send_spool
		GROUP BY job_type, relation_id
		ORDER BY job_type = 'SEND_INSERT' DESC, job_type = 'SEND_UPDATE' DESC
	`)
	if err != nil {
		return r, err
	}
	defer rows.Close()

	for rows.Next() {
		var jobType types.DbSyncJobType
		var relationId uuid.UUID
		var recordIds []int64
		if err := rows.Scan(&jobType, &relationId, &recordIds); err != nil {
			return r, err
		}
		if _, exists := r[jobType]; !exists {
			r[jobType] = make(map[uuid.UUID][]int64)
		}
		r[jobType][relationId] = recordIds
	}
	return r, nil
}
