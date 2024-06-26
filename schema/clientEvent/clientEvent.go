package clientEvent

import (
	"r3/db"
	"r3/schema"
	"r3/schema/caption"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func Del_tx(tx pgx.Tx, id uuid.UUID) error {
	_, err := tx.Exec(db.Ctx, `DELETE FROM app.client_event WHERE id = $1`, id)
	return err
}

func Get(moduleId uuid.UUID) ([]types.ClientEvent, error) {

	clientEvents := make([]types.ClientEvent, 0)
	rows, err := db.Pool.Query(db.Ctx, `
		SELECT id, action, arguments, event, hotkey_modifier1,
			hotkey_modifier2, hotkey_char, js_function_id
		FROM app.client_event
		WHERE module_id = $1
		ORDER BY id ASC
	`, moduleId)
	if err != nil {
		return clientEvents, err
	}

	for rows.Next() {
		var e types.ClientEvent
		e.ModuleId = moduleId
		if err := rows.Scan(&e.Id, &e.Action, &e.Arguments, &e.Event, &e.HotkeyModifier1,
			&e.HotkeyModifier2, &e.HotkeyChar, &e.JsFunctionId); err != nil {

			return clientEvents, err
		}
		e.Captions, err = caption.Get("client_event", e.Id, []string{"clientEventTitle"})
		if err != nil {
			return clientEvents, err
		}
		clientEvents = append(clientEvents, e)
	}
	rows.Close()

	return clientEvents, nil
}

func Set_tx(tx pgx.Tx, ce types.ClientEvent) error {

	known, err := schema.CheckCreateId_tx(tx, &ce.Id, "client_event", "id")
	if err != nil {
		return err
	}

	if known {
		if _, err := tx.Exec(db.Ctx, `
			UPDATE app.client_event
			SET action = $1, arguments = $2, event = $3, hotkey_modifier1 = $4,
				hotkey_modifier2 = $5, hotkey_char = $6, js_function_id = $7
			WHERE id = $8
		`, ce.Action, ce.Arguments, ce.Event, ce.HotkeyModifier1,
			ce.HotkeyModifier2, ce.HotkeyChar, ce.JsFunctionId, ce.Id); err != nil {

			return err
		}
	} else {
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.client_event (id, module_id, action, arguments, event, hotkey_modifier1,
				hotkey_modifier2, hotkey_char, js_function_id)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		`, ce.Id, ce.ModuleId, ce.Action, ce.Arguments, ce.Event, ce.HotkeyModifier1,
			ce.HotkeyModifier2, ce.HotkeyChar, ce.JsFunctionId); err != nil {

			return err
		}
	}
	return caption.Set_tx(tx, ce.Id, ce.Captions)
}
