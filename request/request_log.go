package request

import (
	"context"
	"encoding/json"
	"r3/log"
	"r3/types"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func LogGet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var (
		err error
		req struct {
			ByString string      `json:"byString"`
			Context  string      `json:"context"`
			DateFrom pgtype.Int8 `json:"dateFrom"`
			DateTo   pgtype.Int8 `json:"dateTo"`
			Limit    int         `json:"limit"`
			Offset   int         `json:"offset"`
		}
		res struct {
			Logs  []types.Log `json:"logs"`
			Total int         `json:"total"`
		}
	)

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	res.Logs, res.Total, err = log.Get_tx(ctx, tx, req.DateFrom, req.DateTo,
		req.Limit, req.Offset, req.Context, req.ByString)

	return res, err
}
