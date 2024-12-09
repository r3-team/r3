package request

import (
	"context"
	"encoding/json"
	"fmt"
	"r3/cache"
	"r3/config"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func lookupGet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage, loginId int64) (interface{}, error) {

	var req struct {
		Name string `json:"name"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	switch req.Name {
	case "access":
		return cache.GetAccessById(loginId)

	case "feedback":
		var res struct {
			Feedback    bool   `json:"feedback"`
			FeedbackUrl string `json:"feedbackUrl"`
		}
		res.Feedback = config.GetUint64("repoFeedback") == 1
		res.FeedbackUrl = config.GetString("repoUrl")
		return res, nil

	case "loginHasClient":
		var hasClient bool
		err := tx.QueryRow(ctx, `
			SELECT EXISTS(
				SELECT *
				FROM instance.login_token_fixed
				WHERE login_id = $1
				AND   context  = 'client'
				LIMIT 1
			)
		`, loginId).Scan(&hasClient)

		return hasClient, err

	case "loginKeys":
		var res struct {
			PrivateEnc       pgtype.Text `json:"privateEnc"`
			PrivateEncBackup pgtype.Text `json:"privateEncBackup"`
			Public           pgtype.Text `json:"public"`
		}

		err := tx.QueryRow(ctx, `
			SELECT key_private_enc, key_private_enc_backup, key_public
			FROM instance.login
			WHERE id = $1
		`, loginId).Scan(&res.PrivateEnc, &res.PrivateEncBackup, &res.Public)

		return res, err

	case "passwordSettings":
		var res struct {
			Length         uint64 `json:"length"`
			RequireDigits  bool   `json:"requireDigits"`
			RequireLower   bool   `json:"requireLower"`
			RequireSpecial bool   `json:"requireSpecial"`
			RequireUpper   bool   `json:"requireUpper"`
		}
		res.Length = config.GetUint64("pwLengthMin")
		res.RequireDigits = config.GetUint64("pwForceDigit") == 1
		res.RequireLower = config.GetUint64("pwForceLower") == 1
		res.RequireSpecial = config.GetUint64("pwForceSpecial") == 1
		res.RequireUpper = config.GetUint64("pwForceUpper") == 1
		return res, nil
	}
	return nil, fmt.Errorf("unknown lookup name")
}
