package request

import (
	"encoding/json"
	"r3/schema/form"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func FormCopy_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id       uuid.UUID `json:"id"`
		ModuleId uuid.UUID `json:"moduleId"`
		NewName  string    `json:"newName"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, form.Copy_tx(tx, req.ModuleId, req.Id, req.NewName)
}

func FormDel_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id uuid.UUID `json:"id"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, form.Del_tx(tx, req.Id)
}

func FormGet(reqJson json.RawMessage) (interface{}, error) {

	var (
		err error
		req struct {
			ModuleId uuid.UUID `json:"moduleId"`
		}
		res struct {
			Forms []types.Form `json:"forms"`
		}
	)

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	res.Forms, err = form.Get(req.ModuleId, []uuid.UUID{})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func FormSet_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req types.Form

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, form.Set_tx(tx, req.ModuleId, req.Id, req.PresetIdOpen,
		req.IconId, req.Name, req.NoDataActions, req.Query, req.Fields,
		req.Functions, req.States, req.ArticleIdsHelp, req.Captions)
}
