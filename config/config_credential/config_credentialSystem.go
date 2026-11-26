package config_credential

import (
	"context"
	"fmt"
	"r3/config"
	"r3/tools/cryptAesGcm"
	"r3/types"
	"r3/types/constants"
	"slices"

	"github.com/jackc/pgx/v5"
)

func GetSystem_tx(ctx context.Context, tx pgx.Tx, systemCred types.CredentialsSystem) (string, error) {
	return getSystem_tx(ctx, tx, systemCred, config.File.CredentialsSecret)
}
func GetSystemSecretNew_tx(ctx context.Context, tx pgx.Tx, systemCred types.CredentialsSystem) (string, error) {
	return getSystem_tx(ctx, tx, systemCred, config.File.CredentialsSecretNew)
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
func getSystem_tx(ctx context.Context, tx pgx.Tx, systemCred types.CredentialsSystem, secret string) (string, error) {
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
		return "", err
	}
	return cryptAesGcm.DecryptWithWeakSecret(secret, cipherTextEnc, saltKdf, nonce)
}
