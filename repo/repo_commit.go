package repo

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"r3/cache"
	"r3/config"
	"r3/handler"
	"r3/tools"
	"r3/transfer"
	"r3/types"
	"strings"

	"github.com/gofrs/uuid"
)

const moduleReleaseFileId string = "b28e8f5c-ebeb-4565-941b-4d942eedc588"

type moduleReleaseNewCheckReponse struct {
	Module struct {
		ModuleId    int64 `json:"module_id"`
		ModuleBuild int64 `json:"module_build"`
	} `json:"0(module_release)"`
}

func RepoCommit(ctx context.Context, loginId int64, repoId uuid.UUID, credUser, credPass string, moduleId uuid.UUID, fileName string) error {

	repo, err := cache.GetRepoById(repoId)
	if err != nil {
		return err
	}

	exportKey, err := cache.GetExportKey(loginId)
	if err != nil {
		return err
	}

	token, err := httpGetAuthToken(repo.Url, credUser, credPass, repo.SkipVerify)
	if err != nil {
		return err
	}

	// check current module release
	repoModuleId, repoModuleBuild, err := repoCommitCheck(repo.Url, repo.SkipVerify, token, moduleId)
	if err != nil {
		return err
	}

	// build delta version log
	cache.Schema_mx.RLock()
	mod, exists := cache.ModuleIdMap[moduleId]
	cache.Schema_mx.RUnlock()

	if !exists {
		return handler.ErrSchemaUnknownModule(moduleId)
	}

	if repoModuleBuild >= int64(mod.ReleaseBuild) {
		return handler.CreateErrCodeWithData(handler.ErrContextTrf, handler.ErrCodeTrfRepoCommitBuildOld, struct {
			BuildLocal int64 `json:"buildLocal"`
			BuildRepo  int64 `json:"buildRepo"`
		}{
			int64(mod.ReleaseBuild),
			repoModuleBuild,
		})
	}

	categoryIndexMapLogs := make(map[int][]string)
	for i := range mod.ReleaseLogCategories {
		categoryIndexMapLogs[i] = make([]string, 0)
	}
	for _, r := range mod.Releases {
		if r.Build <= repoModuleBuild {
			continue
		}

		for _, l := range r.Logs {
			if l.Category >= len(mod.ReleaseLogCategories) {
				continue
			}
			categoryIndexMapLogs[l.Category] = append(categoryIndexMapLogs[l.Category], l.Content)
		}
	}

	var logHtml strings.Builder
	var logHide bool = true

	logHtml.WriteString("<ul>")
	for i, logs := range categoryIndexMapLogs {
		if len(logs) == 0 {
			continue
		}
		logHtml.WriteString(fmt.Sprintf("<li>%s<ul><li>%s</li></ul></li>", mod.ReleaseLogCategories[i], strings.Join(logs, "</li><li>")))
		logHide = false
	}
	logHtml.WriteString("</ul>")

	if logHide {
		logHtml.Reset()
	}

	// export module file
	filePath, err := tools.GetUniqueFilePath(config.File.Paths.Temp, 8999999, 9999999)
	if err != nil {
		return err
	}

	if err := transfer.ExportToFile(ctx, moduleId, exportKey, filePath); err != nil {
		return err
	}

	// upload module file
	fileId, err := repoCommitUploadFile(repo.Url, repo.SkipVerify, token, filePath, fileName)
	if err != nil {
		return err
	}

	// upload module release with module file
	return repoCommitAttach(repo.Url, repo.SkipVerify, token, repoModuleId, mod, fileId, fileName, logHtml.String(), logHide)
}

