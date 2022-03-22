package login_keys

import (
	"context"
	"fmt"
	"r3/db"
	"r3/handler"
	"r3/schema"
	"r3/tools"
	"r3/types"
	"strings"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgtype"
	"github.com/jackc/pgx/v4"
)

func GetPublic(ctx context.Context, relationId uuid.UUID,
	recordId int64, loginIds []int64) (types.LoginPublicKeyRetrieval, error) {

	var retr types.LoginPublicKeyRetrieval
	retr.Keys = make([]types.LoginPublicKeyRetrievalKey, 0)
	retr.LoginIdsExtra = make([]int64, 0)

	loginNamesNoPublicKey := make([]string, 0)
	tName := schema.GetEncKeyTableName(relationId)

	rows, err := db.Pool.Query(ctx, fmt.Sprintf(`
		SELECT l.id, l.name, l.key_public,
			CASE
				WHEN k.record_id IS NULL THEN FALSE
				ELSE TRUE
			END AS "has_data_key"
		FROM instance.login AS l
		LEFT JOIN instance_e2e."%s" AS k
			ON  k.login_id  = l.id
			AND k.record_id = $1
		
		-- logins requested to get data key
		WHERE l.id = ANY($2)
		
		-- logins that have data key
		OR l.id IN(
			SELECT login_id
			FROM instance_e2e."%s"
			WHERE record_id = $3
		)
	`, tName, tName), recordId, loginIds, recordId)
	if err != nil {
		return retr, err
	}
	defer rows.Close()

	for rows.Next() {
		var loginId int64
		var name string
		var key pgtype.Varchar
		var hasDataKey bool

		if err := rows.Scan(&loginId, &name, &key, &hasDataKey); err != nil {
			return retr, err
		}

		// login is not requested, has data key, add to list of extras to remove
		if !tools.Int64InSlice(loginId, loginIds) {
			retr.LoginIdsExtra = append(retr.LoginIdsExtra, loginId)
			continue
		}

		// login is requested, has data key, nothing to do
		if hasDataKey {
			continue
		}

		// login is requested, has no data key, has no public key, error
		if key.Status == pgtype.Null {
			loginNamesNoPublicKey = append(loginNamesNoPublicKey, name)
			continue
		}

		// login is requested, has no data key, has public key, add to key list for encryption
		retr.Keys = append(retr.Keys, types.LoginPublicKeyRetrievalKey{
			LoginId:   loginId,
			PublicKey: key.String,
		})
	}

	if len(loginNamesNoPublicKey) != 0 {
		return retr, handler.CreateErrCodeWithArgs("SEC",
			handler.ErrCodeSecNoPublicKeys,
			map[string]string{"NAMES": strings.Join(loginNamesNoPublicKey, ", ")})
	}
	return retr, nil
}

func Reset_tx(tx pgx.Tx, loginId int64) error {

	if _, err := tx.Exec(db.Ctx, `
		UPDATE instance.login
		SET key_private_enc = NULL, key_private_enc_backup = NULL, key_public = NULL
		WHERE id = $1
	`, loginId); err != nil {
		return err
	}

	if _, err := tx.Exec(db.Ctx, `
		DELETE FROM instance.record_key
		WHERE login_id = $1
	`, loginId); err != nil {
		return err
	}
	return nil
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
