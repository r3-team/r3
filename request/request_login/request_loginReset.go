package request_login

import (
	"context"
	"encoding/json"
	"r3/login/login_reset"
	"r3/types"

	"github.com/jackc/pgx/v5"
)

func Reset_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {
	var req struct {
		ExpireAfterSeconds  int64                     `json:"expireAfterSeconds"`
		MailAccountId       int32                     `json:"mailAccountId"`
		MailTemplateId      int32                     `json:"mailTemplateId"`
		MailTemplateContent types.MailTemplateContent `json:"mailTemplateContent"`
		LoginIdsReset       []int64                   `json:"loginIdsReset"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}
	return login_reset.Set_tx(ctx, tx, req.MailAccountId, req.MailTemplateId,
		req.MailTemplateContent, req.ExpireAfterSeconds, req.LoginIdsReset)
}
