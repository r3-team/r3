package types

import "github.com/jackc/pgx/v5/pgtype"

type Settings struct {
	BoolAsIcon         bool        `json:"boolAsIcon"`
	BordersAll         bool        `json:"bordersAll"`
	BordersSquared     bool        `json:"bordersSquared"`
	ColorClassicMode   bool        `json:"colorClassicMode"`
	ColorHeader        pgtype.Text `json:"colorHeader"`
	ColorHeaderSingle  bool        `json:"colorHeaderSingle"`
	ColorMenu          pgtype.Text `json:"colorMenu"`
	DateFormat         string      `json:"dateFormat"`
	Dark               bool        `json:"dark"`
	FontFamily         string      `json:"fontFamily"`
	FontSize           int         `json:"fontSize"`
	HeaderCaptions     bool        `json:"headerCaptions"`
	HeaderModules      bool        `json:"headerModules"`
	HintUpdateVersion  int         `json:"hintUpdateVersion"`
	LanguageCode       string      `json:"languageCode"`
	ListColored        bool        `json:"listColored"`
	ListSpaced         bool        `json:"listSpaced"`
	MobileScrollForm   bool        `json:"mobileScrollForm"`
	NumberSepDecimal   string      `json:"numberSepDecimal"`
	NumberSepThousand  string      `json:"numberSepThousand"`
	PageLimit          int         `json:"pageLimit"`
	Pattern            pgtype.Text `json:"pattern"`
	SearchDictionaries []string    `json:"searchDictionaries"`
	Spacing            int         `json:"spacing"`
	SundayFirstDow     bool        `json:"sundayFirstDow"`
	TabRemember        bool        `json:"tabRemember"`
	WarnUnsaved        bool        `json:"warnUnsaved"`
}
