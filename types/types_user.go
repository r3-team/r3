package types

type Settings struct {
	BordersAll        bool   `json:"bordersAll"`
	BordersCorner     string `json:"bordersCorner"`
	Compact           bool   `json:"compact"`
	DateFormat        string `json:"dateFormat"`
	Dark              bool   `json:"dark"`
	FontSize          int    `json:"fontSize"`
	HeaderCaptions    bool   `json:"headerCaptions"`
	HintFirstSteps    bool   `json:"hintFirstSteps"`
	HintUpdateVersion int    `json:"hintUpdateVersion"`
	LanguageCode      string `json:"languageCode"`
	PageLimit         int    `json:"pageLimit"`
	Spacing           int    `json:"spacing"`
	SundayFirstDow    bool   `json:"sundayFirstDow"`
	WarnUnsaved       bool   `json:"warnUnsaved"`
}