func repoCommitAttach(baseUrl string, skipVerify bool, token string, repoModuleId int64,
	mod types.Module, fileId uuid.UUID, fileName string, log string, logHide bool) error {

	url, err := url.JoinPath(baseUrl, "api/lsw_repo/module_release_new_commit/v1")
	if err != nil {
		return err
	}

	type releaseRequest struct {
		ModuleId      int64                    `json:"module_id"`
		ModuleBuild   int64                    `json:"module_build"`
		PlatformBuild int64                    `json:"platform_build"`
		ReleaseDate   int64                    `json:"release_date"`
		Log           string                   `json:"log"`
		LogHide       bool                     `json:"log_hide"`
		File          types.DataSetFileChanges `json:"file"`
	}

	var res any
	var req = struct {
		Release releaseRequest `json:"0(module_release)"`
	}{
		Release: releaseRequest{
			ModuleId:      repoModuleId,
			ModuleBuild:   int64(mod.ReleaseBuild),
			PlatformBuild: int64(mod.ReleaseBuildApp),
			ReleaseDate:   mod.ReleaseDate,
			Log:           log,
			LogHide:       logHide,
			File: types.DataSetFileChanges{
				FileIdMapChange: map[uuid.UUID]types.DataSetFileChange{
					fileId: {
						Action:  "create",
						Name:    fileName,
						Version: 0,
					},
				},
			},
		},
	}
	return httpCallPost(token, url, skipVerify, req, &res)
}

func repoCommitCheck(baseUrl string, skipVerify bool, token string, moduleId uuid.UUID) (int64, int64, error) {

	urlCheckStr, err := url.JoinPath(baseUrl, "api/lsw_repo/module_release_new_check/v1")
	if err != nil {
		return 0, 0, err
	}
	urlCheckParams := url.Values{}
	urlCheckParams.Add("module_id", moduleId.String())
	urlCheck, err := url.Parse(urlCheckStr)
	if err != nil {
		return 0, 0, err
	}
	urlCheck.RawQuery = urlCheckParams.Encode()

	// check current module release
	var res []moduleReleaseNewCheckReponse
	if err := httpCallGet(token, urlCheck.String(), skipVerify, "", &res); err != nil {
		return 0, 0, err
	}
	if len(res) == 0 {
		return 0, 0, handler.CreateErrCode(handler.ErrContextTrf, handler.ErrCodeTrfRepoCommitNoApp)
	}
	if len(res) > 1 {
		return 0, 0, handler.CreateErrCode(handler.ErrContextTrf, handler.ErrCodeTrfRepoCommitTooManyApps)
	}
	return res[0].Module.ModuleId, res[0].Module.ModuleBuild, nil
}

func repoCommitUploadFile(baseUrl string, skipVerify bool, token, filePath, fileName string) (uuid.UUID, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return uuid.Nil, err
	}
	defer file.Close()

	// write content
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	if err := writer.WriteField("token", token); err != nil {
		return uuid.Nil, err
	}
	if err := writer.WriteField("attributeId", moduleReleaseFileId); err != nil {
		return uuid.Nil, err
	}
	if err := writer.WriteField("fileId", uuid.Nil.String()); err != nil {
		return uuid.Nil, err
	}
	part, err := writer.CreateFormFile("file", fileName)
	if err != nil {
		return uuid.Nil, err
	}
	if _, err := io.Copy(part, file); err != nil {
		return uuid.Nil, err
	}
	if err := writer.Close(); err != nil {
		return uuid.Nil, err
	}

	// execute request
	url, err := url.JoinPath(baseUrl, "data/upload")
	if err != nil {
		return uuid.Nil, err
	}

	httpReq, err := http.NewRequest("POST", url, body)
	if err != nil {
		return uuid.Nil, err
	}
	httpReq.Header.Set("User-Agent", "r3-application")
	httpReq.Header.Add("Content-Type", writer.FormDataContentType())

	httpClient, err := config.GetHttpClient(skipVerify, 10)
	if err != nil {
		return uuid.Nil, err
	}

	httpRes, err := httpClient.Do(httpReq)
	if err != nil {
		return uuid.Nil, err
	}
	defer httpRes.Body.Close()

	if httpRes.StatusCode != http.StatusOK {
		return uuid.Nil, httpErrorGetMsg(httpRes)
	}

	// parse response
	bodyRaw, err := io.ReadAll(httpRes.Body)
	if err != nil {
		return uuid.Nil, err
	}
	var res struct {
		Id uuid.UUID `json:"id"`
	}
	if err := json.Unmarshal(bodyRaw, &res); err != nil {
		return uuid.Nil, err
	}
	return res.Id, nil
}
