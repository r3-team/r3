package request_login

import (
	"context"
	"encoding/json"
	"r3/login"
	"r3/login/login_reset"
	"r3/tools"
	"r3/types"
	"r3/types/constants"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func SetWithIntivation_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {

	var req struct {
		ExpireAfterSeconds int64 `json:"expireAfterSeconds"`
		Logins             []struct {
			Name string          `json:"name"`
			Meta types.LoginMeta `json:"meta"`
		} `json:"logins"`
		LoginTemplateId pgtype.Int8 `json:"loginTemplateId"`
		MailAccountId   int32       `json:"mailAccountId"`
		MailTemplateId  int32       `json:"mailTemplateId"`
		MfaRequired     pgtype.Bool `json:"mfaRequired"`
		RoleIds         []uuid.UUID `json:"roleIds"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	// invited users have limited options (no public, no admins, active by default, default token expiry, ...)
	var tokenExpiryHours pgtype.Int4
	active := true
	admin := false
	noAuth := false

	loginIds := make([]int64, len(req.Logins))
	for i, l := range req.Logins {
		pass := tools.RandStringRunes(64)

		loginId, err := login.Set_tx(ctx, tx, 0, req.LoginTemplateId, pgtype.Int4{}, pgtype.Text{},
			pgtype.Int4{}, pgtype.Text{}, pgtype.Text{}, l.Name, pass, admin, noAuth,
			active, tokenExpiryHours, req.MfaRequired, l.Meta, req.RoleIds, []types.LoginAdminRecordSet{})

		if err != nil {
			return nil, err
		}
		loginIds[i] = loginId
	}
	return nil, login_reset.Set_tx(ctx, tx, req.MailAccountId, req.MailTemplateId,
		constants.MailTemplateContentLoginInvitation, req.ExpireAfterSeconds, loginIds)
}
