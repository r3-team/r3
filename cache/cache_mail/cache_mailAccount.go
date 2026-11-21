package cache_mail

import (
	"context"
	"fmt"
	"r3/cache/cache_credential"
	"r3/types"
	"sync"

	"github.com/jackc/pgx/v5"
)

var (
	accounts_mx  sync.RWMutex
	accountIdMap map[int64]types.MailAccount
)

func GetAccountMap() map[int64]types.MailAccount {
	accounts_mx.RLock()
	defer accounts_mx.RUnlock()

	return accountIdMap
}
func GetAccountsByMode(mode types.DbMailAccountMode) []types.MailAccount {
	accounts_mx.RLock()
	defer accounts_mx.RUnlock()

	mas := make([]types.MailAccount, 0)
	for _, ma := range accountIdMap {
		if ma.Mode == mode {
			mas = append(mas, ma)
		}
	}
	return mas
}
func GetAccount(id int64, mode types.DbMailAccountMode) (types.MailAccount, error) {
	accounts_mx.RLock()
	defer accounts_mx.RUnlock()

	ma, exists := accountIdMap[id]
	if !exists || mode != ma.Mode {
		return ma, fmt.Errorf("mail account with ID %d does not exist for mode '%s'", id, mode)
	}
	return ma, nil
}
func GetAccountAny(mode types.DbMailAccountMode) (types.MailAccount, error) {
	accounts_mx.RLock()
	defer accounts_mx.RUnlock()

	for _, ma := range accountIdMap {
		if mode == ma.Mode {
			return ma, nil
		}
	}
	return types.MailAccount{}, fmt.Errorf("no mail account is available for mode '%s'", mode)
}

func LoadAccountMap_tx(ctx context.Context, tx pgx.Tx) error {

	rows, err := tx.Query(ctx, `
		SELECT id, oauth_client_id, name, mode, connect_method, auth_method, username,
			send_as, host_name, host_port, comment, smime_path_crt, smime_path_key,
			smime_sign, send_count, send_seconds, resend_count, resend_seconds
		FROM instance.mail_account
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	accounts_mx.Lock()
	defer accounts_mx.Unlock()

	accountIdMap = make(map[int64]types.MailAccount)
	cache_credential.ResetMailAccounts()

	for rows.Next() {
		var ma types.MailAccount

		if err := rows.Scan(&ma.Id, &ma.OauthClientId, &ma.Name, &ma.Mode, &ma.ConnectMethod,
			&ma.AuthMethod, &ma.Username, &ma.SendAs, &ma.HostName, &ma.HostPort, &ma.Comment,
			&ma.SmimePathCrt, &ma.SmimePathKey, &ma.SmimeSign, &ma.SendCount, &ma.SendSeconds,
			&ma.ResendCount, &ma.ResendSeconds); err != nil {

			return err
		}
		accountIdMap[ma.Id] = ma
	}
	return nil
}
