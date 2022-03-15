package request

import (
	"encoding/json"
	"r3/password"

	"github.com/jackc/pgx/v4"
)

func PasswortSet_tx(tx pgx.Tx, reqJson json.RawMessage, loginId int64) (interface{}, error) {

	var (
		err error
		req struct {
			PwNew0 string `json:"pwNew0"`
			PwNew1 string `json:"pwNew1"`
			PwOld  string `json:"pwOld"`
		}
		res struct {
			ErrCode string `json:"errCode"`
		}
	)
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	res.ErrCode, err = password.Set_tx(tx, loginId, req.PwOld, req.PwNew0, req.PwNew1)
	if err != nil {
		return nil, err
	}
	return res, nil
}
