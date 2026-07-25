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
	dbSyncJobIdMap  = make(map[uuid.UUID]types.DbSyncJob)
)

func Load_tx(ctx context.Context, tx pgx.Tx) error {
	if err := LoadHosts_tx(ctx, tx); err != nil {
		return err
	}
	if err := LoadJobs_tx(ctx, tx); err != nil {
		return err
	}
	return nil
}

func LoadHosts_tx(ctx context.Context, tx pgx.Tx) error {

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
	return nil
}

func LoadJobs_tx(ctx context.Context, tx pgx.Tx) error {

	rows, err := tx.Query(ctx, `
		SELECT id, host_id, relation_id, pg_index_id_lookup, name, comment,
			code_sql, page_limit, job_type, delete_missing, ARRAY(
				SELECT attribute_id
				FROM instance_db_sync.job_attribute
				WHERE job_id = j.id
			)
		FROM instance_db_sync.job AS j
		ORDER BY name ASC
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	access_mx.Lock()
	defer access_mx.Unlock()

	dbSyncJobIdMap = make(map[uuid.UUID]types.DbSyncJob)

	for rows.Next() {
		var j types.DbSyncJob
		if err := rows.Scan(&j.Id, &j.HostId, &j.RelationId, &j.PgIndexIdLookup, &j.Name, &j.Comment,
			&j.CodeSql, &j.PageLimit, &j.JobType, &j.DeleteMissing, &j.AttributeIds); err != nil {

			return err
		}
		dbSyncJobIdMap[j.Id] = j
	}
	return nil
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
func GetHosts() map[uuid.UUID]types.DbSyncHost {
	access_mx.RLock()
	defer access_mx.RUnlock()

	return dbSyncHostIdMap
}

func GetJobs() map[uuid.UUID]types.DbSyncJob {
	access_mx.RLock()
	defer access_mx.RUnlock()

	return dbSyncJobIdMap
}
