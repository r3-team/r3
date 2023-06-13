package request

import (
	"encoding/json"
	"r3/db"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func PwaDomainSet_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req map[string]uuid.UUID

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	if _, err := tx.Exec(db.Ctx, `DELETE FROM instance.pwa_domain`); err != nil {
		return nil, err
	}

	for domain, moduleId := range req {
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO instance.pwa_domain (module_id, domain)
			VALUES ($1,$2)
		`, moduleId, domain); err != nil {
			return nil, err
		}
	}
	return nil, nil
}
