package login_template

import (
	"context"
	"fmt"
	"r3/login/login_setting"
	"r3/types"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func Del_tx(ctx context.Context, tx pgx.Tx, id int64) error {
	_, err := tx.Exec(ctx, `
		DELETE FROM instance.login_template
		WHERE id = $1
		AND name <> 'GLOBAL' -- protect global default
	`, id)
	return err
}

func Get_tx(ctx context.Context, tx pgx.Tx, byId int64) ([]types.LoginTemplateAdmin, error) {
	templates := make([]types.LoginTemplateAdmin, 0)

	sqlParams := make([]interface{}, 0)
	sqlWhere := ""
	if byId != 0 {
		sqlParams = append(sqlParams, byId)
		sqlWhere = "WHERE id = $1"
	}

	rows, err := tx.Query(ctx, fmt.Sprintf(`
		SELECT id, name, comment
		FROM instance.login_template
		%s
		ORDER BY CASE WHEN name = 'GLOBAL' THEN 0 END, name ASC
	`, sqlWhere), sqlParams...)
	if err != nil {
		return templates, err
	}

	for rows.Next() {
		var t types.LoginTemplateAdmin
		if err := rows.Scan(&t.Id, &t.Name, &t.Comment); err != nil {
			return templates, err
		}
		templates = append(templates, t)
	}
	rows.Close()

	for i, _ := range templates {
		templates[i].Settings, err = login_setting.Get_tx(
			ctx, tx,
			pgtype.Int8{},
			pgtype.Int8{Int64: templates[i].Id, Valid: true})

		if err != nil {
			return templates, err
		}
	}
	return templates, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, t types.LoginTemplateAdmin) (int64, error) {

	isNew := t.Id == 0
	if isNew {
		if err := tx.QueryRow(ctx, `
			INSERT INTO instance.login_template (name, comment)
			VALUES ($1,$2)
			RETURNING id
		`, t.Name, t.Comment).Scan(&t.Id); err != nil {
			return t.Id, err
		}
	} else {
		if _, err := tx.Exec(ctx, `
			UPDATE instance.login_template
			SET name = $1, comment = $2
			WHERE id = $3
			AND name <> 'GLOBAL' -- protect global default
		`, t.Name, t.Comment, t.Id); err != nil {
			return t.Id, err
		}
	}

	return t.Id, login_setting.Set_tx(ctx, tx,
		pgtype.Int8{},
		pgtype.Int8{Int64: t.Id, Valid: true},
		t.Settings, isNew)
}
