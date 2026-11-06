package searchBar

import (
	"context"
	"r3/schema/caption"
	"r3/schema/column"
	"r3/schema/openForm"
	"r3/schema/query"
	"r3/types"
	"r3/types/constants"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func Del_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID) error {
	_, err := tx.Exec(ctx, `DELETE FROM app.search_bar WHERE id = $1`, id)
	return err
}

func Get_tx(ctx context.Context, tx pgx.Tx, moduleId uuid.UUID) ([]types.SearchBar, error) {

	rows, err := tx.Query(ctx, `
		SELECT id, icon_id, name
		FROM app.search_bar
		WHERE module_id = $1
		ORDER BY name ASC
	`, moduleId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	bars := make([]types.SearchBar, 0)
	for rows.Next() {
		var b types.SearchBar
		b.ModuleId = moduleId

		if err := rows.Scan(&b.Id, &b.IconId, &b.Name); err != nil {
			return nil, err
		}
		bars = append(bars, b)
	}
	rows.Close()

	for i, b := range bars {
		b.Captions, err = caption.Get_tx(ctx, tx, constants.DbSearchBar, b.Id, []string{"searchBarTitle"})
		if err != nil {
			return nil, err
		}
		b.OpenForm, err = openForm.Get_tx(ctx, tx, constants.DbSearchBar, b.Id, pgtype.Text{})
		if err != nil {
			return nil, err
		}
		b.Query, err = query.Get_tx(ctx, tx, constants.DbSearchBar, b.Id, 0, 0, 0)
		if err != nil {
			return nil, err
		}
		b.Columns, err = column.Get_tx(ctx, tx, constants.DbSearchBar, b.Id)
		if err != nil {
			return nil, err
		}
		bars[i] = b
	}
	return bars, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, onlyCreate bool, bar types.SearchBar) error {

	bt := &pgx.Batch{}
	bt.Queue(`
		INSERT INTO app.search_bar (id,module_id,icon_id,name)
		VALUES ($1,$2,$3,$4)
		ON CONFLICT (id)
		DO UPDATE SET icon_id = $3, name = $4
	`, bar.Id, bar.ModuleId, bar.IconId, bar.Name)

	caption.Set_bt(bt, bar.Id, onlyCreate, bar.Captions)
	openForm.Set_bt(bt, constants.DbSearchBar, bar.Id, onlyCreate, bar.OpenForm, pgtype.Text{})
	query.Set_bt(bt, constants.DbSearchBar, bar.Id, onlyCreate, 0, 0, 0, bar.Query)
	column.Set_bt(bt, constants.DbSearchBar, bar.Id, onlyCreate, bar.Columns)

	return tx.SendBatch(ctx, bt).Close()
}
