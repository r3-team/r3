package module

import (
	"context"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func getHistory_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID) ([]types.History, error) {

	rows, err := tx.Query(ctx, `
		SELECT id, category, content, release_build
		FROM app.history
		WHERE module_id = $1
		ORDER BY position ASC
	`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	logs := make([]types.History, 0)
	for rows.Next() {
		var l types.History
		if err := rows.Scan(&l.Id, &l.Category, &l.Content, &l.ReleaseBuild); err != nil {
			return nil, err
		}
		logs = append(logs, l)
	}
	return logs, nil
}

func setHistory_tx(ctx context.Context, tx pgx.Tx, moduleId uuid.UUID, logs []types.History) error {
	for i, l := range logs {
		if _, err := tx.Exec(ctx, `
			INSERT INTO app.history (module_id, id, position, category, content, release_build)
			VALUES ($1,$2,$3,$4,$5,$6)
			ON CONFLICT (id)
			DO UPDATE SET position = $3, category = $4, content = $5, release_build = $6
		`, moduleId, l.Id, i, l.Category, l.Content, l.ReleaseBuild); err != nil {
			return err
		}
	}
	return nil
}
