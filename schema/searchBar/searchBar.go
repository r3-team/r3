package searchBar

import (
	"context"
	"r3/schema"
	"r3/schema/caption"
	"r3/schema/column"
	"r3/schema/openForm"
	"r3/schema/query"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func Del_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID) error {
	_, err := tx.Exec(ctx, `DELETE FROM app.search_bar WHERE id = $1`, id)
	return err
}

func Get_tx(ctx context.Context, tx pgx.Tx, moduleId uuid.UUID) ([]types.SearchBar, error) {
	bars := make([]types.SearchBar, 0)

	rows, err := tx.Query(ctx, `
		SELECT id, icon_id, name
		FROM app.search_bar
		WHERE module_id = $1
		ORDER BY name ASC
	`, moduleId)
	if err != nil {
		return bars, err
	}

	for rows.Next() {
		var b types.SearchBar
		b.ModuleId = moduleId

		if err := rows.Scan(&b.Id, &b.IconId, &b.Name); err != nil {
			return bars, err
		}
		bars = append(bars, b)
	}
	rows.Close()

	for i, b := range bars {
		b.Captions, err = caption.Get_tx(ctx, tx, schema.DbSearchBar, b.Id, []string{"searchBarTitle"})
		if err != nil {
			return bars, err
		}
		b.OpenForm, err = openForm.Get_tx(ctx, tx, schema.DbSearchBar, b.Id, pgtype.Text{})
		if err != nil {
			return bars, err
		}
		b.Query, err = query.Get_tx(ctx, tx, schema.DbSearchBar, b.Id, 0, 0, 0)
		if err != nil {
			return bars, err
		}
		b.Columns, err = column.Get_tx(ctx, tx, schema.DbSearchBar, b.Id)
		if err != nil {
			return bars, err
		}
		bars[i] = b
	}
	return bars, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, bar types.SearchBar) error {

	known, err := schema.CheckCreateId_tx(ctx, tx, &bar.Id, schema.DbSearchBar, "id")
	if err != nil {
		return err
	}

	if known {
		if _, err := tx.Exec(ctx, `
			UPDATE app.search_bar
			SET icon_id = $1, name = $2
			WHERE id = $3
		`, bar.IconId, bar.Name, bar.Id); err != nil {
			return err
		}
	} else {
		if _, err := tx.Exec(ctx, `
			INSERT INTO app.search_bar (id,icon_id,module_id,name)
			VALUES ($1,$2,$3,$4)
		`, bar.Id, bar.IconId, bar.ModuleId, bar.Name); err != nil {
			return err
		}
	}
	if err := caption.Set_tx(ctx, tx, bar.Id, bar.Captions); err != nil {
		return err
	}
	if err := openForm.Set_tx(ctx, tx, schema.DbSearchBar, bar.Id, bar.OpenForm, pgtype.Text{}); err != nil {
		return err
	}
	if err := query.Set_tx(ctx, tx, schema.DbSearchBar, bar.Id, 0, 0, 0, bar.Query); err != nil {
		return err
	}
	return column.Set_tx(ctx, tx, schema.DbSearchBar, bar.Id, bar.Columns)
}
