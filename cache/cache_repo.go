package cache

import (
	"context"
	"fmt"
	"r3/types"
	"sync"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

var (
	repo_mx       sync.RWMutex
	repos         []types.Repo
	reposFeedback []types.RepoFeedback
)

func GetRepos() []types.Repo {
	repo_mx.RLock()
	defer repo_mx.RUnlock()
	return repos
}
func GetReposFeedback() []types.RepoFeedback {
	repo_mx.RLock()
	defer repo_mx.RUnlock()
	return reposFeedback
}

func GetRepoById(id uuid.UUID) (types.Repo, error) {
	repo_mx.RLock()
	defer repo_mx.RUnlock()

	for _, r := range repos {
		if r.Id == id {
			return r, nil
		}
	}
	return types.Repo{}, fmt.Errorf("repository with the ID '%s' does not exist", id)
}

func LoadRepos_tx(ctx context.Context, tx pgx.Tx) error {
	repo_mx.Lock()
	defer repo_mx.Unlock()

	rows, err := tx.Query(ctx, `
		SELECT id, name, url, fetch_user_name, fetch_user_pass,
			skip_verify, feedback_enable, date_checked, active
		FROM instance.repo
		ORDER BY name
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	repos = make([]types.Repo, 0)
	reposFeedback = make([]types.RepoFeedback, 0)

	for rows.Next() {
		var r types.Repo
		if err := rows.Scan(&r.Id, &r.Name, &r.Url, &r.FetchUserName, &r.FetchUserPass,
			&r.SkipVerify, &r.FeedbackEnable, &r.DateChecked, &r.Active); err != nil {
			return err
		}
		repos = append(repos, r)

		if r.Active && r.FeedbackEnable {
			reposFeedback = append(reposFeedback, types.RepoFeedback{
				Id:   r.Id,
				Name: r.Name,
				Url:  r.Url,
			})
		}
	}
	return nil
}
