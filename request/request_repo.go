package request

import (
	"context"
	"encoding/json"
	"r3/repo"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func RepoSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {
	var req types.Repo
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, repo.Set_tx(ctx, tx, req)
}

func RepoModuleGet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {

	var (
		err error
		req struct {
			ByString     string `json:"byString"`
			LanguageCode string `json:"languageCode"`
			Limit        int    `json:"limit"`
			GetInstalled bool   `json:"getInstalled"`
			GetInStore   bool   `json:"getInStore"`
			GetNew       bool   `json:"getNew"`
			Offset       int    `json:"offset"`
		}
		res struct {
			Count       int                `json:"count"`
			RepoModules []types.RepoModule `json:"repoModules"`
		}
	)

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	res.RepoModules, res.Count, err = repo.GetModule_tx(ctx, tx, req.ByString,
		req.LanguageCode, req.Limit, req.Offset, req.GetInstalled, req.GetNew,
		req.GetInStore)

	if err != nil {
		return nil, err
	}
	return res, nil
}

func RepoModuleInstall(ctx context.Context, reqJson json.RawMessage) (any, error) {
	var moduleId uuid.UUID
	if err := json.Unmarshal(reqJson, &moduleId); err != nil {
		return nil, err
	}
	return nil, repo.InstallModules(ctx, []uuid.UUID{moduleId})
}

func RepoModuleInstallAllUpdates(ctx context.Context) (any, error) {
	return nil, repo.InstallModulesAllUpdates(ctx)
}

func RepoModuleUpdate_tx(ctx context.Context, tx pgx.Tx) (any, error) {
	return nil, repo.UpdateAll_tx(ctx, tx)
}
