package request_dbSync

import (
	"context"
	"fmt"
	"r3/cache"
	"r3/schema"
	"r3/types"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func triggerSendCreateIfNeeded(ctx context.Context, tx pgx.Tx, relationId uuid.UUID, jobType types.DbSyncJobType) error {

	// check if there is already a job for the same relation/job type combination
	var exists bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM instance_db_sync.job_join AS jj
			JOIN instance_db_sync.job      AS j ON j.id = jj.job_id
			WHERE j.active
			AND   j.job_type     =  $1
			AND   jj.relation_id =  $2
			AND   jj.index       =  0
			LIMIT 1
		)
	`, jobType, relationId).Scan(&exists); err != nil {
		return err
	}

	if exists {
		return nil
	}

	// create missing trigger
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

func triggerSendRemoveIfNotNeeded(ctx context.Context, tx pgx.Tx, relationId uuid.UUID, jobType types.DbSyncJobType) error {

	// check if there is another job for the combination of relation/job type that needs this trigger
	var exists bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM instance_db_sync.job_join AS jj
			JOIN instance_db_sync.job      AS j ON j.id = jj.job_id
			WHERE j.active
			AND   j.job_type = $1
			AND   jj.relation_id = $2
			AND   jj.index = 0
			LIMIT 1
		)
	`, jobType, relationId).Scan(&exists); err != nil {
		return err
	}

	if exists {
		return nil
	}

	// delete unnecessary trigger & spooled records
	modName, relName, err := cache.GetRelationDbNames(relationId)
	if err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, fmt.Sprintf(`DROP TRIGGER IF EXISTS "%s" ON "%s"."%s"`,
		schema.GetDbSyncTriggerName(relationId, jobType), modName, relName)); err != nil {

		return err
	}

	if _, err := tx.Exec(ctx, `
		DELETE FROM instance_db_sync.send_spool
		WHERE job_type    = $1
		AND   relation_id = $2
	`, jobType, relationId); err != nil {
		return err
	}
	return nil
}
