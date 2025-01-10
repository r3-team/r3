package login_options

import (
	"context"
	"r3/tools"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func Get_tx(ctx context.Context, tx pgx.Tx, loginId int64, dateCache int64) ([]types.LoginOptions, error) {
	options := make([]types.LoginOptions, 0)

	rows, err := tx.Query(ctx, `
		SELECT login_favorite_id, field_id, options
		FROM instance.login_options
		WHERE login_id    =  $1
		AND   date_change >= $2
	`, loginId, dateCache)
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

func Set_tx(ctx context.Context, tx pgx.Tx, loginId int64, favoriteId pgtype.UUID, fieldId uuid.UUID, options string) error {
	now := tools.GetTimeUnix()
	_, err := tx.Exec(ctx, `
		INSERT INTO instance.login_options(login_id, login_favorite_id, field_id, options, date_change)
		VALUES ($1,$2,$3,$4,$5)
		ON CONFLICT (login_id, COALESCE(login_favorite_id, '00000000-0000-0000-0000-000000000000'), field_id)
		DO UPDATE SET options = $6, date_change = $7
	`, loginId, favoriteId, fieldId, options, now, options, now)

	return err
}
