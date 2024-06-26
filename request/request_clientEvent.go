package request

import (
	"encoding/json"
	"fmt"
	"r3/cache"
	"r3/cluster"
	"r3/handler"
	"r3/schema/clientEvent"
	"r3/types"

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
	return nil, fmt.Errorf("invalid client event")
}

func clientEventSet_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req types.ClientEvent
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, clientEvent.Set_tx(tx, req)
}
