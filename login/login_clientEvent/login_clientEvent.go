package login_clientEvent

import (
	"context"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func Del_tx(ctx context.Context, tx pgx.Tx, loginId int64, clientEventId uuid.UUID) error {
	_, err := tx.Exec(ctx, `
		DELETE FROM instance.login_client_event
		WHERE login_id        = $1
		AND   client_event_id = $2
	`, loginId, clientEventId)
	return err
}

func Get_tx(ctx context.Context, tx pgx.Tx, loginId int64) (map[uuid.UUID]types.LoginClientEvent, error) {
	lceIdMap := make(map[uuid.UUID]types.LoginClientEvent)

	rows, err := tx.Query(ctx, `
		SELECT client_event_id, hotkey_modifier1, hotkey_modifier2, hotkey_char
		FROM instance.login_client_event
		WHERE login_id = $1
	`, loginId)
	if err != nil {
		return lceIdMap, err
	}
	defer rows.Close()

	for rows.Next() {
		var ceId uuid.UUID
		var lce types.LoginClientEvent
		if err := rows.Scan(&ceId, &lce.HotkeyModifier1, &lce.HotkeyModifier2, &lce.HotkeyChar); err != nil {
			return lceIdMap, err
		}
		lceIdMap[ceId] = lce
	}
	return lceIdMap, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, loginId int64, clientEventId uuid.UUID, lce types.LoginClientEvent) error {
	exists := false

	if err := tx.QueryRow(ctx, `
	 	SELECT EXISTS(
			SELECT client_event_id
			FROM instance.login_client_event
			WHERE login_id = $1
			AND   client_event_id = $2
		)
	`, loginId, clientEventId).Scan(&exists); err != nil {
		return err
	}

	var err error
	if exists {
		_, err = tx.Exec(ctx, `
			UPDATE instance.login_client_event
			SET hotkey_modifier1 = $1, hotkey_modifier2 = $2, hotkey_char = $3
			WHERE login_id        = $4
			AND   client_event_id = $5
		`, lce.HotkeyModifier1, lce.HotkeyModifier2, lce.HotkeyChar, loginId, clientEventId)
	} else {
		_, err = tx.Exec(ctx, `
			INSERT INTO instance.login_client_event (
				login_id, client_event_id, hotkey_modifier1, hotkey_modifier2, hotkey_char)
			VALUES ($1,$2,$3,$4,$5)
		`, loginId, clientEventId, lce.HotkeyModifier1, lce.HotkeyModifier2, lce.HotkeyChar)
	}
	return err
}
