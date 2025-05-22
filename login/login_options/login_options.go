package login_options

import (
	"context"
	"r3/tools"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func CopyToFavorite_tx(ctx context.Context, tx pgx.Tx, loginId int64, isMobile bool, srcFormId uuid.UUID, srcFavoriteId pgtype.UUID, trgFavoriteId uuid.UUID) error {

	copyFromFavorite := srcFavoriteId.Valid
	fieldIdMapOptions := make(map[uuid.UUID]string)
	var query string
	var args []interface{}

	if copyFromFavorite {
		query = `
			SELECT field_id, options
			FROM instance.login_options
			WHERE login_id          = $1
			AND   login_favorite_id = $2
			AND   is_mobile         = $3
			AND   field_id IN (
				SELECT id
				FROM app.field
				WHERE form_id = $4
			)`
		args = []interface{}{loginId, srcFavoriteId, isMobile, srcFormId}
	} else {
		query = `
			SELECT field_id, options
			FROM instance.login_options
			WHERE login_id          =  $1
			AND   login_favorite_id IS NULL
			AND   is_mobile         =  $2
			AND   field_id IN (
				SELECT id
				FROM app.field
				WHERE form_id = $3
			)`
		args = []interface{}{loginId, isMobile, srcFormId}
	}

	rows, err := tx.Query(ctx, query, args...)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var fieldId uuid.UUID
		var options string

		if err := rows.Scan(&fieldId, &options); err != nil {
			return err
		}
		fieldIdMapOptions[fieldId] = options
	}

	for fieldId, options := range fieldIdMapOptions {
		if err := Set_tx(ctx, tx, loginId, pgtype.UUID{Bytes: trgFavoriteId, Valid: true}, fieldId, isMobile, options); err != nil {
			return err
		}
	}
	return nil
}

func Del_tx(ctx context.Context, tx pgx.Tx, loginId int64) error {
	_, err := tx.Exec(ctx, `
		DELETE FROM instance.login_options
		WHERE login_id = $1
	`, loginId)

	return err
}

func Get_tx(ctx context.Context, tx pgx.Tx, loginId int64, isMobile bool, dateCache int64) ([]types.LoginOptions, error) {
	options := make([]types.LoginOptions, 0)

	rows, err := tx.Query(ctx, `
		SELECT login_favorite_id, field_id, options
		FROM instance.login_options
		WHERE login_id    =  $1
		AND   is_mobile   =  $2
		AND   date_change >= $3
	`, loginId, isMobile, dateCache)
	if err != nil {
		return options, err
	}
	defer rows.Close()

	for rows.Next() {
		var o types.LoginOptions
		if err := rows.Scan(&o.FavoriteId, &o.FieldId, &o.Options); err != nil {
			return options, err
		}
		options = append(options, o)
	}
	return options, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, loginId int64, favoriteId pgtype.UUID, fieldId uuid.UUID, isMobile bool, options string) error {
	now := tools.GetTimeUnix()
	_, err := tx.Exec(ctx, `
		INSERT INTO instance.login_options(login_id, login_favorite_id, field_id, is_mobile, options, date_change)
		VALUES ($1,$2,$3,$4,$5,$6)
		ON CONFLICT (login_id, COALESCE(login_favorite_id, '00000000-0000-0000-0000-000000000000'), field_id, is_mobile)
		DO UPDATE SET options = $7, date_change = $8
	`, loginId, favoriteId, fieldId, isMobile, options, now, options, now)

	return err
}
