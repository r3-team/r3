package repo

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"r3/config"
	"r3/tools"

	"github.com/gofrs/uuid"
)

// attribute ID of lsw_repo, module_release->file
var fileAttributeId = "b28e8f5c-ebeb-4565-941b-4d942eedc588"

func Download(fileId uuid.UUID) (string, error) {

	baseUrl := config.GetString("repoUrl")
	skipVerify := config.GetUint64("repoSkipVerify") == 1

	// get authentication token
	token, err := getToken(baseUrl)
	if err != nil {
		return "", err
	}

	// get module file
	fileUrl := fmt.Sprintf("%s/data/download/file.zip?attribute_id=%s&file_id=%s&token=%s",
		baseUrl, fileAttributeId, fileId, token)

	httpClient, err := config.GetHttpClient(skipVerify, 30)
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
