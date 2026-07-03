package tab

import (
	"context"
	"errors"
	"fmt"
	"r3/schema"
	"r3/schema/caption"
	"r3/types"
	"slices"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func Del_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID) error {
	_, err := tx.Exec(ctx, `DELETE FROM app.tab WHERE id = $1`, id)
	return err
}

func Get_tx(ctx context.Context, tx pgx.Tx, entity schema.DbEntity, entityId uuid.UUID) ([]types.Tab, error) {

	if !slices.Contains(schema.DbAssignedTab, entity) {
		return nil, errors.New("bad entity")
	}

	rows, err := tx.Query(ctx, fmt.Sprintf(`
		SELECT id, icon_id, content_counter, state
		FROM app.tab
		WHERE %s_id = $1
		ORDER BY position ASC
	`, entity), entityId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tabs := make([]types.Tab, 0)
	for rows.Next() {
		var t types.Tab
		if err := rows.Scan(&t.Id, &t.IconId, &t.ContentCounter, &t.State); err != nil {
			return nil, err
		}
		tabs = append(tabs, t)
	}
	rows.Close()

	for i, tab := range tabs {
		tabs[i].Captions, err = caption.Get_tx(ctx, tx, schema.DbTab, tab.Id, []string{"tabTitle"})
		if err != nil {
			return nil, err
		}
	}
	return tabs, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, entity schema.DbEntity, entityId uuid.UUID, position int, tab types.Tab) error {
	if !slices.Contains(schema.DbAssignedTab, entity) {
		return errors.New("bad entity")
	}
	if _, err := tx.Exec(ctx, fmt.Sprintf(`
		INSERT INTO app.tab (id, %s_id, position, icon_id, content_counter, state)
		VALUES ($1,$2,$3,$4,$5,$6)
		ON CONFLICT (id)
		DO UPDATE SET position = $3, icon_id = $4, content_counter = $5, state = $6
	`, entity), tab.Id, entityId, position, tab.IconId, tab.ContentCounter, tab.State); err != nil {
		return err
	}
	return caption.Set_tx(ctx, tx, tab.Id, tab.Captions)
}
