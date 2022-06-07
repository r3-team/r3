package request

import (
	"encoding/json"
	"r3/task"

	"github.com/jackc/pgx/v4"
)

func TaskSet_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Active   bool   `json:"active"`
		Interval int64  `json:"interval"`
		Name     string `json:"name"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, task.Set_tx(tx, req.Name, req.Interval, req.Active)
}
