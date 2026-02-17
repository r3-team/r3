package types

import (
	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type Repo struct {
	Id             uuid.UUID `json:"id"`
	Name           string    `json:"name"`
	DateChecked    int64     `json:"dateChecked"`
	FeedbackEnable bool      `json:"feedbackEnable"`
	FetchUserName  string    `json:"fetchUserName"`
	FetchUserPass  string    `json:"fetchUserPass"`
	SkipVerify     bool      `json:"skipVerify"`
	Url            string    `json:"url"`
	Active         bool      `json:"active"`
}
type RepoFeedback struct {
	Id   uuid.UUID `json:"id"`
	Name string    `json:"name"`
	Url  string    `json:"url"`
}

type RepoModule struct {
	// module meta data
	ModuleId  uuid.UUID   `json:"moduleId"`
	Name      string      `json:"name"`
	ChangeLog pgtype.Text `json:"changeLog"`
	Author    string      `json:"author"`
	InStore   bool        `json:"inStore"`

	// meta data of latest module release
	FileId          uuid.UUID `json:"fileId"`
	ReleaseBuild    int       `json:"releaseBuild"`    // module version
	ReleaseBuildApp int       `json:"releaseBuildApp"` // platform version
	ReleaseDate     int64     `json:"releaseDate"`

	// translated meta data
	LanguageCodeMeta map[string]RepoModuleMeta `json:"languageCodeMeta"` // key = language code (en_us, de_de, ...)
}

type RepoModuleMeta struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	SupportPage string `json:"supportPage"`
}
