package repo

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"r3/cache"
	"r3/config"
	"r3/tools"

	"github.com/gofrs/uuid"
)

// attribute ID of lsw_repo, module_release->file
var fileAttributeId = "b28e8f5c-ebeb-4565-941b-4d942eedc588"

func Download(repoId, fileId uuid.UUID) (string, error) {

	repo, err := cache.GetRepoById(repoId)
	if err != nil {
		return "", err
	}

	// get authentication token
	token, err := getToken(repo)
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
		return "", fmt.Errorf("non-OK HTTP status code (%d)", httpRes.StatusCode)
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
