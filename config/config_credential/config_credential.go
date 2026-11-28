package config_credential

import (
	"context"
	"math/rand"
	"r3/config"
	"r3/db"
	"r3/log"
	"r3/tools"
	"r3/tools/cryptAesGcm"
	"r3/types"
	"r3/types/constants"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

type cred struct {
	Id            uuid.UUID `json:"id"`
	CipherTextEnc []byte    `json:"cipherTextEnc"`
	SaltKdf       []byte    `json:"saltKdf"`
	Nonce         []byte    `json:"nonce"`
}

func CreateNewSystemCred(systemCred types.CredentialsSystem) error {
	ctx, ctxCanc := context.WithTimeout(context.Background(), db.CtxDefTimeoutSysTaskShort)
	defer ctxCanc()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	min, max := 32, 48
	cipherTextPlain := tools.RandStringRunes(rand.Intn(max-min+1) + min)

	if err := SetSystem_tx(ctx, tx, systemCred, cipherTextPlain); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func MigrateToNewKeyIfRequired() error {

	if config.File.CredentialsKeyNew == "" {
		// no change to apply
		return nil
	}

	// check if new credentials key is already in use, by trying to read JWT token secret (not there yet for new instance - or encrypted with old key)
	// check is important as 2nd cluster node with identical config might boot up after migration was done already
	log.Info(log.ContextServer, "found new credentials key in configuration file, checking state")

	ctx, ctxCanc := context.WithTimeout(context.Background(), db.CtxDefTimeoutSysTask)
	defer ctxCanc()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := GetSystemSecretNew_tx(ctx, tx, constants.CredentialsSystemTokenSecret); err == nil {
		log.Info(log.ContextServer, "validated new credentials key already in use, updating current key in configuration file")
		return config.ApplyCredentialsKeyNew()
	}

	// token secret could not be decrypted, we assume new key has not been applied yet
	log.Info(log.ContextServer, "validated new credentials key not in use yet, migrating existing credentials to new key")

	rows, err := tx.Query(ctx, `SELECT id, cipher_text_enc, salt_kdf, nonce FROM instance.credential`)
	if err != nil {
		return err
	}
	defer rows.Close()

	creds := make([]cred, 0)
	for rows.Next() {
		var c cred
		if err := rows.Scan(&c.Id, &c.CipherTextEnc, &c.SaltKdf, &c.Nonce); err != nil {
			return err
		}
		creds = append(creds, c)
	}
	rows.Close()

	// re-encrypt credentials with new key
	bt := &pgx.Batch{}

	for _, c := range creds {
		cipherTextPlain, err := cryptAesGcm.DecryptWithWeakSecret(config.File.CredentialsKey, c.CipherTextEnc, c.SaltKdf, c.Nonce)
		if err != nil {
			return err
		}
		cipherTextEncNew, saltKdfNew, nonceNew, err := cryptAesGcm.EncryptWithWeakSecret(config.File.CredentialsKeyNew, cipherTextPlain)
		if err != nil {
			return err
		}

		bt.Queue(`
			UPDATE instance.credential
			SET cipher_text_enc = $1, salt_kdf = $2, nonce = $3
			WHERE id = $4
		`, cipherTextEncNew, saltKdfNew, nonceNew, c.Id)
	}
	if err := tx.SendBatch(ctx, bt).Close(); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return err
	}

	log.Info(log.ContextServer, "successfully migrated credentials to new key, updating current key in configuration file")

	// only apply new key to config file, if DB changes were committed
	// even if write to config file is blocked now, it contains old & new key (nothing is lost)
	// as long as re-encryption is atomic, either new or old key is valid at any time
	// if write to config file fails mid-op, restore is required
	return config.ApplyCredentialsKeyNew()
}
