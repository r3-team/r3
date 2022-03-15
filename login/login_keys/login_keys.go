package login_keys

import (
	"r3/db"

	"github.com/jackc/pgx/v4"
)

func Reset_tx(tx pgx.Tx, loginId int64) error {

	_, err := tx.Exec(db.Ctx, `
		UPDATE instance.login
		SET key_private_enc = NULL, key_private_enc_backup = NULL, key_public = NULL
		WHERE id = $1
	`, loginId)

	// TEMP
	// Missing: Delete existing user keys as they cannot be decrypted anymore

	return err
}

func Store_tx(tx pgx.Tx, loginId int64, privateKeyEnc string,
	privateKeyEncBackup string, publicKey string) error {

	_, err := tx.Exec(db.Ctx, `
		UPDATE instance.login
		SET key_private_enc = $1, key_private_enc_backup = $2, key_public = $3
		WHERE id = $4
	`, privateKeyEnc, privateKeyEncBackup, publicKey, loginId)

	return err
}

func StorePrivate_tx(tx pgx.Tx, loginId int64, privateKeyEnc string) error {

	_, err := tx.Exec(db.Ctx, `
		UPDATE instance.login
		SET key_private_enc = $1
		WHERE id = $2
	`, privateKeyEnc, loginId)

	return err
}
