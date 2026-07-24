package cache_dbSync

import (
	"context"
	"errors"
	"r3/types"
	"sync"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

var (
	access_mx       sync.RWMutex
	dbSyncHostIdMap = make(map[uuid.UUID]types.DbSyncHost)
)

func Load_tx(ctx context.Context, tx pgx.Tx) error {

	rows, err := tx.Query(ctx, `
		SELECT id, name, comment, db_name, db_type, active, address, port, username, password
		FROM instance_db_sync.host
		ORDER BY name ASC
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	access_mx.Lock()
	defer access_mx.Unlock()

	dbSyncHostIdMap = make(map[uuid.UUID]types.DbSyncHost)

	for rows.Next() {
		var h types.DbSyncHost
		if err := rows.Scan(&h.Id, &h.Name, &h.Comment, &h.DbName, &h.DbType,
			&h.Active, &h.Address, &h.Port, &h.Username, &h.Password); err != nil {

			return err
		}
		dbSyncHostIdMap[h.Id] = h
	}
	rows.Close()

	for id, h := range dbSyncHostIdMap {
		h.JobIdMap, err = loadJobs_tx(ctx, tx, id)
		if err != nil {
			return err
		}
		dbSyncHostIdMap[id] = h
	}
	return nil
}

func loadJobs_tx(ctx context.Context, tx pgx.Tx, hostId uuid.UUID) (map[uuid.UUID]types.DbSyncJob, error) {
	jobIdMap := make(map[uuid.UUID]types.DbSyncJob)

	rows, err := tx.Query(ctx, `
		SELECT id, relation_id, pg_index_id_lookup, name, comment,
			code_sql, limit, job_type, delete_missing, ARRAY(
				SELECT attribute_id
				FROM instance_db_sync.host_job
				WHERE host_job_id = j.id
			)
		FROM instance_db_sync.host_job AS j
		WHERE host_id = $1
		ORDER BY name ASC
	`, hostId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var j types.DbSyncJob
		if err := rows.Scan(&j.Id, &j.RelationId, &j.PgIndexIdLookup, &j.Name, &j.Comment,
			&j.CodeSql, &j.PageLimit, &j.JobType, &j.DeleteMissing, &j.AttributeIds); err != nil {

			return nil, err
		}
		jobIdMap[j.Id] = j
	}
	return jobIdMap, nil
}

func GetHostById(id uuid.UUID) (types.DbSyncHost, error) {
	access_mx.RLock()
	defer access_mx.RUnlock()

	h, exists := dbSyncHostIdMap[id]
	if !exists {
		return h, errors.New("unknown DB sync host")
	}
	return h, nil
}

func SetHosts(hostIdMap map[uuid.UUID]types.DbSyncHost) {
	access_mx.Lock()
	defer access_mx.Unlock()

	dbSyncHostIdMap = hostIdMap
}
