package request

import (
	"encoding/json"
	"r3/login/login_clientEvent"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func loginClientEventDel_tx(tx pgx.Tx, reqJson json.RawMessage, loginId int64) (interface{}, error) {
	var req struct {
		ClientEventId uuid.UUID `json:"clientEventId"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, login_clientEvent.Del_tx(tx, loginId, req.ClientEventId)
}

func loginClientEventGet(loginId int64) (interface{}, error) {
	return login_clientEvent.Get(loginId)
}

func loginClientEventSet_tx(tx pgx.Tx, reqJson json.RawMessage, loginId int64) (interface{}, error) {
	var req struct {
		ClientEventId    uuid.UUID              `json:"clientEventId"`
		LoginClientEvent types.LoginClientEvent `json:"loginClientEvent"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, login_clientEvent.Set_tx(tx, loginId, req.ClientEventId, req.LoginClientEvent)
}
