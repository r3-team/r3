package request

import (
	"encoding/json"
	"r3/cluster"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func ClusterNodeDel_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id uuid.UUID `json:"id"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, cluster.DelNode_tx(tx, req.Id)
}

func ClusterNodesGet() (interface{}, error) {
	return cluster.GetNodes()
}

func ClusterNodeSet_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id   uuid.UUID `json:"id"`
		Name string    `json:"name"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, cluster.SetNode_tx(tx, req.Id, req.Name)
}

func ClusterNodeShutdown(reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id uuid.UUID `json:"id"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, cluster.CreateEventForNode(req.Id, "shutdownTriggered", "{}")
}
