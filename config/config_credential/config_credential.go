package config_credential

import (
	"context"
	"fmt"
	"r3/config"
	"r3/tools/cryptAesGcm"
	"r3/types"
	"r3/types/constants"
	"slices"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func Get_tx(ctx context.Context, tx pgx.Tx, target types.CredentialsTarget, id any) (string, error) {

	switch id.(type) {
	case int64:
		if !slices.Contains(constants.CredentialTargetsIdInt, target) {
			return "", fmt.Errorf("invalid target '%s' for credentials with integer ID", target)
		}
	case uuid.UUID:
		if !slices.Contains(constants.CredentialTargetsIdUuid, target) {
			return "", fmt.Errorf("invalid target '%s' for credentials with UUID ID", target)
		}
	default:
		return "", fmt.Errorf("invalid ID value type %T", id)
	}

	var cipherTextEnc []byte
	var nonce []byte
	var saltKdf []byte
	if err := tx.QueryRow(ctx, fmt.Sprintf(`
		SELECT cipher_text_enc, nonce, salt_kdf
		FROM instance.credential
		WHERE %s_id = $1
	`, target), id).Scan(&cipherTextEnc, &nonce, &saltKdf); err != nil {
		return "", err
	}
	return cryptAesGcm.DecryptWithWeakSecret(config.File.CredentialsSecret, cipherTextEnc, saltKdf, nonce)
}

func Set_tx(ctx context.Context, tx pgx.Tx, target types.CredentialsTarget, id any, cipherTextPlain string) error {

	switch id.(type) {
	case int64:
		if !slices.Contains(constants.CredentialTargetsIdInt, target) {
			return fmt.Errorf("invalid target '%s' for credentials with integer ID", target)
		}
	case uuid.UUID:
		if !slices.Contains(constants.CredentialTargetsIdUuid, target) {
			return fmt.Errorf("invalid target '%s' for credentials with UUID ID", target)
		}
	default:
		return fmt.Errorf("invalid ID value type %T", id)
	}

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
