package request

import (
	"encoding/json"
	"r3/login/login_session"

	"github.com/jackc/pgx/v5/pgtype"
)

func LoginSessionConcurrentGet() (interface{}, error) {
	var err error
	var res struct {
		Full    int64 `json:"full"`
		Limited int64 `json:"limited"`
	}

	res.Full, res.Limited, err = login_session.LogsGetConcurrentCounts()
	return res, err
}

func LoginSessionsGet(reqJson json.RawMessage) (interface{}, error) {
	var req struct {
		ByString pgtype.Text `json:"byString"`
		Limit    int         `json:"limit"`
		Offset   int         `json:"offset"`
		OrderBy  string      `json:"orderBy"`
		OrderAsc bool        `json:"orderAsc"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return login_session.LogsGet(req.ByString, req.Limit, req.Offset, req.OrderBy, req.OrderAsc)
}
