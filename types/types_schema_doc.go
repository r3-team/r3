package types

import (
	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type Doc struct {
	Id      uuid.UUID  `json:"id"`
	Name    uuid.UUID  `json:"name"`
	Comment uuid.UUID  `json:"comment"`
	Font    DocFont    `json:"font"`
	Pages   []DocPage  `json:"pages"` // pages in order
	Query   Query      `json:"query"`
	States  []DocState `json:"states"`
	Set     []DocSet   `json:"set"` // overwrites

	// meta
	Author       string `json:"author"`
	LanguageCode string `json:"languageCode"`
	Title        string `json:"title"`
}
type DocPage struct {
	Id          uuid.UUID        `json:"id"`
	DocId       uuid.UUID        `json:"docId"`
	FieldFlow   DocFieldFlow     `json:"fieldFlow"`
	Size        string           `json:"size"` // "A1", "A2", "A3", "A4", "A5", "A6", "A7", "Letter", "Legal"
	Margin      DocMarginPadding `json:"margin"`
	Header      DocHeaderFooter  `json:"header"`
	Footer      DocHeaderFooter  `json:"footer"`
	Orientation string           `json:"orientation"` // "landscape" / "portrait"
	Set         []DocSet         `json:"set"`         // overwrites
	State       bool             `json:"state"`
}
type DocBorder struct {
	Cell  bool    `json:"cell"`  // also draw cell borders - only relevant in tables
	Color string  `json:"color"` // RGB HEX value, like "000000"
	Draw  string  `json:"draw"`  // "" (none), "1" (all), "L", "T", "R", "B" - can be comined like "LT" or "RB"
	Size  float64 `json:"size"`  // border thickness
}
type DocColumn struct {
	AttributeId    uuid.UUID   `json:"attributeId"`
	AttributeIndex int         `json:"attributeIndex"` // attribute index
	GroupBy        bool        `json:"groupBy"`        // group by column attribute value?
	Aggregator     pgtype.Text `json:"aggregator"`     // aggregator (SUM, COUNT, etc.)
	Distincted     bool        `json:"distincted"`     // attribute values are distinct?
	SubQuery       bool        `json:"subQuery"`       // column uses sub query?
	SizeX          float64     `json:"sizeX"`          // width in mm (0 = parent width)
	Query          Query       `json:"query"`          // sub query
	Captions       CaptionMap  `json:"captions"`       // column titles

	// overwrites
	SetBody   []DocSet `json:"setBody"`
	SetFooter []DocSet `json:"setFooter"`
	SetHeader []DocSet `json:"setHeader"`

	// presentation
	Length int `json:"length"` // text length limit (in characters)
}
type DocField struct {
	Id      uuid.UUID `json:"id"`
	Content string    `json:"content"` // "data", "flow", "grid", "gridFooter", "gridHeader", "list", "text"
	PosX    float64   `json:"posX"`    // X position (relative to parent), 0 if in flow parent
	PosY    float64   `json:"posY"`    // Y position (relative to parent), 0 if in flow parent
	SizeX   float64   `json:"sizeX"`   // width in mm (0 = parent width)
	SizeY   float64   `json:"sizeY"`   // height in mm (0 = min. content height)
	Set     []DocSet  `json:"set"`
	State   bool      `json:"state"`
	Border  DocBorder `json:"border"`
}
type DocFieldData struct {
	Id      uuid.UUID `json:"id"`
	Content string    `json:"content"`
	PosX    float64   `json:"posX"`
	PosY    float64   `json:"posY"`
	SizeX   float64   `json:"sizeX"`
	SizeY   float64   `json:"sizeY"`
	Set     []DocSet  `json:"set"`
	State   bool      `json:"state"`
	Border  DocBorder `json:"border"`

	// data field
	AttributeId    uuid.UUID `json:"attributeId"`
	AttributeIndex int       `json:"attributeIndex"`
}
type DocFieldFlow struct {
	Id      uuid.UUID `json:"id"`
	Content string    `json:"content"`
	PosX    float64   `json:"posX"`
	PosY    float64   `json:"posY"`
	SizeX   float64   `json:"sizeX"`
	SizeY   float64   `json:"sizeY"`
	Set     []DocSet  `json:"set"`
	State   bool      `json:"state"`
	Border  DocBorder `json:"border"`

	// flow field
	Fields  []any            `json:"fields"`
	Gap     float64          `json:"gap"` // space between flow children
	Padding DocMarginPadding `json:"padding"`
}
type DocFieldGrid struct {
	Id      uuid.UUID `json:"id"`
	Content string    `json:"content"`
	PosX    float64   `json:"posX"`
	PosY    float64   `json:"posY"`
	SizeX   float64   `json:"sizeX"`
	SizeY   float64   `json:"sizeY"`
	Set     []DocSet  `json:"set"`
	State   bool      `json:"state"`
	Border  DocBorder `json:"border"`

	// grid field
	Fields []any `json:"fields"`
	Shrink bool  `json:"shrink"` // shrink if content does not fill height
}
type DocFieldList struct {
	Id      uuid.UUID `json:"id"`
	Content string    `json:"content"`
	PosX    float64   `json:"posX"`
	PosY    float64   `json:"posY"`
	SizeX   float64   `json:"sizeX"`
	SizeY   float64   `json:"sizeY"`
	Set     []DocSet  `json:"set"`
	State   bool      `json:"state"`
	Border  DocBorder `json:"border"`

	// list field
	HeaderBorder      DocBorder   `json:"headerBorder"`
	HeaderColorFill   pgtype.Text `json:"headerColorFill"`
	HeaderRepeat      bool        `json:"headerRepeat"`
	BodyBorder        DocBorder   `json:"bodyBorder"`
	BodyColorFillEven pgtype.Text `json:"bodyColorFillEven"`
	BodyColorFillOdd  pgtype.Text `json:"bodyColorFillOdd"`
	FooterBorder      DocBorder   `json:"footerBorder"`
	FooterColorFill   pgtype.Text `json:"footerColorFill"`

	Columns []DocColumn      `json:"columns"`
	Padding DocMarginPadding `json:"padding"`
	Query   Query            `json:"query"`
}
type DocFieldText struct {
	Id      uuid.UUID `json:"id"`
	Content string    `json:"content"`
	PosX    float64   `json:"posX"`
	PosY    float64   `json:"posY"`
	SizeX   float64   `json:"sizeX"`
	SizeY   float64   `json:"sizeY"`
	Set     []DocSet  `json:"set"`
	State   bool      `json:"state"`
	Border  DocBorder `json:"border"`

	// text field
	Value string `json:"value"`
}
type DocHeaderFooter struct {
	Active        bool         `json:"active"`        // true if header/footer is enabled at all (not stored in DB, resolved based on stored data)
	PageIdInherit pgtype.UUID  `json:"pageIdInherit"` // page to inherit header/footer from (instead of its own definition)
	FieldGrid     DocFieldGrid `json:"fieldGrid"`     // header/footer only ever have a fixed grid field of their internal size (if they need flow, they can add a flow field)
}
type DocFont struct {
	Align        string  `json:"align"`        // text: "L", "R", "J" (left, right, justify), column: "L", "C", "R" (left, center, right) &  "T", "M", "B" (top, middle, bottom)
	BoolFalse    string  `json:"boolFalse"`    // string representing bool FALSE
	BoolTrue     string  `json:"boolTrue"`     // string representing bool TRUE
	Color        string  `json:"color"`        // RGB HEX value, like "000000"
	DateFormat   string  `json:"dateFormat"`   // date format, such as 'Y-m-d'
	Family       string  `json:"family"`       // "cousine", "roboto", ...
	LineFactor   float64 `json:"lineFactor"`   // line height factor in % of font size
	NumberSepDec string  `json:"numberSepDec"` // number decimal separator
	NumberSepTho string  `json:"numberSepTho"` // number thousand separator
	Size         float64 `json:"size"`         // font size in mm
	Style        string  `json:"style"`        // "B" (bold), "I" (italic), "U" (underscore), "S" (strike-out)
}
type DocMarginPadding struct {
	L float64 `json:"l"` // margin in mm
	T float64 `json:"t"` // margin in mm
	R float64 `json:"r"` // margin in mm
	B float64 `json:"b"` // margin in mm
}
type DocSet struct {
	AttributeId    pgtype.UUID `json:"attributeId"`    // overwrite by attribute value
	AttributeIndex pgtype.Int4 `json:"attributeIndex"` // overwrite by attribute value
	Target         string      `json:"target"`         // overwrite target (font.family, margin.r, etc.)
	Value          any         `json:"value"`          // overwrite value
}
type DocState struct {
	Id          uuid.UUID           `json:"id"`
	Description string              `json:"description"` // builder reference, used to order and search by
	Conditions  []DocStateCondition `json:"conditions"`  // conditions to be met for effects to be applied
	Effects     []DocStateEffect    `json:"effects"`     // effects to apply when conditions are met
}
type DocStateCondition struct {
	Position  int                   `json:"position"`
	Connector string                `json:"connector"` // AND, OR
	Operator  string                `json:"operator"`  // comparison operator (=, <>, etc.)
	Side0     DocStateConditionSide `json:"side0"`     // comparison: left side
	Side1     DocStateConditionSide `json:"side1"`     // comparison: right side
}
type DocStateConditionSide struct {
	Brackets       int         `json:"brackets"`       // opening/closing brackets (side 0/1)
	Content        string      `json:"content"`        // attribute, preset, true, value
	AttributeId    pgtype.UUID `json:"attributeId"`    // attribute ID to retrieve value for
	AttributeIndex pgtype.Int4 `json:"attributeIndex"` // attribute index to retrieve value for
	PresetId       pgtype.UUID `json:"presetId"`       // preset ID of record to be compared
	Value          pgtype.Text `json:"value"`          // fixed value, can be anything including NULL
}
type DocStateEffect struct {
	FieldId  pgtype.UUID `json:"fieldId"`  // affected field
	PageId   pgtype.UUID `json:"pageId"`   // affected page
	NewState bool        `json:"newState"` // show or no-show
}
