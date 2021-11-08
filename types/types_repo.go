package types

import (
	"github.com/gofrs/uuid"
	"github.com/jackc/pgtype"
)

type RepoModule struct {
	ModuleId         uuid.UUID                 `json:"moduleId"`
	FileId           uuid.UUID                 `json:"fileId"`
	Name             string                    `json:"name"`
	ChangeLog        pgtype.Varchar            `json:"changeLog"`
	Author           string                    `json:"author"`
	InStore          bool                      `json:"inStore"`
	ReleaseBuild     int                       `json:"releaseBuild"`
	ReleaseBuildApp  int                       `json:"releaseBuildApp"`
	ReleaseDate      int                       `json:"releaseDate"`
	LanguageCodeMeta map[string]RepoModuleMeta `json:"languageCodeMeta"`
}

type RepoModuleMeta struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	SupportPage string `json:"supportPage"`
}
