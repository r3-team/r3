package types

import (
	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type Document struct {
	Id        uuid.UUID           `json:"id"`
	Font      DocumentFont        `json:"font"`
	Pages     []DocumentPage      `json:"pages"` // pages in order
	Query     Query               `json:"query"`
	SetByData []DocumentSetByData `json:"setByData"` // overwrites by resolved attribute data

	// meta
	Author       string `json:"author"`
	LanguageCode string `json:"languageCode"`
	Title        string `json:"title"`
}
type DocumentPage struct {
	Id          uuid.UUID             `json:"id"`
	DocumentId  uuid.UUID             `json:"documentId"`
	FieldFlow   DocumentFieldFlow     `json:"fieldFlow"`
	Size        string                `json:"size"` // "A1", "A2", "A3", "A4", "A5", "A6", "A7", "Letter", "Legal"
	Margin      DocumentMarginPadding `json:"margin"`
	Header      DocumentHeaderFooter  `json:"header"`
	Footer      DocumentHeaderFooter  `json:"footer"`
	Orientation string                `json:"orientation"` // "landscape" / "portrait"
	Set         []DocumentSet         `json:"set"`         // overwrites
	SetByData   []DocumentSetByData   `json:"setByData"`   // overwrites by resolved attribute data
}
type DocumentBorder struct {
	Cell  bool    `json:"cell"`  // also draw cell borders - only relevant in tables
	Color string  `json:"color"` // RGB HEX value, like "000000"
	Draw  string  `json:"draw"`  // "" (none), "1" (all), "L", "T", "R", "B" - can be comined like "LT" or "RB"
	Size  float64 `json:"size"`  // border thickness
}
type DocumentColumn struct {
	AttributeId uuid.UUID   `json:"attributeId"`
	Index       int         `json:"index"`      // attribute index
	GroupBy     bool        `json:"groupBy"`    // group by column attribute value?
	Aggregator  pgtype.Text `json:"aggregator"` // aggregator (SUM, COUNT, etc.)
	Distincted  bool        `json:"distincted"` // attribute values are distinct?
	SubQuery    bool        `json:"subQuery"`   // column uses sub query?
	SizeWidth   float64     `json:"sizeWidth"`  // width in mm (0 = parent width)
	Query       Query       `json:"query"`      // sub query
	Captions    CaptionMap  `json:"captions"`   // column titles

	SetHeader       []DocumentSet       `json:"setHeader"`
	SetHeaderByData []DocumentSetByData `json:"setHeaderByData"`
	SetBody         []DocumentSet       `json:"setBody"`
	SetBodyByData   []DocumentSetByData `json:"setBodyByData"`
	SetFooter       []DocumentSet       `json:"setFooter"`
	SetFooterByData []DocumentSetByData `json:"setFooterByData"`

	// presentation
	//Batch  pgtype.Int4 `json:"batch"`  // index of column batch (multiple columns as one)
	Length int `json:"length"` // text length limit (in characters)
}
type DocumentField struct {
	Id         uuid.UUID           `json:"id"`
	Content    string              `json:"content"`    // "text", "flow", "grid", "data", "list"
	PosX       float64             `json:"posX"`       // X position (relative to parent), 0 if in flow parent
	PosY       float64             `json:"posY"`       // Y position (relative to parent), 0 if in flow parent
	SizeHeight float64             `json:"sizeHeight"` // height in mm (0 = min. content height)
	SizeWidth  float64             `json:"sizeWidth"`  // width in mm (0 = parent width)
	Set        []DocumentSet       `json:"set"`
	SetByData  []DocumentSetByData `json:"setByData"`
	Border     DocumentBorder      `json:"border"`
}
type DocumentFieldData struct {
	Id         uuid.UUID           `json:"id"`
	Content    string              `json:"content"`
	PosX       float64             `json:"posX"`
	PosY       float64             `json:"posY"`
	SizeHeight float64             `json:"sizeHeight"`
	SizeWidth  float64             `json:"sizeWidth"`
	Set        []DocumentSet       `json:"set"`
	SetByData  []DocumentSetByData `json:"setByData"`
	Border     DocumentBorder      `json:"border"`

	// data field
	AttributeId uuid.UUID `json:"attributeId"`
	Index       int       `json:"index"`
}
type DocumentFieldFlow struct {
	Id         uuid.UUID           `json:"id"`
	Content    string              `json:"content"`
	PosX       float64             `json:"posX"`
	PosY       float64             `json:"posY"`
	SizeHeight float64             `json:"sizeHeight"`
	SizeWidth  float64             `json:"sizeWidth"`
	Set        []DocumentSet       `json:"set"`
	SetByData  []DocumentSetByData `json:"setByData"`
	Border     DocumentBorder      `json:"border"`

	// flow field
	Fields  []any                 `json:"fields"`
	Gap     float64               `json:"gap"` // space between flow children
	Padding DocumentMarginPadding `json:"padding"`
}
type DocumentFieldGrid struct {
	Id         uuid.UUID           `json:"id"`
	Content    string              `json:"content"`
	PosX       float64             `json:"posX"`
	PosY       float64             `json:"posY"`
	SizeHeight float64             `json:"sizeHeight"`
	SizeWidth  float64             `json:"sizeWidth"`
	Set        []DocumentSet       `json:"set"`
	SetByData  []DocumentSetByData `json:"setByData"`
	Border     DocumentBorder      `json:"border"`

	// grid field
	Fields []any `json:"fields"`
	Shrink bool  `json:"shrink"` // shrink if content does not fill height
}
type DocumentFieldList struct {
	Id         uuid.UUID           `json:"id"`
	Content    string              `json:"content"`
	PosX       float64             `json:"posX"`
	PosY       float64             `json:"posY"`
	SizeHeight float64             `json:"sizeHeight"`
	SizeWidth  float64             `json:"sizeWidth"`
	Set        []DocumentSet       `json:"set"`
	SetByData  []DocumentSetByData `json:"setByData"`
	Border     DocumentBorder      `json:"border"`

	// list field
	HeaderBorder      DocumentBorder `json:"headerBorder"`
	HeaderColorFill   string         `json:"headerColorFill"`
	HeaderRepeat      bool           `json:"headerRepeat"`
	BodyBorder        DocumentBorder `json:"bodyBorder"`
	BodyColorFillEven string         `json:"bodyColorFillEven"`
	BodyColorFillOdd  string         `json:"bodyColorFillOdd"`
	FooterBorder      DocumentBorder `json:"footerBorder"`
	FooterColorFill   string         `json:"footerColorFill"`

	Columns []DocumentColumn      `json:"columns"`
	Padding DocumentMarginPadding `json:"padding"`
	Query   Query                 `json:"query"`
}
type DocumentFieldText struct {
	Id         uuid.UUID           `json:"id"`
	Content    string              `json:"content"`
	PosX       float64             `json:"posX"`
	PosY       float64             `json:"posY"`
	SizeHeight float64             `json:"sizeHeight"`
	SizeWidth  float64             `json:"sizeWidth"`
	Set        []DocumentSet       `json:"set"`
	SetByData  []DocumentSetByData `json:"setByData"`
	Border     DocumentBorder      `json:"border"`

	// text field
	Value string `json:"value"`
}
type DocumentHeaderFooter struct {
	PageIdInherit pgtype.UUID       `json:"pageIdInherit"` // page to inherit header/footer from (instead of its own definition)
	FieldGrid     DocumentFieldGrid `json:"fieldGrid"`     // header/footer only ever have a fixed grid field of their internal size (if they need flow, they can add a flow field)
}
type DocumentFont struct {
	Align        string  `json:"align"`        // text: "L", "R", "J" (left, right, justify), column: "L", "C", "R" (left, center, right) &  "T", "M", "B" (top, middle, bottom)
	BoolFalse    string  `json:"boolFalse"`    // string representing bool FALSE
	BoolTrue     string  `json:"boolTrue"`     // string representing bool TRUE
	Color        string  `json:"color"`        // RGB HEX value, like "000000"
	Family       string  `json:"family"`       // "cousine", "roboto", ...
	FormatDate   string  `json:"formatDate"`   // date format, such as 'Y-m-d'
	LineFactor   float64 `json:"lineFactor"`   // line height factor in % of font size
	NumberSepDec string  `json:"numberSepDec"` // number decimal separator
	NumberSepTho string  `json:"numberSepTho"` // number thousand separator
	Size         float64 `json:"size"`         // font size in mm
	Style        string  `json:"style"`        // "B" (bold), "I" (italic), "U" (underscore), "S" (strike-out)
}
type DocumentMarginPadding struct {
	L float64 `json:"l"` // margin in mm
	T float64 `json:"t"` // margin in mm
	R float64 `json:"r"` // margin in mm
	B float64 `json:"b"` // margin in mm
}
type DocumentSet struct {
	Target string `json:"target"` // overwrite target (font.family, margin.r, etc.)
	Value  any    `json:"value"`  // overwrite value
}
type DocumentSetByData struct {
	AttributeId uuid.UUID `json:"attributeId"` // overwrite by attribute value
	Index       int       `json:"index"`       // overwrite by attribute value
	Target      string    `json:"target"`      // overwrite target (font.family, margin.r, etc.)
}
