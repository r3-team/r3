package login_clientEvent

import (
	"r3/db"
	"r3/types"
)

func Get(loginId int64) ([]types.ClientEvent, error) {

	clientEvents := make([]types.ClientEvent, 0)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT ce.module_id, ce.action, ce.event, ce.js_function_args, ce.js_function_id,
			lce.hotkey_modifier1, lce.hotkey_modifier2, lce.hotkey_char
		FROM instance.login_client_event AS lce
		JOIN app.client_event            AS ce  ON ce.id = lce.client_event_id
		WHERE lce.login_id = $1
	`, loginId)
	if err != nil {
		return clientEvents, err
	}
	defer rows.Close()

	for rows.Next() {
		var ce types.ClientEvent

		if err := rows.Scan(&ce.ModuleId, &ce.Action, &ce.Event, &ce.JsFunctionArgs, &ce.JsFunctionId,
			&ce.HotkeyModifier1, &ce.HotkeyModifier2, &ce.HotkeyChar); err != nil {

			return clientEvents, err
		}
		clientEvents = append(clientEvents, ce)
	}
	return clientEvents, nil
}
