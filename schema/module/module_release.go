package module

import (
	"context"
	"r3/types"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func getReleases_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID) ([]types.Release, error) {

	rows, err := tx.Query(ctx, `
		SELECT build, build_app, date_created
		FROM app.release
		WHERE module_id = $1
		ORDER BY build ASC
	`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	releases := make([]types.Release, 0)
	for rows.Next() {
		var r types.Release
		if err := rows.Scan(&r.Build, &r.BuildApp, &r.DateCreated); err != nil {
			return nil, err
		}
		releases = append(releases, r)
	}
	rows.Close()

	for i, r := range releases {
		releases[i].Logs, err = getReleaseLogs_tx(ctx, tx, id, r.Build)
		if err != nil {
			return nil, err
		}
	}
	return releases, nil
}
func getReleaseLogs_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID, build int64) ([]types.ReleaseLog, error) {

	rows, err := tx.Query(ctx, `
		SELECT category, content
		FROM app.release_log
		WHERE module_id = $1
		AND   build     = $2
		ORDER BY position ASC
	`, id, build)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	logs := make([]types.ReleaseLog, 0)
	for rows.Next() {
		var l types.ReleaseLog
		if err := rows.Scan(&l.Category, &l.Content); err != nil {
			return nil, err
		}
		logs = append(logs, l)
	}
	return logs, nil
}

func setReleases_bt(bt *pgx.Batch, moduleId uuid.UUID, releases []types.Release) {
	buildsKeep := make([]int64, 0)
	buildsKeep = append(buildsKeep, 0) // always keep zero release
	for _, r := range releases {
		buildsKeep = append(buildsKeep, r.Build)

		bt.Queue(`
			INSERT INTO app.release (module_id, build, build_app, date_created)
			VALUES ($1,$2,$3,$4)
			ON CONFLICT (module_id, build)
			DO NOTHING
		`, moduleId, r.Build, r.BuildApp, r.DateCreated)

		setReleaseLogs_bt(bt, moduleId, r.Build, r.Logs)
	}
	bt.Queue(`DELETE FROM app.release WHERE module_id = $1 AND build <> ALL($2)`, moduleId, buildsKeep)
}
func setReleaseLogs_bt(bt *pgx.Batch, moduleId uuid.UUID, build int64, logs []types.ReleaseLog) {

	positionsKeep := make([]int, 0)
	for i, l := range logs {
		positionsKeep = append(positionsKeep, i)

		bt.Queue(`
			INSERT INTO app.release_log (module_id, build, position, category, content)
			VALUES ($1,$2,$3,$4,$5)
			ON CONFLICT (module_id, build, position)
			DO UPDATE SET category = $4, content = $5
		`, moduleId, build, i, l.Category, l.Content)
	}

	bt.Queue(`
		DELETE FROM app.release_log
		WHERE module_id = $1
		AND   build     = $2
		AND   position  <> ALL($3)
	`, moduleId, build, positionsKeep)
}
