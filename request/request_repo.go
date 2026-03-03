package request

import (
	"context"
	"encoding/json"
	"r3/repo"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func RepoCommit(ctx context.Context, reqJson json.RawMessage, loginId int64) (any, error) {
	var req struct {
		CredPass string    `json:"credPass"`
		CredUser string    `json:"credUser"`
		FileName string    `json:"fileName"`
		ModuleId uuid.UUID `json:"moduleId"`
		RepoId   uuid.UUID `json:"repoId"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, repo.RepoCommit(ctx, loginId, req.RepoId, req.CredUser, req.CredPass, req.ModuleId, req.FileName)
}

func RepoDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {
	var id uuid.UUID
	if err := json.Unmarshal(reqJson, &id); err != nil {
		return nil, err
	}
	return nil, repo.Del_Tx(ctx, tx, id)
}

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
