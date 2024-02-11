package data_enc

import (
	"context"
	"fmt"
	"r3/schema"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func GetKeys_tx(ctx context.Context, tx pgx.Tx, relationId uuid.UUID,
	recordIds []int64, loginId int64) ([]string, error) {

	encKeys := make([]string, 0)

	if len(recordIds) == 0 {
		return encKeys, nil
	}

	err := tx.QueryRow(ctx, fmt.Sprintf(`
		SELECT ARRAY(
			SELECT k.key_enc
			FROM instance_e2ee."%s" AS k
			JOIN UNNEST($1::int[])
				WITH ORDINALITY t(record_id,sort)
				USING (record_id)
			WHERE k.login_id = $2
			ORDER BY t.sort
		)
	`, schema.GetEncKeyTableName(relationId)), recordIds, loginId).Scan(&encKeys)

	return encKeys, err
}

func SetKeys_tx(ctx context.Context, tx pgx.Tx, relationId uuid.UUID,
	recordId int64, keys []types.DataSetEncKeys) error {

	if len(keys) == 0 {
		return nil
	}

	// ignore existing, we cannot guarantee that only non-existing keys are inserted
	// primary key is record_id + login_id
	if _, err := tx.Prepare(ctx, "store_keys", fmt.Sprintf(`
		INSERT INTO instance_e2ee."%s" (record_id, login_id, key_enc)
		VALUES ($1,$2,$3)
		ON CONFLICT (record_id,login_id) DO NOTHING
	`, schema.GetEncKeyTableName(relationId))); err != nil {
		return err
	}

	for _, k := range keys {
		if _, err := tx.Exec(ctx, "store_keys", recordId, k.LoginId, k.KeyEnc); err != nil {
			return err
		}
	}
	return nil
}
