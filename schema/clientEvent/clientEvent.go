package clientEvent

import (
	"context"
	"r3/db"
	"r3/schema"
	"r3/schema/caption"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func Del_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID) error {
	_, err := tx.Exec(ctx, `DELETE FROM app.client_event WHERE id = $1`, id)
	return err
}

func Get(moduleId uuid.UUID) ([]types.ClientEvent, error) {

	clientEvents := make([]types.ClientEvent, 0)
	rows, err := db.Pool.Query(context.Background(), `
		SELECT id, action, arguments, event, hotkey_modifier1,
			hotkey_modifier2, hotkey_char, js_function_id, pg_function_id
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
			&e.HotkeyModifier2, &e.HotkeyChar, &e.JsFunctionId, &e.PgFunctionId); err != nil {

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

func Set_tx(ctx context.Context, tx pgx.Tx, ce types.ClientEvent) error {

	known, err := schema.CheckCreateId_tx(ctx, tx, &ce.Id, "client_event", "id")
	if err != nil {
		return err
	}

	if ce.Action != "callJsFunction" {
		ce.JsFunctionId = pgtype.UUID{}
	}
	if ce.Action != "callPgFunction" {
		ce.PgFunctionId = pgtype.UUID{}
	}

	if known {
		if _, err := tx.Exec(ctx, `
			UPDATE app.client_event
			SET action = $1, arguments = $2, event = $3, hotkey_modifier1 = $4,
				hotkey_modifier2 = $5, hotkey_char = $6, js_function_id = $7, pg_function_id = $8
			WHERE id = $9
		`, ce.Action, ce.Arguments, ce.Event, ce.HotkeyModifier1, ce.HotkeyModifier2,
			ce.HotkeyChar, ce.JsFunctionId, ce.PgFunctionId, ce.Id); err != nil {

			return err
		}
	} else {
		if _, err := tx.Exec(ctx, `
			INSERT INTO app.client_event (id, module_id, action, arguments, event, hotkey_modifier1,
				hotkey_modifier2, hotkey_char, js_function_id, pg_function_id)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		`, ce.Id, ce.ModuleId, ce.Action, ce.Arguments, ce.Event, ce.HotkeyModifier1,
			ce.HotkeyModifier2, ce.HotkeyChar, ce.JsFunctionId, ce.PgFunctionId); err != nil {

			return err
		}
	}
	return caption.Set_tx(ctx, tx, ce.Id, ce.Captions)
}
