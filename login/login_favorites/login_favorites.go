package login_favorites

import (
	"context"
	"r3/tools"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func Add_tx(ctx context.Context, tx pgx.Tx, loginId int64, moduleId uuid.UUID, formId uuid.UUID, recordIdOpen pgtype.Int8, title pgtype.Text) (uuid.UUID, error) {
	title = forceTitleLength(title)

	id, err := uuid.NewV4()
	if err != nil {
		return id, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO instance.login_favorite (id, login_id, module_id, form_id, record_id, title, position)
		VALUES ($1,$2,$3,$4,$5,$6,COALESCE((
			SELECT position + 1
			FROM instance.login_favorite
			WHERE login_id  = $7
			AND   module_id = $8
			ORDER BY position DESC
			LIMIT 1
		),0))
	`, id, loginId, moduleId, formId, recordIdOpen, title, loginId, moduleId); err != nil {
		return id, err
	}
	return id, updateTimestamp_tx(ctx, tx, loginId)
}

func Get_tx(ctx context.Context, tx pgx.Tx, loginId int64, dateCache int64) (map[uuid.UUID][]types.LoginFavorite, int64, error) {
	favorites := make(map[uuid.UUID][]types.LoginFavorite)

	var dateCacheEx int64
	if err := tx.QueryRow(ctx, `
		SELECT date_favorites
		FROM instance.login
		WHERE id = $1
	`, loginId).Scan(&dateCacheEx); err != nil {
		return favorites, 0, err
	}

	if dateCache == dateCacheEx {
		// cache valid, return empty but with same timestamp to let client know that cache is still valid
		return favorites, dateCache, nil
	}

	// cache changed, return all
	rows, err := tx.Query(ctx, `
		SELECT id, module_id, form_id, record_id, title
		FROM instance.login_favorite
		WHERE login_id = $1
		ORDER BY position ASC
	`, loginId)
	if err != nil {
		return favorites, 0, err
	}
	defer rows.Close()

	for rows.Next() {
		var f types.LoginFavorite
		var moduleId uuid.UUID

		if err := rows.Scan(&f.Id, &moduleId, &f.FormId, &f.RecordId, &f.Title); err != nil {
			return favorites, 0, err
		}
		_, exists := favorites[moduleId]
		if !exists {
			favorites[moduleId] = make([]types.LoginFavorite, 0)
		}
		favorites[moduleId] = append(favorites[moduleId], f)
	}
	return favorites, dateCacheEx, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, loginId int64, moduleIdMapFavorites map[uuid.UUID][]types.LoginFavorite) error {

	var err error
	idsKeep := make([]uuid.UUID, 0)
	for moduleId, favorites := range moduleIdMapFavorites {
		for position, f := range favorites {
			f.Title = forceTitleLength(f.Title)

			if f.Id == uuid.Nil {
				f.Id, err = uuid.NewV4()
				if err != nil {
					return err
				}

				if _, err := tx.Exec(ctx, `
					INSERT INTO instance.login_favorite (id, login_id, module_id, form_id, record_id, title, position)
					VALUES ($1,$2,$3,$4,$5,$6,$7)
				`, f.Id, loginId, moduleId, f.FormId, f.RecordId, f.Title, position); err != nil {
					return err
				}
			} else {
				if _, err := tx.Exec(ctx, `
					UPDATE instance.login_favorite
					SET title = $1, position = $2
					WHERE id       = $3
					AND   login_id = $4
				`, f.Title, position, f.Id, loginId); err != nil {
					return err
				}
			}
			idsKeep = append(idsKeep, f.Id)
		}
	}

	// delete removed favorites
	if _, err := tx.Exec(ctx, `
		DELETE FROM instance.login_favorite
		WHERE id       <> ALL($1)
		AND   login_id =  $2
	`, idsKeep, loginId); err != nil {
		return err
	}
	return updateTimestamp_tx(ctx, tx, loginId)
}

// helpers
func forceTitleLength(title pgtype.Text) pgtype.Text {
	if len(title.String) > 128 {
		title.String = title.String[0:128]
	}
	return title
}
func updateTimestamp_tx(ctx context.Context, tx pgx.Tx, loginId int64) error {
	_, err := tx.Exec(ctx, `
		UPDATE instance.login
		SET date_favorites = $1
		WHERE id = $2
	`, tools.GetTimeUnix(), loginId)
	return err
}
