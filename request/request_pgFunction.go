package request

import (
	"encoding/json"
	"fmt"
	"r3/cache"
	"r3/db"
	"r3/schema/pgFunction"
	"r3/types"
	"strings"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v4"
)

func PgFunctionDel_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id uuid.UUID `json:"id"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, pgFunction.Del_tx(tx, req.Id)
}

func PgFunctionExec_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id   uuid.UUID     `json:"id"`
		Args []interface{} `json:"args"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	fnc, exists := cache.PgFunctionIdMap[req.Id]
	if !exists {
		return nil, fmt.Errorf("backend function (ID %s) does not exist", req.Id)
	}

	if !fnc.IsFrontendExec {
		return nil, fmt.Errorf("backend function (ID %s) may not be called from the frontend", req.Id)
	}

	mod, exists := cache.ModuleIdMap[fnc.ModuleId]
	if !exists {
		return nil, fmt.Errorf("module (ID %s) does not exist", fnc.ModuleId)
	}

	placeholders := make([]string, 0)
	for i, _ := range req.Args {
		placeholders = append(placeholders, fmt.Sprintf("$%d", i+1))
	}

	var returnIf interface{}
	if err := tx.QueryRow(db.Ctx, fmt.Sprintf(`
		SELECT "%s"."%s"(%s)
	`, mod.Name, fnc.Name, strings.Join(placeholders, ",")),
		req.Args...).Scan(&returnIf); err != nil {

		return nil, err
	}
	return returnIf, nil
}

func PgFunctionGet(reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		ModuleId uuid.UUID `json:"moduleId"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return pgFunction.Get(req.ModuleId)
}

func PgFunctionSet_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req types.PgFunction

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, pgFunction.Set_tx(tx, req.ModuleId, req.Id, req.Name, req.CodeArgs,
		req.CodeFunction, req.CodeReturns, req.IsFrontendExec, req.IsTrigger,
		req.Schedules, req.Captions)
}
