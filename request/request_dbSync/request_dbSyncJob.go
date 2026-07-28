package request_dbSync

import (
	"context"
	"encoding/json"
	"fmt"
	"r3/cache"
	"r3/cache/cache_dbSync"
	"r3/schema"
	"r3/types"
	"slices"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// DB sync jobs
func JobDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {
	var id uuid.UUID
	if err := json.Unmarshal(reqJson, &id); err != nil {
		return nil, err
	}
	return nil, jobDeleteById(ctx, tx, id)
}

func JobSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {
	var j types.DbSyncJob
	if err := json.Unmarshal(reqJson, &j); err != nil {
		return nil, err
	}

	// reset invalid inputs based on job type
	if j.JobType != types.DbSyncJobTypeLoad {
		j.DeleteMissing = false
		j.PageLimit = pgtype.Int4{}
		j.PgIndexIdLookup = pgtype.UUID{}
	}

	// cannot update host, relation, or job type
	if _, err := tx.Exec(ctx, `
		INSERT INTO instance_db_sync.job (id, host_id, relation_id, pg_index_id_lookup,
			job_type, interval_seconds, name, comment, code_sql, page_limit, delete_missing, active)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		ON CONFLICT (id)
		DO UPDATE SET
			pg_index_id_lookup = $4, interval_seconds = $6, name = $7, comment = $8,
			code_sql = $9, page_limit = $10, delete_missing = $11, active = $12
	`, j.Id, j.HostId, j.RelationId, j.PgIndexIdLookup, j.JobType, j.IntervalSeconds, j.Name,
		j.Comment, j.CodeSql, j.PageLimit, j.DeleteMissing, j.Active); err != nil {

		return nil, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO instance_db_sync.job_attribute (job_id, attribute_id)
		SELECT $1, UNNEST($2::UUID[])
		ON CONFLICT (job_id, attribute_id) DO NOTHING
	`, j.Id, j.AttributeIds); err != nil {
		return nil, err
	}

	if _, err := tx.Exec(ctx, `
		DELETE FROM instance_db_sync.job_attribute
		WHERE job_id = $1
		AND ($2::UUID[] IS NULL OR attribute_id <> ALL($2::UUID[]))
	`, j.Id, j.AttributeIds); err != nil {
		return nil, err
	}

	// register trigger for SEND jobs for relation/job type combination
	if slices.Contains(types.DbSyncJobTypesSend, j.JobType) {
		if err := triggerSendCreateIfNeeded(ctx, tx, j.RelationId, j.JobType); err != nil {
			return nil, err
		}
	}
	return nil, nil
}

func JobsGet_tx(ctx context.Context, tx pgx.Tx) (any, error) {
	return cache_dbSync.GetJobs(), nil
}

// helpers
func jobDeleteById(ctx context.Context, tx pgx.Tx, id uuid.UUID) error {
	var jobType types.DbSyncJobType
	var relationId uuid.UUID
	if err := tx.QueryRow(ctx, `
		SELECT job_type, relation_id
		FROM instance_db_sync.job
		WHERE id = $1
	`, id).Scan(&jobType, &relationId); err != nil {
		return err
	}

	if slices.Contains(types.DbSyncJobTypesSend, jobType) {
		if err := triggerSendRemoveIfNotNeeded(ctx, tx, id, relationId, jobType); err != nil {
			return err
		}
	}

	_, err := tx.Exec(ctx, `DELETE FROM instance_db_sync.job WHERE id = $1`, id)
	return err
}
func jobsDeleteForHost(ctx context.Context, tx pgx.Tx, hostId uuid.UUID) error {

	rows, err := tx.Query(ctx, `
		SELECT id
		FROM instance_db_sync.job
		WHERE host_id = $1
	`, hostId)
	if err != nil {
		return err
	}
	defer rows.Close()

	jobIds := make([]uuid.UUID, 0)
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return err
		}
		jobIds = append(jobIds, id)
	}
	rows.Close()

	for _, id := range jobIds {
		if err := jobDeleteById(ctx, tx, id); err != nil {
			return err
		}
	}
	return nil
}
func triggerSendCreateIfNeeded(ctx context.Context, tx pgx.Tx, relationId uuid.UUID, jobType types.DbSyncJobType) error {

	// check if there is another job for the same relation/job type combination
	var exists bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM instance_db_sync.job
			WHERE relation_id = $1
			AND   job_type    = $2
			LIMIT 1
		)
	`, relationId, jobType).Scan(&exists); err != nil {
		return err
	}

	if exists {
		return nil
	}

	// no job exists, create trigger
	var triggerEvent string
	var fncEventName string
	switch jobType {
	case types.DbSyncJobTypeSendDelete:
		triggerEvent = "DELETE"
		fncEventName = "delete"
	case types.DbSyncJobTypeSendInsert:
		triggerEvent = "INSERT"
		fncEventName = "insert"
	case types.DbSyncJobTypeSendUpdate:
		triggerEvent = "UPDATE"
		fncEventName = "update"
	default:
		return fmt.Errorf("unknown job type: '%s'", jobType)
	}

	modName, relName, err := cache.GetRelationDbNames(relationId)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, fmt.Sprintf(`
		CREATE TRIGGER "%s" AFTER %s ON "%s"."%s" FOR EACH ROW
		EXECUTE FUNCTION instance_db_sync.trg_record_send_%s('%s');
	`, schema.GetDbSyncTriggerName(relationId, jobType), triggerEvent, modName, relName, fncEventName, relationId))

	return err
}

func triggerSendRemoveIfNotNeeded(ctx context.Context, tx pgx.Tx, jobId uuid.UUID, relationId uuid.UUID, jobType types.DbSyncJobType) error {

	// check if there is another job for the combination of relation/job type that needs this trigger
	var exists bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM instance_db_sync.job
			WHERE id <> $1
			AND (relation_id, job_type) = (
				SELECT relation_id, job_type
				FROM instance_db_sync.job
				WHERE id = $1
			)
			LIMIT 1
		)
	`, jobId).Scan(&exists); err != nil {
		return err
	}

	if exists {
		return nil
	}

	modName, relName, err := cache.GetRelationDbNames(relationId)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, fmt.Sprintf(`DROP TRIGGER IF EXISTS "%s" ON "%s"."%s"`,
		schema.GetDbSyncTriggerName(relationId, jobType), modName, relName))

	return err
}
