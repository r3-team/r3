package login_session

import (
	"r3/cache"
	"r3/db"
	"r3/tools"
	"r3/types"

	"github.com/gofrs/uuid"
)

func Log(id uuid.UUID, loginId int64, device types.WebsocketClientDevice) error {
	tx, err := db.Pool.Begin(db.Ctx)
	if err != nil {
		return err
	}

	if _, err := tx.Exec(db.Ctx, `
		INSERT INTO instance.login_session(id, login_id, node_id, device, date)
		VALUES ($1,$2,$3,$4,$5)
	`, id, loginId, cache.GetNodeId(), types.WebsocketClientDeviceNames[device], tools.GetTimeUnix()); err != nil {
		return err
	}
	return tx.Commit(db.Ctx)
}

func LogRemove(id uuid.UUID) error {
	tx, err := db.Pool.Begin(db.Ctx)
	if err != nil {
		return err
	}

	if _, err := tx.Exec(db.Ctx, `
		DELETE FROM instance.login_session
		WHERE id = $1
	`, id); err != nil {
		return err
	}
	return tx.Commit(db.Ctx)
}

func LogsRemoveForNode() error {
	tx, err := db.Pool.Begin(db.Ctx)
	if err != nil {
		return err
	}

	if _, err := tx.Exec(db.Ctx, `
		DELETE FROM instance.login_session
		WHERE node_id = $1
	`, cache.GetNodeId()); err != nil {
		return err
	}
	return tx.Commit(db.Ctx)
}
