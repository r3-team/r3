package cache

import (
	"fmt"
	"r3/db"
	"r3/types"
	"sync"
)

var (
	mail_mx          sync.Mutex
	mailAccountIdMap map[int32]types.MailAccount
)

func GetMailAccountMap() map[int32]types.MailAccount {
	mail_mx.Lock()
	defer mail_mx.Unlock()

	return mailAccountIdMap
}

func GetMailAccount(id int32, mode string) (types.MailAccount, error) {
	mail_mx.Lock()
	defer mail_mx.Unlock()

	ma, exists := mailAccountIdMap[id]
	if !exists || mode != ma.Mode {
		return ma, fmt.Errorf("mail account with ID %d does not exist for mode '%s'", id, mode)
	}
	return ma, nil
}

func GetMailAccountAny(mode string) (types.MailAccount, error) {
	mail_mx.Lock()
	defer mail_mx.Unlock()

	for _, ma := range mailAccountIdMap {
		if mode == ma.Mode {
			return ma, nil
		}
	}
	return types.MailAccount{}, fmt.Errorf("no mail account is available for mode '%s'", mode)
}

func GetMailAccountsExist() bool {
	mail_mx.Lock()
	defer mail_mx.Unlock()

	return len(mailAccountIdMap) != 0
}

func LoadMailAccountMap() error {
	mail_mx.Lock()
	defer mail_mx.Unlock()

	mailAccountIdMap = make(map[int32]types.MailAccount)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT id, name, mode, auth_method, username, password,
			start_tls, send_as, host_name, host_port
		FROM instance.mail_account
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var ma types.MailAccount

		if err := rows.Scan(&ma.Id, &ma.Name, &ma.Mode, &ma.AuthMethod,
			&ma.Username, &ma.Password, &ma.StartTls, &ma.SendAs,
			&ma.HostName, &ma.HostPort); err != nil {

			return err
		}
		mailAccountIdMap[ma.Id] = ma
	}
	return nil
}
