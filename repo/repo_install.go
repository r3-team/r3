package repo

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"r3/cache"
	"r3/config"
	"r3/db"
	"r3/tools"
	"r3/transfer"

	"github.com/gofrs/uuid"
)

// attribute ID of lsw_repo, module_release->file
var fileAttributeId = "b28e8f5c-ebeb-4565-941b-4d942eedc588"

func InstallModules(ctx context.Context, moduleIds []uuid.UUID) error {

	type repoFile struct {
		FileId uuid.UUID
		RepoId uuid.UUID
	}
	repoFiles := make([]repoFile, 0)

	for _, moduleId := range moduleIds {

		// get file for highest available build version from all active repositories
		var rf repoFile
		if err := db.Pool.QueryRow(ctx, `
			SELECT rm.repo_id, rm.file
			FROM instance.repo_module AS rm
			JOIN instance.repo        AS r  ON r.id = rm.repo_id
			WHERE r.active
			AND   rm.module_id_wofk = $1
			ORDER BY rm.release_build DESC
			LIMIT 1
		`, moduleId).Scan(&rf.RepoId, &rf.FileId); err != nil {
			return err
		}
		repoFiles = append(repoFiles, rf)
	}

	filePaths := make([]string, 0)
	for _, rf := range repoFiles {
		filePath, err := download(rf.RepoId, rf.FileId)
		if err != nil {
			return err
		}
		filePaths = append(filePaths, filePath)
	}
	return transfer.ImportFromFiles(ctx, filePaths)
}

func InstallModulesNewVersions(ctx context.Context) error {

	// get all installed modules, that can be updated from repository
	moduleIds := make([]uuid.UUID, 0)
	if err := db.Pool.QueryRow(ctx, `
		SELECT ARRAY_AGG(m.id)
		FROM app.module           AS m
		JOIN instance.repo_module AS rm ON rm.module_id_wofk = m.id
		JOIN instance.repo        AS r  ON r.id              = rm.repo_id
		WHERE rm.release_build > m.release_build
		AND   r.active
	`).Scan(&moduleIds); err != nil {
		return err
	}
	return InstallModules(ctx, moduleIds)
}

func download(repoId, fileId uuid.UUID) (string, error) {

	repo, err := cache.GetRepoById(repoId)
	if err != nil {
		return "", err
	}
	token, err := httpGetAuthToken(repo.Url, repo.FetchUserName, repo.FetchUserPass, repo.SkipVerify)
	if err != nil {
		return "", err
	}

	// get module file
	fileUrl := fmt.Sprintf("%s/data/download/file.zip?attribute_id=%s&file_id=%s&token=%s",
		repo.Url, fileAttributeId, fileId, token)

	httpClient, err := config.GetHttpClient(repo.SkipVerify, 30)
	if err != nil {
		return "", err
	}

	httpRes, err := httpClient.Get(fileUrl)
	if err != nil {
		return "", err
	}
	defer httpRes.Body.Close()

	if httpRes.StatusCode != http.StatusOK {
		return "", httpErrorGetMsg(httpRes)
	}

	filePath, err := tools.GetUniqueFilePath(config.File.Paths.Temp, 8999999, 9999999)
	if err != nil {
		return "", err
	}

	dst, err := os.Create(filePath)
	if err != nil {
		return "", err
	}
	defer dst.Close()

	if _, err := io.Copy(dst, httpRes.Body); err != nil {
		return "", err
	}
	return filePath, nil
}
