package tag

import (
	"context"
	"r3/types"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func Del_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID) error {
	_, err := tx.Exec(ctx, `DELETE FROM app.tag WHERE id = $1`, id)
	return err
}

func Get_tx(ctx context.Context, tx pgx.Tx, moduleId uuid.UUID) ([]types.Tag, error) {

	rows, err := tx.Query(ctx, `
		SELECT id, icon_id, name, comment
		FROM app.tag
		WHERE module_id = $1
		ORDER BY name ASC
	`, moduleId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tags := make([]types.Tag, 0)
	for rows.Next() {
		var t types.Tag
		if err := rows.Scan(&t.Id, &t.IconId, &t.Name, &t.Comment); err != nil {
			return nil, err
		}
		tags = append(tags, t)
	}
	return tags, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, moduleId uuid.UUID, tag types.Tag) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO app.tag (id, module_id, icon_id, name, comment)
		VALUES ($1,$2,$3,$4,$5)
		ON CONFLICT (id)
		DO UPDATE SET icon_id = $3, name = $4, comment = $5
	`, tag.Id, moduleId, tag.IconId, tag.Name, tag.Comment)

	return err
}
