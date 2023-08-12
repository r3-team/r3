package transfer

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"r3/db"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func getModuleHash(moduleId uuid.UUID) (string, error) {
	var hash string
	err := db.Pool.QueryRow(db.Ctx, `
		SELECT hash
		FROM instance.module_hash
		WHERE module_id = $1
	`, moduleId).Scan(&hash)
	return hash, err
}

// returns the hash from the content part of a module transfer file
func getModuleHashFromFile(file types.TransferFile) (string, error) {
	jsonContent, err := json.Marshal(file.Content)
	if err != nil {
		return "", err
	}
	hashed := sha256.Sum256(jsonContent)
	return base64.URLEncoding.EncodeToString(hashed[:]), nil
}

func setModuleHash_tx(tx pgx.Tx, moduleId uuid.UUID, hash string) error {
	_, err := tx.Exec(db.Ctx, `
		UPDATE instance.module_hash
		SET hash = $1
		WHERE module_id = $2
	`, hash, moduleId)
	return err
}
