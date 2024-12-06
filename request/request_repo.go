package request

import (
	"context"
	"encoding/json"
	"r3/db"
	"r3/repo"
	"r3/transfer"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func RepoModuleGet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var (
		err error
		req struct {
			ByString     string `json:"byString"`
			LanguageCode string `json:"languageCode"`
			Limit        int    `json:"limit"`
			Offset       int    `json:"offset"`
			GetInstalled bool   `json:"getInstalled"`
			GetNew       bool   `json:"getNew"`
			GetInStore   bool   `json:"getInStore"`
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

func RepoModuleInstall(reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		FileId uuid.UUID `json:"fileId"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	filePath, err := repo.Download(req.FileId)
	if err != nil {
		return nil, err
	}
	return nil, transfer.ImportFromFiles([]string{filePath})
}

func RepoModuleInstallAll() (interface{}, error) {

	// get all files to be updated from repository
	fileIds := make([]uuid.UUID, 0)
	filePaths := make([]string, 0)

	if err := db.Pool.QueryRow(context.Background(), `
		SELECT ARRAY_AGG(rm.file)
		FROM app.module AS m
		INNER JOIN instance.repo_module AS rm ON rm.module_id_wofk = m.id
		WHERE rm.release_build > m.release_build
	`).Scan(&fileIds); err != nil {
		return nil, err
	}

	for _, fileId := range fileIds {
		filePath, err := repo.Download(fileId)
		if err != nil {
			return nil, err
		}
		filePaths = append(filePaths, filePath)
	}
	return nil, transfer.ImportFromFiles(filePaths)
}

func RepoModuleUpdate() (interface{}, error) {
	return nil, repo.Update()
}
