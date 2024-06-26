package request

import (
	"encoding/json"
	"fmt"
	"r3/cache"
	"r3/cluster"
	"r3/db"
	"r3/handler"
	"r3/schema/clientEvent"
	"r3/types"
	"strings"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func clientEventDel_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id uuid.UUID `json:"id"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, clientEvent.Del_tx(tx, req.Id)
}

func clientEventExec(reqJson json.RawMessage, loginId int64, address string) (interface{}, error) {

	var req struct {
		Id        uuid.UUID     `json:"id"`
		Arguments []interface{} `json:"arguments"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	cache.Schema_mx.RLock()
	ce, exists := cache.ClientEventIdMap[req.Id]
	cache.Schema_mx.RUnlock()

	if !exists {
		return nil, handler.ErrSchemaUnknownClientEvent(req.Id)
	}

	// execute valid actions
	if ce.Action == "callJsFunction" && ce.JsFunctionId.Valid {
		return nil, cluster.DeviceBrowserCallJsFunction(true, address, loginId, ce.JsFunctionId.Bytes, req.Arguments)
	}
	if ce.Action == "callPgFunction" && ce.PgFunctionId.Valid {

		cache.Schema_mx.RLock()
		fnc, exists := cache.PgFunctionIdMap[ce.PgFunctionId.Bytes]
		cache.Schema_mx.RUnlock()

		if !exists {
			return nil, handler.ErrSchemaUnknownPgFunction(ce.PgFunctionId.Bytes)
		}
		if fnc.IsTrigger {
			return nil, handler.ErrSchemaTriggerPgFunctionCall(ce.PgFunctionId.Bytes)
		}

		cache.Schema_mx.RLock()
		mod := cache.ModuleIdMap[fnc.ModuleId]
		cache.Schema_mx.RUnlock()

		placeholders := make([]string, 0)
		for i := range req.Arguments {
			placeholders = append(placeholders, fmt.Sprintf("$%d", i+1))
		}

		var returnIf interface{}
		err := db.Pool.QueryRow(db.Ctx, fmt.Sprintf(`SELECT "%s"."%s"(%s)`, mod.Name, fnc.Name, strings.Join(placeholders, ",")),
			req.Arguments...).Scan(&returnIf)

		return nil, err
	}

	return nil, fmt.Errorf("invalid client event")
}

func clientEventSet_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req types.ClientEvent
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, clientEvent.Set_tx(tx, req)
}
