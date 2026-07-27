package request

import (
	"context"
	"encoding/json"
	"r3/cache/cache_dbSync"
	"r3/types"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

// DB sync hosts
func DbSyncHostDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {
	var id uuid.UUID
	if err := json.Unmarshal(reqJson, &id); err != nil {
		return nil, err
	}
	_, err := tx.Exec(ctx, `DELETE FROM instance_db_sync.host WHERE id = $1`, id)
	return nil, err
}

func DbSyncHostSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {
	var h types.DbSyncHost
	if err := json.Unmarshal(reqJson, &h); err != nil {
		return nil, err
	}

	err := tx.QueryRow(ctx, `
		INSERT INTO instance_db_sync.host (id, name, comment, db_name,
			db_type, active, address, port, username, password)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		ON CONFLICT (id)
		DO UPDATE SET
			name = $2, comment = $3, db_name = $4, db_type = $5, active = $6,
			address = $7, port = $8, username = $9, password = $10
	`, h.Id, h.Name, h.Comment, h.DbName, h.DbType, h.Active,
		h.Address, h.Port, h.Username, h.Password).Scan(&h.Id)

	return nil, err
}

func DbSyncHostsGet_tx(ctx context.Context, tx pgx.Tx) (any, error) {
	return cache_dbSync.GetHosts(), nil
}

// DB sync jobs
func DbSyncJobDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {
	var id uuid.UUID
	if err := json.Unmarshal(reqJson, &id); err != nil {
		return nil, err
	}
	_, err := tx.Exec(ctx, `DELETE FROM instance_db_sync.job WHERE id = $1`, id)
	return nil, err
}

func DbSyncJobSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {
	var j types.DbSyncJob
	if err := json.Unmarshal(reqJson, &j); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO instance_db_sync.job (id, host_id, relation_id, pg_index_id_lookup,
			name, comment, code_sql, page_limit, job_type, delete_missing)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		ON CONFLICT (id)
		DO UPDATE SET
			host_id = $2, relation_id = $3, pg_index_id_lookup = $4, name = $5, comment = $6,
			code_sql = $7, page_limit = $8, job_type = $9, delete_missing = $10
	`, j.Id, j.HostId, j.RelationId, j.PgIndexIdLookup, j.Name, j.Comment,
		j.CodeSql, j.PageLimit, j.JobType, j.DeleteMissing); err != nil {

		return nil, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO instance_db_sync.job_attribute (job_id, attribute_id)
		SELECT $1, UNNEST($2)
		ON CONFLICT (job_id, attribute_id) DO NOTHING
	`, j.Id, j.AttributeIds); err != nil {
		return nil, err
	}

	if _, err := tx.Exec(ctx, `
		DELETE FROM instance_db_sync.job_attribute
		WHERE job_id = $1
		AND ($2 IS NULL OR attribute_id <> ALL($2))
	`, j.Id, j.AttributeIds); err != nil {
		return nil, err
	}
	return nil, nil
}

func DbSyncJobsGet_tx(ctx context.Context, tx pgx.Tx) (any, error) {
	return cache_dbSync.GetJobs(), nil
}
