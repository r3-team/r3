package request

import (
	"context"
	"encoding/json"
	"r3/cluster"
	"r3/types"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func ClusterNodeDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {

	var req struct {
		Id uuid.UUID `json:"id"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}
	return cluster.DelNode_tx(ctx, tx, req.Id)
}

func ClusterNodesGet_tx(ctx context.Context, tx pgx.Tx) (any, error) {
	return cluster.GetNodes_tx(ctx, tx)
}

func ClusterNodeSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {

	var req struct {
		Id   uuid.UUID `json:"id"`
		Name string    `json:"name"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}
	return cluster.SetNode_tx(ctx, tx, req.Id, req.Name)
}

func ClusterNodeShutdown_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {

	var req struct {
		Id uuid.UUID `json:"id"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}
	return cluster.CreateEventForNodes_tx(ctx, tx, []uuid.UUID{req.Id},
		"shutdownTriggered", "{}", types.ClusterEventTarget{})
}
