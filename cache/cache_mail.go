package cache

import (
	"context"
	"fmt"
	"r3/types"
	"sync"

	"github.com/jackc/pgx/v5"
)

var (
	mail_mx           sync.RWMutex
	mailAccountIdMap  map[int32]types.MailAccount
	mailTemplateIdMap map[int32]types.MailTemplate
)

// mail accounts
func GetMailAccountMap() map[int32]types.MailAccount {
	mail_mx.RLock()
	defer mail_mx.RUnlock()

	return mailAccountIdMap
}
func GetMailAccountsByMode(mode string) []types.MailAccount {
	mail_mx.RLock()
	defer mail_mx.RUnlock()

	mas := make([]types.MailAccount, 0)
	for _, ma := range mailAccountIdMap {
		if ma.Mode == mode {
			mas = append(mas, ma)
		}
	}
	return mas
}
func GetMailAccount(id int32, mode string) (types.MailAccount, error) {
	mail_mx.RLock()
	defer mail_mx.RUnlock()

	ma, exists := mailAccountIdMap[id]
	if !exists || mode != ma.Mode {
		return ma, fmt.Errorf("mail account with ID %d does not exist for mode '%s'", id, mode)
	}
	return ma, nil
}
func GetMailAccountAny(mode string) (types.MailAccount, error) {
	mail_mx.RLock()
	defer mail_mx.RUnlock()

	for _, ma := range mailAccountIdMap {
		if mode == ma.Mode {
			return ma, nil
		}
	}
	return types.MailAccount{}, fmt.Errorf("no mail account is available for mode '%s'", mode)
}

func LoadMailAccountMap_tx(ctx context.Context, tx pgx.Tx) error {

	rows, err := tx.Query(ctx, `
		SELECT id, oauth_client_id, name, mode, connect_method, auth_method, username, password,
			send_as, host_name, host_port, comment, smime_path_crt, smime_path_key, smime_sign,
			send_count, send_seconds, resend_count, resend_seconds
		FROM instance.mail_account
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	mail_mx.Lock()
	defer mail_mx.Unlock()

	mailAccountIdMap = make(map[int32]types.MailAccount)
	for rows.Next() {
		var ma types.MailAccount

		if err := rows.Scan(&ma.Id, &ma.OauthClientId, &ma.Name, &ma.Mode, &ma.ConnectMethod,
			&ma.AuthMethod, &ma.Username, &ma.Password, &ma.SendAs, &ma.HostName, &ma.HostPort,
			&ma.Comment, &ma.SmimePathCrt, &ma.SmimePathKey, &ma.SmimeSign, &ma.SendCount,
			&ma.SendSeconds, &ma.ResendCount, &ma.ResendSeconds); err != nil {

			return err
		}
		mailAccountIdMap[ma.Id] = ma
	}
	return nil
}

// mail templates
func GetMailTemplateMap() map[int32]types.MailTemplate {
	mail_mx.RLock()
	defer mail_mx.RUnlock()

	return mailTemplateIdMap
}
func GetMailTemplate(id int32, content types.MailTemplateContent) (types.MailTemplate, error) {
	mail_mx.RLock()
	defer mail_mx.RUnlock()

	mt, exists := mailTemplateIdMap[id]
	if !exists || content != mt.Content {
		return mt, fmt.Errorf("mail template with ID %d does not exist for content '%s'", id, content)
	}
	return mt, nil
}
func LoadMailTemplateMap_tx(ctx context.Context, tx pgx.Tx) error {

	rows, err := tx.Query(ctx, `
		SELECT id, content, name, body, subject
		FROM instance_mail.template
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	mail_mx.Lock()
	defer mail_mx.Unlock()

	mailTemplateIdMap = make(map[int32]types.MailTemplate)
	for rows.Next() {
		var mt types.MailTemplate

		if err := rows.Scan(&mt.Id, &mt.Content, &mt.Name, &mt.Body, &mt.Subject); err != nil {
			return err
		}
		mailTemplateIdMap[mt.Id] = mt
	}
	return nil
}
