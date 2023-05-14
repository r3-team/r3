package types

import "github.com/jackc/pgx/v5/pgtype"

type Settings struct {
	BordersAll         bool        `json:"bordersAll"`
	BordersCorner      string      `json:"bordersCorner"`
	Compact            bool        `json:"compact"`
	DateFormat         string      `json:"dateFormat"`
	Dark               bool        `json:"dark"`
	FieldClean         bool        `json:"fieldClean"`
	FontFamily         string      `json:"fontFamily"`
	FontSize           int         `json:"fontSize"`
	HeaderCaptions     bool        `json:"headerCaptions"`
	HintUpdateVersion  int         `json:"hintUpdateVersion"`
	LanguageCode       string      `json:"languageCode"`
	MenuColored        bool        `json:"menuColored"`
	MobileScrollForm   bool        `json:"mobileScrollForm"`
	PageLimit          int         `json:"pageLimit"`
	Pattern            pgtype.Text `json:"pattern"`
	SearchDictionaries []string    `json:"searchDictionaries"`
	Spacing            int         `json:"spacing"`
	SundayFirstDow     bool        `json:"sundayFirstDow"`
	TabRemember        bool        `json:"tabRemember"`
	WarnUnsaved        bool        `json:"warnUnsaved"`
}
