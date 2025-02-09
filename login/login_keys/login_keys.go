package login_keys

import (
	"context"
	"fmt"
	"r3/cache"
	"r3/db"
	"r3/handler"
	"r3/schema"
	"r3/types"
	"slices"
	"strings"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func GetPublic(ctx context.Context, relationId uuid.UUID,
	recordIds []int64, loginIds []int64) ([]types.LoginPublicKey, error) {

	keys := make([]types.LoginPublicKey, 0)
	loginNamesNoPublicKey := make([]string, 0)

	rows, err := db.Pool.Query(ctx, fmt.Sprintf(`
		SELECT l.id, l.name, lm.name_display, l.key_public, ARRAY(
			SELECT record_id
			FROM instance_e2ee."%s"
			WHERE record_id = ANY($1)
			AND   login_id  = l.id
		)
		FROM      instance.login      AS l
		LEFT JOIN instance.login_meta AS lm ON lm.login_id = l.id
		WHERE l.id = ANY($2)
	`, schema.GetEncKeyTableName(relationId)), recordIds, loginIds)
	if err != nil {
		return keys, err
	}
	defer rows.Close()

	for rows.Next() {
		var loginId int64
		var name string
		var nameDisplay pgtype.Text
		var key pgtype.Text
		var recordIdsReady []int64

		if err := rows.Scan(&loginId, &name, &nameDisplay, &key, &recordIdsReady); err != nil {
			return keys, err
		}

		// login already has encrypted data keys for all records
		if len(recordIdsReady) == len(recordIds) {
			continue
		}

		// login has no public key, error
		if !key.Valid {
			if nameDisplay.Valid && nameDisplay.String != "" {
				name = nameDisplay.String
			}
			loginNamesNoPublicKey = append(loginNamesNoPublicKey, name)
			continue
		}

		recordIdsMissing := make([]int64, 0)
		for _, recordId := range recordIds {
			if !slices.Contains(recordIdsReady, recordId) {
				recordIdsMissing = append(recordIdsMissing, recordId)
			}
		}

		// add to key list for encryption
		keys = append(keys, types.LoginPublicKey{
			LoginId:   loginId,
			PublicKey: key.String,
			RecordIds: recordIdsMissing,
		})
	}

	if len(loginNamesNoPublicKey) != 0 {
		return keys, handler.CreateErrCodeWithData(handler.ErrContextSec, handler.ErrCodeSecNoPublicKeys, struct {
			Names string `json:"names"`
		}{strings.Join(loginNamesNoPublicKey, ", ")})
	}
	return keys, nil
}

func Reset_tx(ctx context.Context, tx pgx.Tx, loginId int64) error {
	cache.Schema_mx.RLock()
	defer cache.Schema_mx.RUnlock()

	if _, err := tx.Exec(ctx, `
		UPDATE instance.login
		SET key_private_enc = NULL, key_private_enc_backup = NULL, key_public = NULL
		WHERE id = $1
	`, loginId); err != nil {
		return err
	}

	// delete unusable data keys
	for _, rel := range cache.RelationIdMap {
		if rel.Encryption {
			if _, err := tx.Exec(ctx, fmt.Sprintf(`
				DELETE FROM instance_e2ee."%s"
				WHERE login_id = $1
			`, schema.GetEncKeyTableName(rel.Id)), loginId); err != nil {
				return err
			}
		}
	}
	return nil
}

func Store_tx(ctx context.Context, tx pgx.Tx, loginId int64, privateKeyEnc string,
	privateKeyEncBackup string, publicKey string) error {

	_, err := tx.Exec(ctx, `
		UPDATE instance.login
		SET key_private_enc = $1, key_private_enc_backup = $2, key_public = $3
		WHERE id = $4
	`, privateKeyEnc, privateKeyEncBackup, publicKey, loginId)

	return err
}

func StorePrivate_tx(ctx context.Context, tx pgx.Tx, loginId int64, privateKeyEnc string) error {

	_, err := tx.Exec(ctx, `
		UPDATE instance.login
		SET key_private_enc = $1
		WHERE id = $2
	`, privateKeyEnc, loginId)

	return err
}
