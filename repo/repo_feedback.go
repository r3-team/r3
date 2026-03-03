package repo

import (
	"fmt"
	"r3/cache"
	"r3/config"
	"r3/handler"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func SendFeedback(isAdmin bool, moduleRelated bool, repoId uuid.UUID, moduleId pgtype.UUID, formId pgtype.UUID, mood int, code int, text string) error {

	releaseBuild := 0
	if moduleId.Valid {
		cache.Schema_mx.RLock()
		module, exists := cache.ModuleIdMap[moduleId.Bytes]
		cache.Schema_mx.RUnlock()

		if !exists {
			return handler.ErrSchemaUnknownModule(moduleId.Bytes)
		}
		releaseBuild = module.ReleaseBuild
	}

	repo, err := cache.GetRepoById(repoId)
	if err != nil {
		return err
	}
	token, err := httpGetAuthToken(repo.Url, repo.FetchUserName, repo.FetchUserPass, repo.SkipVerify)
	if err != nil {
		return err
	}

	// send feedback
	type feedbackRequest struct {
		IsAdmin         bool        `json:"is_admin"`
		ModuleRelated   bool        `json:"module_related"`
		ModuleUuid      pgtype.UUID `json:"module_uuid"`
		FormUuid        pgtype.UUID `json:"form_uuid"`
		Mood            int         `json:"mood"`
		Code            int         `json:"code"`
		ReleaseBuild    int         `json:"release_build"`
		ReleaseBuildApp int         `json:"release_build_app"`
		Text            string      `json:"text"`
		InstanceUuid    string      `json:"instance_uuid"`
	}

	var req = struct {
		Feedback feedbackRequest `json:"0(feedback)"`
	}{
		Feedback: feedbackRequest{
			IsAdmin:         isAdmin,
			ModuleRelated:   moduleRelated,
			ModuleUuid:      moduleId,
			FormUuid:        formId,
			Mood:            mood,
			Code:            code,
			ReleaseBuild:    releaseBuild,
			ReleaseBuildApp: config.GetAppVersion().Build,
			Text:            text,
			InstanceUuid:    config.GetString("instanceId"),
		},
	}

	var res any
	return httpCallPost(token, fmt.Sprintf("%s/api/lsw_repo/feedback/v1", repo.Url), repo.SkipVerify, req, &res)
}
