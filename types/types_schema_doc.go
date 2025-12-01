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
	Id               uuid.UUID             `json:"id"`
	DocumentId       uuid.UUID             `json:"documentId"`
	PageIdTakeHeader pgtype.UUID           `json:"pageIdTakeHeader"` // page to inherit header from
	PageIdTakeFooter pgtype.UUID           `json:"pageIdTakeFooter"` // page to inherit footer from
	Fields           []any                 `json:"fields"`
	Size             string                `json:"size"` // "A1", "A2", "A3", "A4", "A5", "A6", "A7", "Letter", "Legal"
	Margin           DocumentMarginPadding `json:"margin"`
	Orientation      string                `json:"orientation"` // "landscape" / "portrait"
	Set              []DocumentSet         `json:"set"`         // overwrites
	SetByData        []DocumentSetByData   `json:"setByData"`   // overwrites by resolved attribute data

	// header
	HeaderActive bool            `json:"headerActive"` // use header?
	HeaderFields []DocumentField `json:"headerFields"`
	HeaderHeight int             `json:"headerHeight"` // height in mm

	// footer
	FooterActive bool            `json:"footerActive"` // use footer?
	FooterFields []DocumentField `json:"footerFields"`
	FooterHeight int             `json:"footerHeight"` // height in mm
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
	DirVert bool                  `json:"dirVert"` // vertical flow?
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
type DocumentBorder struct {
	Cell  bool    `json:"cell"`  // also draw cell borders - only relevant in tables
	Color string  `json:"color"` // RGB HEX value, like "000000"
	Draw  string  `json:"draw"`  // "" (none), "1" (all), "L", "T", "R", "B" - can be comined like "LT" or "RB"
	Size  float64 `json:"size"`  // border thickness
}
type DocumentFont struct {
	Align      string  `json:"align"`      // text: "L", "R", "J" (left, right, justify), column: "L", "C", "R" (left, center, right) &  "T", "M", "B" (top, middle, bottom)
	Color      string  `json:"color"`      // RGB HEX value, like "000000"
	Family     string  `json:"family"`     // "Courier", "Helvetica", "Arial", "Times"
	LineFactor float64 `json:"lineFactor"` // line height factor in % of font size (125% = font height * 1.25)
	Size       float64 `json:"size"`       // font size in points
	Style      string  `json:"style"`      // "B" (bold), "I" (italic), "U" (underscore), "S" (strike-out)
}
type DocumentMarginPadding struct {
	L float64 `json:"l"` // margin in mm
	T float64 `json:"t"` // margin in mm
	R float64 `json:"r"` // margin in mm
	B float64 `json:"b"` // margin in mm
}
type DocumentSet struct {
	Target string `json:"target"` // overwrite target (font.family, margin.r, padding.l, grid.posX, etc.)
	Value  any    `json:"value"`  // overwrite value
}
type DocumentSetByData struct {
	AttributeId uuid.UUID `json:"attributeId"` // overwrite by attribute value
	Index       int       `json:"index"`       // overwrite by attribute value
	Target      string    `json:"target"`      // overwrite target (font.family, margin.r, padding.l, grid.posX, etc.)
}
