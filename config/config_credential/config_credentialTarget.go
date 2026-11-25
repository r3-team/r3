package config_credential

import (
	"context"
	"fmt"
	"r3/config"
	"r3/db"
	"r3/tools/cryptAesGcm"
	"r3/types"
	"r3/types/constants"
	"slices"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func GetInt(target types.CredentialsTarget, id int64) (string, error) {
	if !slices.Contains(constants.CredentialTargetsIdInt, target) {
		return "", fmt.Errorf("invalid target '%s' for credentials with integer ID", target)
	}
	ctx, ctxCanc := context.WithTimeout(context.Background(), db.CtxDefTimeoutSysTaskShort)
	defer ctxCanc()

	return get(ctx, target, id)
}
func GetUuid(target types.CredentialsTarget, id uuid.UUID) (string, error) {
	if !slices.Contains(constants.CredentialTargetsIdUuid, target) {
		return "", fmt.Errorf("invalid target '%s' for credentials with UUID ID", target)
	}
	ctx, ctxCanc := context.WithTimeout(context.Background(), db.CtxDefTimeoutSysTaskShort)
	defer ctxCanc()

	return get(ctx, target, id)
}

func SetInt_tx(ctx context.Context, tx pgx.Tx, target types.CredentialsTarget, id int64, cipherTextPlain string) error {
	if !slices.Contains(constants.CredentialTargetsIdInt, target) {
		return fmt.Errorf("invalid target '%s' for credentials with integer ID", target)
	}
	return set_tx(ctx, tx, target, id, cipherTextPlain)
}
func SetUuid_tx(ctx context.Context, tx pgx.Tx, target types.CredentialsTarget, id uuid.UUID, cipherTextPlain string) error {
	if !slices.Contains(constants.CredentialTargetsIdUuid, target) {
		return fmt.Errorf("invalid target '%s' for credentials with UUID ID", target)
	}
	return set_tx(ctx, tx, target, id, cipherTextPlain)
}

// internal
func get(ctx context.Context, target types.CredentialsTarget, id any) (string, error) {
	var cipherTextEnc []byte
	var nonce []byte
	var saltKdf []byte
	if err := db.Pool.QueryRow(ctx, fmt.Sprintf(`
		SELECT cipher_text_enc, nonce, salt_kdf
		FROM instance.credential
		WHERE %s_id = $1
	`, target), id).Scan(&cipherTextEnc, &nonce, &saltKdf); err != nil {
		return "", err
	}
	return cryptAesGcm.DecryptWithWeakSecret(config.File.CredentialsSecret, cipherTextEnc, saltKdf, nonce)
}
func set_tx(ctx context.Context, tx pgx.Tx, target types.CredentialsTarget, id any, cipherTextPlain string) error {
	cipherTextEnc, saltKdf, nonce, err := cryptAesGcm.EncryptWithWeakSecret(config.File.CredentialsSecret, cipherTextPlain)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, fmt.Sprintf(`
		INSERT INTO instance.credential (%s_id, algorithm, cipher_text_enc, nonce, salt_kdf)
		VALUES ($1,$2,$3,$4,$5)
		ON CONFLICT (%s_id)
		DO UPDATE SET algorithm = $2, cipher_text_enc = $3, nonce = $4, salt_kdf = $5
	`, target, target), id, constants.CredentialsAlgorithmAesGcm, cipherTextEnc, nonce, saltKdf)

	return err
}
