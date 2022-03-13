package login_keys

import (
	"r3/db"

	"github.com/jackc/pgx/v4"
)

func Store_tx(tx pgx.Tx, loginId int64, privateKeyEnc string,
	privateKeyEncBackup string, publicKey string) error {

	_, err := tx.Exec(db.Ctx, `
		UPDATE instance.login
		SET key_private_enc = $1, key_private_enc_backup = $2, key_public = $3
		WHERE id = $4
		
		-- ignore if keys are already set
		AND key_private_enc IS NULL
		AND key_public IS NULL
	`, privateKeyEnc, privateKeyEncBackup, publicKey, loginId)

	return err
}
