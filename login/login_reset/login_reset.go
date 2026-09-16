package login_reset

import (
	"context"
	"fmt"
	"r3/cache"
	"r3/config"
	"r3/handler"
	"r3/login/login_meta"
	"r3/tools"
	"r3/types"
	"strings"

	"github.com/jackc/pgx/v5"
)

func CheckExists_tx(ctx context.Context, tx pgx.Tx, loginId int64, code string) (bool, error) {
	exists := false
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM instance.login_reset
			WHERE login_id  = $1
			AND   code_hash = $2
		)
	`, loginId, tools.Hash(code)).Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}

func Del_tx(ctx context.Context, tx pgx.Tx, loginId int64) error {
	_, err := tx.Exec(ctx, `
		DELETE FROM instance.login_reset
		WHERE login_id = $1
	`, loginId)

	return err
}

func Set_tx(ctx context.Context, tx pgx.Tx, mailAccountId, mailTemplateId int32,
	mailTemplateContent types.MailTemplateContent, expireAfterSeconds int64, loginIdsReset []int64) error {

	now := tools.GetTimeUnix()
	expireAt := now + expireAfterSeconds

	// get mail account & template
	ma, err := cache.GetMailAccount(mailAccountId, "smtp")
	if err != nil {
		return err
	}

	mt, err := cache.GetMailTemplate(mailTemplateId, mailTemplateContent)
	if err != nil {
		return err
	}

	// get login details
	loginIdMapDetails, err := login_meta.GetDetailsMany_tx(ctx, tx, loginIdsReset)
	if err != nil {
		return err
	}

	// generate reset codes
	loginIdMapCodes := make(map[int64]string)
	for _, loginId := range loginIdsReset {
		code := tools.RandStringRunes(128)
		loginIdMapCodes[loginId] = code

		if _, err := tx.Exec(ctx, `
			INSERT INTO instance.login_reset (login_id, code_hash, date_create, date_expiry)
			VALUES ($1,$2,$3,$4)
			ON CONFLICT (login_id) DO UPDATE
			SET code_hash = $2, date_create = $3, date_expiry = $4
		`, loginId, tools.Hash(code), now, expireAt); err != nil {
			return err
		}
	}

	// send mails
	if _, err := tx.Prepare(ctx, "mail_send", `
		INSERT INTO instance.mail_spool (from_list, to_list, subject, body, date, mail_account_id, outgoing)
		VALUES ($1,$2,$3,$4,$5,$6,TRUE)
	`); err != nil {
		return err
	}

	for _, loginId := range loginIdsReset {

		l := loginIdMapDetails[loginId]
		if l.Meta.Email == "" || !strings.Contains(l.Meta.Email, "@") {
			return handler.CreateErrCodeWithData(handler.ErrContextApp, handler.ErrCodeAppMailResetBadReceiver, struct {
				Mail string `json:"mail"`
				Name string `json:"name"`
			}{l.Meta.Email, l.Name})
		}

		// placeholders in mail template
		resetUrl := fmt.Sprintf("%s/#/?reset=%s", config.GetString("publicHostName"), loginIdMapCodes[loginId])
		replacer := strings.NewReplacer([]string{
			"/{RESET_URL}", resetUrl,
			"{RESET_URL}", resetUrl,
			"{CODE_VALID_UNTIL}", tools.GetTimeStringLocal(expireAt),
			"{USERNAME}", l.Name,
			"{DISPLAYNAME}", l.Meta.NameDisplay,
			"{FORENAME}", l.Meta.NameFore,
			"{SURNAME}", l.Meta.NameSur,
			"{EMAIL}", l.Meta.Email,
			"{DESCRIPTION}", l.Meta.Notes,
			"{ORGANIZATION}", l.Meta.Organization,
			"{LOCATION}", l.Meta.Location,
			"{DEPARTMENT}", l.Meta.Department,
			"{PHONE_FAX}", l.Meta.PhoneFax,
			"{PHONE_LANDLINE}", l.Meta.PhoneLandline,
			"{PHONE_MOBILE}", l.Meta.PhoneMobile,
		}...)

		if _, err := tx.Exec(ctx, "mail_send",
			ma.SendAs,
			l.Meta.Email,
			replacer.Replace(mt.Subject),
			replacer.Replace(mt.Body),
			tools.GetTimeUnix(),
			mailAccountId); err != nil {

			return err
		}
	}
	return nil
}
