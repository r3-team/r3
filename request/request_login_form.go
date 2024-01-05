package request

import (
	"encoding/json"
	"r3/schema/loginForm"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func LoginFormDel_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id uuid.UUID `json:"id"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	if err := loginForm.Del_tx(tx, req.Id); err != nil {
		return nil, err
	}
	return nil, nil
}

func LoginFormSet_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req types.LoginForm

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, loginForm.Set_tx(tx, req.ModuleId, req.Id, req.AttributeIdLogin,
		req.AttributeIdLookup, req.FormId, req.Name, req.Captions)
}
