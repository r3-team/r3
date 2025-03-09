package module_meta

import (
	"context"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func Create_tx(ctx context.Context, tx pgx.Tx, moduleId uuid.UUID, hidden bool, owner bool, position int) error {

	// module hash is updated after import transfer or on first version for new modules
	_, err := tx.Exec(ctx, `
		INSERT INTO instance.module_meta (module_id, hidden, owner, position, date_change, hash)
		VALUES ($1,$2,$3,$4,EXTRACT(EPOCH FROM NOW()),'00000000000000000000000000000000000000000000')
	`, moduleId, hidden, owner, position)
	return err
}

func Get_tx(ctx context.Context, tx pgx.Tx, moduleId uuid.UUID) (types.ModuleMeta, error) {
	var m = types.ModuleMeta{
		Id: moduleId,
	}

	err := tx.QueryRow(ctx, `
		SELECT hidden, owner, position, date_change, languages_custom
		FROM instance.module_meta
		WHERE module_id = $1
	`, moduleId).Scan(&m.Hidden, &m.Owner, &m.Position, &m.DateChange, &m.LanguagesCustom)

	if m.LanguagesCustom == nil {
		m.LanguagesCustom = make([]string, 0)
	}
	return m, err
}
func GetIdMap_tx(ctx context.Context, tx pgx.Tx) (map[uuid.UUID]types.ModuleMeta, error) {
	moduleIdMap := make(map[uuid.UUID]types.ModuleMeta)

	rows, err := tx.Query(ctx, `
		SELECT module_id, hidden, owner, position, date_change, languages_custom
		FROM instance.module_meta
	`)
	if err != nil {
		return moduleIdMap, err
	}
	defer rows.Close()

	for rows.Next() {
		var m types.ModuleMeta
		if err := rows.Scan(&m.Id, &m.Hidden, &m.Owner, &m.Position, &m.DateChange, &m.LanguagesCustom); err != nil {
			return moduleIdMap, err
		}
		if m.LanguagesCustom == nil {
			m.LanguagesCustom = make([]string, 0)
		}
		moduleIdMap[m.Id] = m
	}
	return moduleIdMap, nil
}
func GetHash_tx(ctx context.Context, tx pgx.Tx, moduleId uuid.UUID) (string, error) {
	var hash string
	err := tx.QueryRow(ctx, `
		SELECT hash
		FROM instance.module_meta
		WHERE module_id = $1
	`, moduleId).Scan(&hash)
	return hash, err
}
func GetOwner_tx(ctx context.Context, tx pgx.Tx, moduleId uuid.UUID) (bool, error) {
	var isOwner bool
	err := tx.QueryRow(ctx, `
		SELECT owner
		FROM instance.module_meta
		WHERE module_id = $1
	`, moduleId).Scan(&isOwner)
	return isOwner, err
}

func SetDateChange_tx(ctx context.Context, tx pgx.Tx, moduleIds []uuid.UUID, date int64) error {
	_, err := tx.Exec(ctx, `
		UPDATE instance.module_meta
		SET date_change = $2
		WHERE module_id = ANY($1)
	`, moduleIds, date)
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
