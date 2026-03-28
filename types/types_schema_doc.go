package types

import (
	"encoding/json"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type Doc struct {
	Id       uuid.UUID  `json:"id"`
	ModuleId uuid.UUID  `json:"moduleId"`
	Name     string     `json:"name"`
	Comment  string     `json:"comment"`
	Filename string     `json:"filename"`
	Font     DocFont    `json:"font"`
	Pages    []DocPage  `json:"pages"` // pages in order
	Query    Query      `json:"query"`
	States   []DocState `json:"states"`
	Sets     []DocSet   `json:"sets"` // overwrites

	// meta
	Author   string     `json:"author"`
	Captions CaptionMap `json:"captions"` // document titles
	Language string     `json:"language"` // language code such as en_us
}
type DocBorder struct {
	Cell      bool        `json:"cell"`      // also draw cell borders - only relevant in tables
	Color     pgtype.Text `json:"color"`     // RGB HEX value, like "000000"
	Draw      string      `json:"draw"`      // "" (none), "1" (all), "L", "T", "R", "B" - can be comined like "LT" or "RB"
	Size      float64     `json:"size"`      // border thickness
	StyleCap  string      `json:"styleCap"`  // "round", "square", "square"
	StyleJoin string      `json:"styleJoin"` // "bevel", "miter", "round"
}
type DocColumn struct {
	Id             uuid.UUID   `json:"id"`
	AttributeId    uuid.UUID   `json:"attributeId"`
	AttributeIndex int         `json:"attributeIndex"` // attribute index
	GroupBy        bool        `json:"groupBy"`        // group by column attribute value?
	Aggregator     pgtype.Text `json:"aggregator"`     // aggregator (SUM, COUNT, etc.) for result content
	AggregatorRow  pgtype.Text `json:"aggregatorRow"`  // aggregator (SUM, COUNT, etc.) for result row
	Distincted     bool        `json:"distincted"`     // attribute values are distinct?
	Length         int         `json:"length"`         // text length limit (in characters)
	SubQuery       bool        `json:"subQuery"`       // column uses sub query?
	SizeX          float64     `json:"sizeX"`          // width in mm (0 = auto calculated based on remaining space)
	TextPostfix    string      `json:"textPostfix"`    // fixed postfix value
	TextPrefix     string      `json:"textPrefix"`     // fixed prefix value
	Query          Query       `json:"query"`          // sub query
	Captions       CaptionMap  `json:"captions"`       // column titles

	// overwrites
	SetsBody   []DocSet `json:"setsBody"`
	SetsFooter []DocSet `json:"setsFooter"`
	SetsHeader []DocSet `json:"setsHeader"`
}
type DocField struct {
	Id      uuid.UUID `json:"id"`
	Content string    `json:"content"` // "data", "flow", "grid", "gridFooter", "gridHeader", "list", "text"
	PosX    float64   `json:"posX"`    // X position (relative to parent), 0 if in flow parent
	PosY    float64   `json:"posY"`    // Y position (relative to parent), 0 if in flow parent
	SizeX   float64   `json:"sizeX"`   // width in mm (0 = parent width)
	SizeY   float64   `json:"sizeY"`   // height in mm (0 = min. content height)
	Sets    []DocSet  `json:"sets"`
	State   bool      `json:"state"` // default visibility state
}
type DocFieldData struct {
	Id      uuid.UUID `json:"id"`
	Content string    `json:"content"`
	PosX    float64   `json:"posX"`
	PosY    float64   `json:"posY"`
	SizeX   float64   `json:"sizeX"`
	SizeY   float64   `json:"sizeY"`
	Sets    []DocSet  `json:"sets"`
	State   bool      `json:"state"`

	// data field
	AttributeId    uuid.UUID `json:"attributeId"`
	AttributeIndex int       `json:"attributeIndex"`
	Length         int       `json:"length"`      // text length limit (in characters)
	TextPostfix    string    `json:"textPostfix"` // fixed postfix value
	TextPrefix     string    `json:"textPrefix"`  // fixed prefix value
}
type DocFieldFlow struct {
	Id      uuid.UUID `json:"id"`
	Content string    `json:"content"`
	PosX    float64   `json:"posX"`
	PosY    float64   `json:"posY"`
	SizeX   float64   `json:"sizeX"`
	SizeY   float64   `json:"sizeY"`
	Sets    []DocSet  `json:"sets"`
	State   bool      `json:"state"`

	// flow field
	Border    DocBorder        `json:"border"`
	Direction string           `json:"direction"` // column, row
	Fields    []any            `json:"fields"`
	Gap       float64          `json:"gap"` // space between flow children
	Padding   DocMarginPadding `json:"padding"`
	ShrinkY   bool             `json:"shrinkY"` // shrink height if content does not fill height
}
type DocFieldGrid struct {
	Id      uuid.UUID `json:"id"`
	Content string    `json:"content"`
	PosX    float64   `json:"posX"`
	PosY    float64   `json:"posY"`
	SizeX   float64   `json:"sizeX"`
	SizeY   float64   `json:"sizeY"`
	Sets    []DocSet  `json:"sets"`
	State   bool      `json:"state"`

	// grid field
	Border   DocBorder `json:"border"`
	Fields   []any     `json:"fields"`
	ShrinkY  bool      `json:"shrinkY"`  // shrink height if content does not fill height
	SizeSnap float64   `json:"sizeSnap"` // grid snap size
}
type DocFieldList struct {
	Id      uuid.UUID `json:"id"`
	Content string    `json:"content"`
	PosX    float64   `json:"posX"`
	PosY    float64   `json:"posY"`
	SizeX   float64   `json:"sizeX"`
	SizeY   float64   `json:"sizeY"`
	Sets    []DocSet  `json:"sets"`
	State   bool      `json:"state"`

	// list field
	HeaderBorder         DocBorder   `json:"headerBorder"`
	HeaderRowColorFill   pgtype.Text `json:"headerRowColorFill"`
	HeaderRowRepeat      bool        `json:"headerRowRepeat"`
	HeaderRowShow        bool        `json:"headerRowShow"`
	BodyBorder           DocBorder   `json:"bodyBorder"`
	BodyRowColorFillEven pgtype.Text `json:"bodyRowColorFillEven"`
	BodyRowColorFillOdd  pgtype.Text `json:"bodyRowColorFillOdd"`
	BodyRowSizeY         float64     `json:"bodyRowSizeY"` // min height
	FooterBorder         DocBorder   `json:"footerBorder"`
	FooterRowColorFill   pgtype.Text `json:"footerRowColorFill"`

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
	Sets    []DocSet  `json:"sets"`
	State   bool      `json:"state"`

	// text field
	Captions CaptionMap `json:"captions"`
}
type DocFont struct {
	Align        string      `json:"align"`        // text: "L", "C", "R", "J" (left, center, right, justify), column: "L", "C", "R" (left, center, right) &  "T", "M", "B" (top, middle, bottom)
	BoolFalse    string      `json:"boolFalse"`    // string representing bool FALSE
	BoolTrue     string      `json:"boolTrue"`     // string representing bool TRUE
	Color        pgtype.Text `json:"color"`        // RGB HEX value, like "000000"
	DateFormat   string      `json:"dateFormat"`   // date format, such as 'Y-m-d'
	Family       string      `json:"family"`       // "cousine", "roboto", ...
	LineFactor   float64     `json:"lineFactor"`   // line height factor in % of font size
	NumberSepDec string      `json:"numberSepDec"` // number decimal separator
	NumberSepTho string      `json:"numberSepTho"` // number thousand separator
	Size         float64     `json:"size"`         // font size in mm
	Style        pgtype.Text `json:"style"`        // mix of "B" (bold), "I" (italic), "U" (underscore), "S" (strike-out), such as "I", "BI" or "IU"
}
type DocHeaderFooter struct {
	Active           bool         `json:"active"`           // true if header/footer is enabled at all (not stored in DB, resolved based on stored data)
	DocPageIdInherit pgtype.UUID  `json:"docPageIdInherit"` // page to inherit header/footer from (instead of its own definition)
	FieldGrid        DocFieldGrid `json:"fieldGrid"`        // header/footer only ever have a fixed grid field of their internal size (if they need flow, they can add a flow field)
}
type DocMarginPadding struct {
	T float64 `json:"t"` // margin in mm
	R float64 `json:"r"` // margin in mm
	B float64 `json:"b"` // margin in mm
	L float64 `json:"l"` // margin in mm
}
type DocPage struct {
	Id          uuid.UUID        `json:"id"`
	FieldFlow   DocFieldFlow     `json:"fieldFlow"`
	Size        string           `json:"size"` // "A1", "A2", "A3", "A4", "A5", "A6", "A7", "Letter", "Legal"
	Margin      DocMarginPadding `json:"margin"`
	Header      DocHeaderFooter  `json:"header"`
	Footer      DocHeaderFooter  `json:"footer"`
	Orientation string           `json:"orientation"` // "landscape" / "portrait"
	Sets        []DocSet         `json:"sets"`
	State       bool             `json:"state"`
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
	Brackets        int         `json:"brackets"`        // opening/closing brackets (side 0/1)
	Content         string      `json:"content"`         // attribute, preset, true, value
	AttributeId     pgtype.UUID `json:"attributeId"`     // attribute ID to retrieve value for
	AttributeIndex  pgtype.Int4 `json:"attributeIndex"`  // attribute index to retrieve value for
	AttributeNested int         `json:"attributeNested"` // attribute nesting level (0 = main query, 1 = 1st sub query), not used in conditions atm but expected by query filter
	PresetId        pgtype.UUID `json:"presetId"`        // preset ID of record to be compared
	Value           pgtype.Text `json:"value"`           // fixed value, can be anything including NULL
}
type DocStateEffect struct {
	DocFieldId pgtype.UUID `json:"docFieldId"` // affected field
	DocPageId  pgtype.UUID `json:"docPageId"`  // affected page
	NewState   bool        `json:"newState"`   // show or no-show
}

// custom marshallers
// use local type to avoid marshal loop (has same fields but none of the original methods)
func (src DocFieldGrid) MarshalJSON() ([]byte, error) {

	// if ID is not set, field is null (header/footer field)
	if src.Id == uuid.Nil {
		return []byte("null"), nil
	}
	type alias DocFieldGrid
	return json.Marshal(alias(src))
}
