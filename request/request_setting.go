package request

import (
	"encoding/json"
	"r3/setting"
	"r3/types"

	"github.com/jackc/pgx/v4"
)

func SettingsGet(loginId int64) (interface{}, error) {
	return setting.Get(loginId)
}
func SettingsSet_tx(tx pgx.Tx, reqJson json.RawMessage, loginId int64) (interface{}, error) {

	var req types.Settings

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	if err := setting.Set_tx(tx, loginId, req.LanguageCode, req.DateFormat,
		req.SundayFirstDow, req.FontSize, req.BordersAll, req.BordersCorner,
		req.PageLimit, req.HeaderCaptions, req.Spacing, req.Dark, req.Compact,
		req.HintUpdateVersion, req.MobileScrollForm, req.WarnUnsaved); err != nil {

		return nil, err
	}
	return nil, nil
}
