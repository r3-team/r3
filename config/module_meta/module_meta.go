package module_meta

import (
	"context"
	"r3/db"
	"r3/tools"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func Create_tx(tx pgx.Tx, moduleId uuid.UUID, hidden bool, owner bool, position int) error {

	// module hash is updated after import transfer or on first version for new modules
	_, err := tx.Exec(db.Ctx, `
		INSERT INTO instance.module_meta (module_id, hidden, owner, position, date_change, hash)
		VALUES ($1,$2,$3,$4,EXTRACT(EPOCH FROM NOW()),'00000000000000000000000000000000000000000000')
	`, moduleId, hidden, owner, position)
	return err
}

func Get(moduleId uuid.UUID) (types.ModuleMeta, error) {
	var m = types.ModuleMeta{
		Id: moduleId,
	}

	err := db.Pool.QueryRow(db.Ctx, `
		SELECT hidden, owner, position, date_change, languages_custom
		FROM instance.module_meta
		WHERE module_id = $1
	`, moduleId).Scan(&m.Hidden, &m.Owner, &m.Position, &m.DateChange, &m.LanguagesCustom)

	if m.LanguagesCustom == nil {
		m.LanguagesCustom = make([]string, 0)
	}
	return m, err
}
func GetDateChange(moduleId uuid.UUID) (uint64, error) {
	var dateChange uint64
	err := db.Pool.QueryRow(db.Ctx, `
		SELECT date_change
		FROM instance.module_meta
		WHERE module_id = $1
	`, moduleId).Scan(&dateChange)
	return dateChange, err
}
func GetIdMap() (map[uuid.UUID]types.ModuleMeta, error) {
	moduleIdMap := make(map[uuid.UUID]types.ModuleMeta)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT module_id, hidden, owner, position, date_change, languages_custom
		FROM instance.module_meta
	`)
	if err != nil {
		return moduleIdMap, err
	}
	defer rows.Close()

	for rows.Next() {
		var m types.ModuleMeta
		if err := rows.Scan(&m.Id, &m.Hidden, &m.Owner, &m.Position,
			&m.DateChange, &m.LanguagesCustom); err != nil {

			return moduleIdMap, err
		}
		if m.LanguagesCustom == nil {
			m.LanguagesCustom = make([]string, 0)
		}
		moduleIdMap[m.Id] = m
	}
	return moduleIdMap, nil
}
func GetHash(moduleId uuid.UUID) (string, error) {
	var hash string
	err := db.Pool.QueryRow(db.Ctx, `
		SELECT hash
		FROM instance.module_meta
		WHERE module_id = $1
	`, moduleId).Scan(&hash)
	return hash, err
}
func GetOwner(moduleId uuid.UUID) (bool, error) {
	var isOwner bool
	err := db.Pool.QueryRow(db.Ctx, `
		SELECT owner
		FROM instance.module_meta
		WHERE module_id = $1
	`, moduleId).Scan(&isOwner)
	return isOwner, err
}

func SetDateChange(moduleIds []uuid.UUID, date int64) error {
	_, err := db.Pool.Exec(db.Ctx, `
		UPDATE instance.module_meta
		SET date_change = $2
		WHERE module_id = ANY($1)
	`, moduleIds, date)
	return err
}
func SetDateChangeAllToNow() error {
	_, err := db.Pool.Exec(db.Ctx, `
		UPDATE instance.module_meta
		SET date_change = $1
	`, tools.GetTimeUnix())
	return err
}
func SetHash_tx(ctx context.Context, tx pgx.Tx, moduleId uuid.UUID, hash string) error {
	_, err := tx.Exec(ctx, `
		UPDATE instance.module_meta
		SET hash = $1
		WHERE module_id = $2
	`, hash, moduleId)
	return err
}
func SetLanguagesCustom_tx(ctx context.Context, tx pgx.Tx, moduleId uuid.UUID, languages []string) error {
	_, err := tx.Exec(ctx, `
		UPDATE instance.module_meta
		SET languages_custom = $1
		WHERE module_id = $2
	`, languages, moduleId)
	return err
}
func SetOptions_tx(ctx context.Context, tx pgx.Tx, moduleId uuid.UUID, hidden bool, owner bool, position int) error {
	_, err := tx.Exec(ctx, `
		UPDATE instance.module_meta
		SET hidden = $1, owner = $2, position = $3
		WHERE module_id = $4
	`, hidden, owner, position, moduleId)
	return err
}
