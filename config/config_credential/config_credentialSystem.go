package config_credential

import (
	"context"
	"fmt"
	"math/rand"
	"r3/config"
	"r3/tools"
	"r3/tools/cryptAesGcm"
	"r3/types"
	"r3/types/constants"
	"slices"

	"github.com/jackc/pgx/v5"
)

func GetSystem_tx(ctx context.Context, tx pgx.Tx, systemCred types.CredentialsSystem) (string, error) {
	return getSystem_tx(ctx, tx, systemCred, false)
}
func GetSystemSecretNew_tx(ctx context.Context, tx pgx.Tx, systemCred types.CredentialsSystem) (string, error) {
	return getSystem_tx(ctx, tx, systemCred, true)
}

func SetSystem_tx(ctx context.Context, tx pgx.Tx, systemCred types.CredentialsSystem, cipherTextPlain string) error {
	if !slices.Contains(constants.CredentialSystemCreds, systemCred) {
		return fmt.Errorf("invalid system credentials '%s'", systemCred)
	}

	cipherTextEnc, saltKdf, nonce, err := cryptAesGcm.EncryptWithWeakSecret(config.File.CredentialsSecret, cipherTextPlain)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO instance.credential (system_credential, algorithm, cipher_text_enc, nonce, salt_kdf)
		VALUES ($1,$2,$3,$4,$5)
		ON CONFLICT (system_credential)
		DO UPDATE SET algorithm = $2, cipher_text_enc = $3, nonce = $4, salt_kdf = $5
	`, systemCred, constants.CredentialsAlgorithmAesGcm, cipherTextEnc, nonce, saltKdf)

	return err
}

// internal
func getSystem_tx(ctx context.Context, tx pgx.Tx, systemCred types.CredentialsSystem, useNewSecret bool) (string, error) {
	if !slices.Contains(constants.CredentialSystemCreds, systemCred) {
		return "", fmt.Errorf("invalid system credentials '%s'", systemCred)
	}

	var cipherTextEnc []byte
	var nonce []byte
	var saltKdf []byte
	if err := tx.QueryRow(ctx, `
		SELECT cipher_text_enc, nonce, salt_kdf
		FROM instance.credential
		WHERE system_credential = $1
	`, systemCred).Scan(&cipherTextEnc, &nonce, &saltKdf); err != nil {

		if err == pgx.ErrNoRows {
			// special cases
			switch systemCred {
			case constants.CredentialsSystemTokenSecret:
				// token secret not set yet (occurs during initial setup), generate new one
				min, max := 32, 48
				secret := tools.RandStringRunes(rand.Intn(max-min+1) + min)
				return secret, SetSystem_tx(ctx, tx, systemCred, secret)
			}
		}
		return "", err
	}

	secret := ""
	if useNewSecret {
		secret = config.File.CredentialsSecretNew
	} else {
		secret = config.File.CredentialsSecret
	}
	return cryptAesGcm.DecryptWithWeakSecret(secret, cipherTextEnc, saltKdf, nonce)
}
