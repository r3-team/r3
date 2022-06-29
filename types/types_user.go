package types

import "github.com/jackc/pgtype"

type Settings struct {
	BordersAll        bool           `json:"bordersAll"`
	BordersCorner     string         `json:"bordersCorner"`
	Compact           bool           `json:"compact"`
	DateFormat        string         `json:"dateFormat"`
	Dark              bool           `json:"dark"`
	FontFamily        string         `json:"fontFamily"`
	FontSize          int            `json:"fontSize"`
	HeaderCaptions    bool           `json:"headerCaptions"`
	HintUpdateVersion int            `json:"hintUpdateVersion"`
	LanguageCode      string         `json:"languageCode"`
	MenuColored       bool           `json:"menuColored"`
	MobileScrollForm  bool           `json:"mobileScrollForm"`
	PageLimit         int            `json:"pageLimit"`
	Pattern           pgtype.Varchar `json:"pattern"`
	Spacing           int            `json:"spacing"`
	SundayFirstDow    bool           `json:"sundayFirstDow"`
	WarnUnsaved       bool           `json:"warnUnsaved"`
}
