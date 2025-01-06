package login_favorite

import (
	"context"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func Get_tx(ctx context.Context, tx pgx.Tx, loginId int64) (map[uuid.UUID][]types.LoginFavorite, error) {

	favorites := make(map[uuid.UUID][]types.LoginFavorite)

	rows, err := tx.Query(ctx, `
		SELECT id, module_id, form_id, title
		FROM instance.login_favorite
		WHERE login_id = $1
		ORDER BY position ASC
	`, loginId)
	if err != nil {
		return favorites, err
	}
	defer rows.Close()

	for rows.Next() {
		var f types.LoginFavorite
		var moduleId uuid.UUID

		if err := rows.Scan(&f.Id, &moduleId, &f.FormId, &f.Title); err != nil {
			return favorites, err
		}
		_, exists := favorites[moduleId]
		if !exists {
			favorites[moduleId] = make([]types.LoginFavorite, 0)
		}
		favorites[moduleId] = append(favorites[moduleId], f)
	}
	return favorites, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, loginId int64, moduleIdMapFavorites map[uuid.UUID][]types.LoginFavorite) error {

	var err error
	idsKeep := make([]uuid.UUID, 0)
	for moduleId, favorites := range moduleIdMapFavorites {
		for position, f := range favorites {
			if f.Id == uuid.Nil {
				f.Id, err = uuid.NewV4()
				if err != nil {
					return err
				}

				if _, err := tx.Exec(ctx, `
					INSERT INTO instance.login_favorite (id, login_id, module_id, form_id, title, position)
					VALUES ($1,$2,$3,$4,$5,$6)
				`, f.Id, loginId, moduleId, f.FormId, f.Title, position); err != nil {
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
				idsKeep = append(idsKeep, f.Id)
			}
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
	return nil
}
