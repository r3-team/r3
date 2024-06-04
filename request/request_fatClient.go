package request

import (
	"context"
	"encoding/json"
	"r3/cluster"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func FatClientJsFunctionCalled(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage, loginId int64, address string) (interface{}, error) {

	var req struct {
		JsFunctionId uuid.UUID     `json:"jsFunctionId"`
		Arguments    []interface{} `json:"arguments"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	return nil, cluster.JsFunctionCalled(true, address, loginId, req.JsFunctionId, req.Arguments)
}
