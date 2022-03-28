package types

import (
	"encoding/json"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgtype"
)

type Module struct {
	Id              uuid.UUID         `json:"id"`
	ParentId        pgtype.UUID       `json:"parentId"`        // module parent ID
	FormId          pgtype.UUID       `json:"formId"`          // default start form
	IconId          pgtype.UUID       `json:"iconId"`          // module icon in header/menu
	Name            string            `json:"name"`            // name of module, is used for DB schema
	Color1          string            `json:"color1"`          // primary module color (used for header)
	Position        int               `json:"position"`        // position of module in nav. contexts (home, header)
	LanguageMain    string            `json:"languageMain"`    // language code of main language (for fallback)
	ReleaseBuild    int               `json:"releaseBuild"`    // build of this module, incremented with each release
	ReleaseBuildApp int               `json:"releaseBuildApp"` // build of app at last release
	ReleaseDate     int64             `json:"releaseDate"`     // date of last release
	DependsOn       []uuid.UUID       `json:"dependsOn"`       // modules that this module is dependent on
	StartForms      []ModuleStartForm `json:"startForms"`      // start forms, assigned via role membership
	Languages       []string          `json:"languages"`       // language codes that this module supports
	Relations       []Relation        `json:"relations"`
	Forms           []Form            `json:"forms"`
	Menus           []Menu            `json:"menus"`
	Icons           []Icon            `json:"icons"`
	Roles           []Role            `json:"roles"`
	LoginForms      []LoginForm       `json:"loginForms"`
	PgFunctions     []PgFunction      `json:"pgFunctions"`
	JsFunctions     []JsFunction      `json:"jsFunctions"`
	Collections     []Collection      `json:"collections"`
	Captions        CaptionMap        `json:"captions"`
}
type ModuleStartForm struct {
	Position int       `json:"position"`
	RoleId   uuid.UUID `json:"roleId"`
	FormId   uuid.UUID `json:"formId"`
}
type Relation struct {
	Id             uuid.UUID        `json:"id"`
	ModuleId       uuid.UUID        `json:"moduleId"`
	AttributeIdPk  uuid.UUID        `json:"attributeIdPk"` // read only, ID of PK attribute
	Name           string           `json:"name"`
	Encryption     bool             `json:"encryption"`     // relation supports encrypted attribute values
	RetentionCount pgtype.Int4      `json:"retentionCount"` // minimum number of retained change events
	RetentionDays  pgtype.Int4      `json:"retentionDays"`  // minimum age of retained change events
	Attributes     []Attribute      `json:"attributes"`     // read only, all relation attributes
	Indexes        []PgIndex        `json:"indexes"`        // read only, all relation indexes
	Policies       []RelationPolicy `json:"policies"`       // read only, all relation policies
	Presets        []Preset         `json:"presets"`        // read only, all relation presets
	Triggers       []PgTrigger      `json:"triggers"`       // read only, all relation triggers
}
type RelationPolicy struct {
	RoleId           uuid.UUID     `json:"roleId"`
	PgFunctionIdExcl uuid.NullUUID `json:"pgFunctionIdExcl"`
	PgFunctionIdIncl uuid.NullUUID `json:"pgFunctionIdIncl"`
	ActionDelete     bool          `json:"actionDelete"`
	ActionSelect     bool          `json:"actionSelect"`
	ActionUpdate     bool          `json:"actionUpdate"`
}
type Preset struct {
	Id         uuid.UUID     `json:"id"`
	RelationId uuid.UUID     `json:"relationId"`
	Name       string        `json:"name"`
	Protected  bool          `json:"protected"`
	Values     []PresetValue `json:"values"`
}
type PresetValue struct {
	Id            uuid.UUID   `json:"id"`
	PresetId      uuid.UUID   `json:"presetId"`
	PresetIdRefer pgtype.UUID `json:"presetIdRefer"`
	AttributeId   uuid.UUID   `json:"attributeId"`
	Protected     bool        `json:"protected"`
	Value         string      `json:"value"`
}
type Attribute struct {
	Id             uuid.UUID   `json:"id"`
	RelationId     uuid.UUID   `json:"relationId"`     // attribute belongs to this relation
	RelationshipId pgtype.UUID `json:"relationshipId"` // ID of target relation
	IconId         pgtype.UUID `json:"iconId"`         // default icon for attribute
	Name           string      `json:"name"`           // name of attributes, used as table column
	Content        string      `json:"content"`        // attribute content (integer, text, ...)
	Length         int         `json:"length"`         // varchar length or max file size in KB (files attribute)
	Nullable       bool        `json:"nullable"`
	Encrypted      bool        `json:"encrypted"` // content is encrypted (end-to-end for logins)
	Def            string      `json:"def"`
	OnUpdate       string      `json:"onUpdate"`
	OnDelete       string      `json:"onDelete"`
	Captions       CaptionMap  `json:"captions"`
}
type Menu struct {
	Id           uuid.UUID   `json:"id"`
	ModuleId     uuid.UUID   `json:"moduleId"`
	FormId       pgtype.UUID `json:"formId"`
	IconId       pgtype.UUID `json:"iconId"`
	Menus        []Menu      `json:"menus"`
	ShowChildren bool        `json:"showChildren"`
	Captions     CaptionMap  `json:"captions"`
}
type LoginForm struct {
	Id                uuid.UUID  `json:"id"`
	ModuleId          uuid.UUID  `json:"moduleId"`
	FormId            uuid.UUID  `json:"formId"`            // form to open
	AttributeIdLogin  uuid.UUID  `json:"attributeIdLogin"`  // attribute containing login ID (integer)
	AttributeIdLookup uuid.UUID  `json:"attributeIdLookup"` // attribute used for text lookup
	Name              string     `json:"name"`
	Captions          CaptionMap `json:"captions"`
}
type OpenForm struct {
	FormIdOpen       uuid.UUID   `json:"formIdOpen"`       // form to open
	AttributeIdApply pgtype.UUID `json:"attributeIdApply"` // apply record ID to attribute on opened form
	RelationIndex    int         `json:"relationIndex"`    // relation index of record to apply to attribute
	PopUp            bool        `json:"popUp"`            // opened form is pop-up-form
	MaxHeight        int         `json:"maxHeight"`        // max. height in PX for opened form (pop-up only)
	MaxWidth         int         `json:"maxWidth"`         // max. width  in PX for opened form (pop-up only)
}
type Icon struct {
	Id       uuid.UUID `json:"id"`
	ModuleId uuid.UUID `json:"moduleId"`
	File     []byte    `json:"file"`
}
type Form struct {
	Id           uuid.UUID      `json:"id"`
	ModuleId     uuid.UUID      `json:"moduleId"`
	PresetIdOpen pgtype.UUID    `json:"presetIdOpen"`
	IconId       pgtype.UUID    `json:"iconId"`
	Name         string         `json:"name"`
	Query        Query          `json:"query"`
	Fields       []interface{}  `json:"fields"`
	Functions    []FormFunction `json:"functions"`
	States       []FormState    `json:"states"`
	Captions     CaptionMap     `json:"captions"`
}
type FormFunction struct {
	Position     int       `json:"position"`
	JsFunctionId uuid.UUID `json:"jsFunctionId"`
	Event        string    `json:"event"` // open, save, delete
	EventBefore  bool      `json:"eventBefore"`
}
type FormState struct {
	Id          uuid.UUID            `json:"id"`
	Description string               `json:"description"` // builder reference, used to order by
	Conditions  []FormStateCondition `json:"conditions"`
	Effects     []FormStateEffect    `json:"effects"`
}
type FormStateCondition struct {
	Position     int            `json:"position"`
	FieldId0     pgtype.UUID    `json:"fieldId0"`     // if set: field0 value for match (not required for: newRecord, roleId)
	FieldId1     pgtype.UUID    `json:"fieldId1"`     // if set: field0 value must match field1 value
	PresetId1    pgtype.UUID    `json:"presetId1"`    // if set: field0 value must match preset record value
	RoleId       pgtype.UUID    `json:"roleId"`       // if set: with operator '=' login must have role ('<>' must not have role)
	FieldChanged pgtype.Bool    `json:"fieldChanged"` // if set: true matches field value changed, false matches unchanged
	NewRecord    pgtype.Bool    `json:"newRecord"`    // if set: true matches new, false existing record
	Brackets0    int            `json:"brackets0"`
	Brackets1    int            `json:"brackets1"`
	Connector    string         `json:"connector"` // AND, OR
	Login1       pgtype.Bool    `json:"login1"`    // if set: true matches login ID of current user
	Operator     string         `json:"operator"`  // comparisson operator (=, <>, etc.)
	Value1       pgtype.Varchar `json:"value1"`    // fixed value for direct field0 match
}
type FormStateEffect struct {
	FieldId  uuid.UUID `json:"fieldId"`  // affected field
	NewState string    `json:"newState"` // effect state (hidden, readonly, default, required)
}
type Field struct {
	Id       uuid.UUID   `json:"id"`
	IconId   pgtype.UUID `json:"iconId"`
	Content  string      `json:"content"`  // field content (button, header, data, list, ...)
	State    string      `json:"state"`    // field state (hidden, readonly, default, required)
	OnMobile bool        `json:"onMobile"` // display this field on mobile?
}
type FieldButton struct {
	Id           uuid.UUID   `json:"id"`
	IconId       pgtype.UUID `json:"iconId"`
	Content      string      `json:"content"`
	State        string      `json:"state"`
	OnMobile     bool        `json:"onMobile"`
	JsFunctionId pgtype.UUID `json:"jsFunctionId"` // JS function to executing when triggering button
	OpenForm     OpenForm    `json:"openForm"`
	Captions     CaptionMap  `json:"captions"`

	// legacy
	AttributeIdRecord pgtype.UUID `json:"attributeIdRecord"`
	FormIdOpen        pgtype.UUID `json:"formIdOpen"`
}
type FieldCalendar struct {
	Id               uuid.UUID            `json:"id"`
	IconId           pgtype.UUID          `json:"iconId"`
	Content          string               `json:"content"`
	State            string               `json:"state"`
	OnMobile         bool                 `json:"onMobile"`
	AttributeIdDate0 uuid.UUID            `json:"attributeIdDate0"`
	AttributeIdDate1 uuid.UUID            `json:"attributeIdDate1"`
	AttributeIdColor pgtype.UUID          `json:"attributeIdColor"`
	IndexDate0       int                  `json:"indexDate0"`
	IndexDate1       int                  `json:"indexDate1"`
	IndexColor       pgtype.Int4          `json:"indexColor"`
	Gantt            bool                 `json:"gantt"`            // gantt presentation
	GanttSteps       pgtype.Varchar       `json:"ganttSteps"`       // gantt step type (hours, days)
	GanttStepsToggle bool                 `json:"ganttStepsToggle"` // user can toggle between gantt step types
	Ics              bool                 `json:"ics"`              // calendar available as ICS download
	DateRange0       int64                `json:"dateRange0"`       // ICS/gantt time range before NOW (seconds)
	DateRange1       int64                `json:"dateRange1"`       // ICS/gantt time range after NOW (seconds)
	OpenForm         OpenForm             `json:"openForm"`
	Columns          []Column             `json:"columns"`
	Collections      []CollectionConsumer `json:"collections"`
	Query            Query                `json:"query"`

	// legacy
	AttributeIdRecord pgtype.UUID `json:"attributeIdRecord"`
	FormIdOpen        pgtype.UUID `json:"formIdOpen"`
}
type FieldChart struct {
	Id          uuid.UUID   `json:"id"`
	IconId      pgtype.UUID `json:"iconId"`
	Content     string      `json:"content"`
	State       string      `json:"state"`
	OnMobile    bool        `json:"onMobile"`
	ChartOption string      `json:"chartOption"`
	Columns     []Column    `json:"columns"`
	Query       Query       `json:"query"`
}
type FieldContainer struct {
	Id             uuid.UUID     `json:"id"`
	IconId         pgtype.UUID   `json:"iconId"`
	Content        string        `json:"content"`
	State          string        `json:"state"`
	OnMobile       bool          `json:"onMobile"`
	Fields         []interface{} `json:"fields"`
	Direction      string        `json:"direction"`
	JustifyContent string        `json:"justifyContent"`
	AlignItems     string        `json:"alignItems"`
	AlignContent   string        `json:"alignContent"`
	Wrap           bool          `json:"wrap"`
	Grow           int           `json:"grow"`
	Shrink         int           `json:"shrink"`
	Basis          int           `json:"basis"`
	PerMin         int           `json:"perMin"`
	PerMax         int           `json:"perMax"`
}
type FieldData struct {
	Id              uuid.UUID      `json:"id"`
	IconId          pgtype.UUID    `json:"iconId"`
	Content         string         `json:"content"`
	State           string         `json:"state"`
	OnMobile        bool           `json:"onMobile"`
	AttributeId     uuid.UUID      `json:"attributeId"`    // data attribute
	AttributeIdAlt  pgtype.UUID    `json:"attributeIdAlt"` // altern. data attribute (currently used for date period only)
	Index           int            `json:"index"`          // data attribute index
	Display         string         `json:"display"`        // display mode (text, date, color, ...)
	Def             string         `json:"def"`            // data field default value
	Min             pgtype.Int4    `json:"min"`
	Max             pgtype.Int4    `json:"max"`
	RegexCheck      pgtype.Varchar `json:"regexCheck"`      // regex expression to check field value against
	JsFunctionId    pgtype.UUID    `json:"jsFunctionId"`    // JS function to exec when changing values
	CollectionIdDef pgtype.UUID    `json:"collectionIdDef"` // collection to fill default values with
	ColumnIdDef     pgtype.UUID    `json:"columnIdDef"`     // collection column to fill default values with
	Captions        CaptionMap     `json:"captions"`
}
type FieldDataRelationship struct {
	Id             uuid.UUID   `json:"id"`
	IconId         pgtype.UUID `json:"iconId"`
	Content        string      `json:"content"`
	State          string      `json:"state"`
	OnMobile       bool        `json:"onMobile"`
	AttributeId    uuid.UUID   `json:"attributeId"`
	AttributeIdAlt pgtype.UUID `json:"attributeIdAlt"`
	AttributeIdNm  pgtype.UUID `json:"attributeIdNm"`
	Index          int         `json:"index"`
	Display        string      `json:"display"`
	AutoSelect     int         `json:"autoSelect"` // auto select record(s)
	// 1:1, n:1: 0 = none, 2 = second, -3 = third last
	// n:m: 0 = none, 2 = first two, -3 = last three
	Def             string         `json:"def"`
	DefPresetIds    []uuid.UUID    `json:"defPresetIds"` // data field default preset IDs
	Min             pgtype.Int4    `json:"min"`
	Max             pgtype.Int4    `json:"max"`
	RegexCheck      pgtype.Varchar `json:"regexCheck"` // not used for relationships
	JsFunctionId    pgtype.UUID    `json:"jsFunctionId"`
	CollectionIdDef pgtype.UUID    `json:"collectionIdDef"`
	ColumnIdDef     pgtype.UUID    `json:"columnIdDef"`
	Columns         []Column       `json:"columns"`
	Category        bool           `json:"category"`
	FilterQuick     bool           `json:"filterQuick"`
	OutsideIn       bool           `json:"outsideIn"`
	Query           Query          `json:"query"`
	OpenForm        OpenForm       `json:"openForm"`
	Captions        CaptionMap     `json:"captions"`

	// legacy
	AttributeIdRecord pgtype.UUID `json:"attributeIdRecord"`
	FormIdOpen        pgtype.UUID `json:"formIdOpen"`
}
type FieldHeader struct {
	Id       uuid.UUID   `json:"id"`
	IconId   pgtype.UUID `json:"iconId"`
	Content  string      `json:"content"`
	State    string      `json:"state"`
	OnMobile bool        `json:"onMobile"`
	Size     int         `json:"size"`
	Captions CaptionMap  `json:"captions"`
}
type FieldList struct {
	Id          uuid.UUID            `json:"id"`
	IconId      pgtype.UUID          `json:"iconId"`
	Content     string               `json:"content"`
	State       string               `json:"state"`
	OnMobile    bool                 `json:"onMobile"`
	CsvExport   bool                 `json:"csvExport"`
	CsvImport   bool                 `json:"csvImport"`
	AutoRenew   pgtype.Int4          `json:"autoRenew"`   // automatic list refresh
	Layout      string               `json:"layout"`      // list layout: table, cards
	FilterQuick bool                 `json:"filterQuick"` // enable quickfilter (uses all visible columns)
	ResultLimit int                  `json:"resultLimit"` // predefined limit, overwritable by user
	Columns     []Column             `json:"columns"`
	Collections []CollectionConsumer `json:"collections"`
	OpenForm    OpenForm             `json:"openForm"`
	Query       Query                `json:"query"`

	// legacy
	AttributeIdRecord pgtype.UUID `json:"attributeIdRecord"`
	FormIdOpen        pgtype.UUID `json:"formIdOpen"`
}
type Collection struct {
	Id       uuid.UUID `json:"id"`
	ModuleId uuid.UUID `json:"moduleId"`
	Name     string    `json:"name"`
	Columns  []Column  `json:"columns"`
	Query    Query     `json:"query"`
}
type CollectionConsumer struct {
	CollectionId    uuid.UUID   `json:"collectionId"`
	ColumnIdDisplay pgtype.UUID `json:"columnIdDisplay"` // ID of collection column to display (inputs etc.)
}
type Column struct {
	Id          uuid.UUID      `json:"id"`
	AttributeId uuid.UUID      `json:"attributeId"`
	Index       int            `json:"index"`      // attribute index
	Batch       pgtype.Int4    `json:"batch"`      // index of column batch (multiple columns as one)
	Basis       int            `json:"basis"`      // size basis (usually width)
	Length      int            `json:"length"`     // text length limit (in characters)
	Wrap        bool           `json:"wrap"`       // text wrap
	Display     string         `json:"display"`    // how to display value (text, date, color, etc.)
	GroupBy     bool           `json:"groupBy"`    // group by column attribute value?
	Aggregator  pgtype.Varchar `json:"aggregator"` // aggregator (SUM, COUNT, etc.)
	Distincted  bool           `json:"distincted"` // attribute values are distinct?
	SubQuery    bool           `json:"subQuery"`   // column uses sub query?
	OnMobile    bool           `json:"onMobile"`   // display this column on mobile?
	Clipboard   bool           `json:"clipboard"`  // show copy-to-clipboard action?
	Query       Query          `json:"query"`      // sub query
	Captions    CaptionMap     `json:"captions"`
}
type Role struct {
	Id                uuid.UUID         `json:"id"`
	ModuleId          uuid.UUID         `json:"moduleId"`
	ChildrenIds       []uuid.UUID       `json:"childrenIds"`
	Name              string            `json:"name"`
	Assignable        bool              `json:"assignable"`
	AccessAttributes  map[uuid.UUID]int `json:"accessAttributes"`
	AccessCollections map[uuid.UUID]int `json:"accessCollections"`
	AccessMenus       map[uuid.UUID]int `json:"accessMenus"`
	AccessRelations   map[uuid.UUID]int `json:"accessRelations"`
	Captions          CaptionMap        `json:"captions"`
}
type PgFunction struct {
	Id             uuid.UUID            `json:"id"`
	ModuleId       uuid.UUID            `json:"moduleId"`
	Name           string               `json:"name"`
	CodeArgs       string               `json:"codeArgs"`
	CodeFunction   string               `json:"codeFunction"`
	CodeReturns    string               `json:"codeReturns"`
	IsFrontendExec bool                 `json:"isFrontendExec"` // can be executed from frontend
	IsTrigger      bool                 `json:"isTrigger"`      // is relation TRIGGER function
	Schedules      []PgFunctionSchedule `json:"schedules"`
	Captions       CaptionMap           `json:"captions"`
}
type PgFunctionSchedule struct {
	Id            uuid.UUID `json:"id"`
	AtSecond      int       `json:"atSecond"`
	AtMinute      int       `json:"atMinute"`
	AtHour        int       `json:"atHour"`
	AtDay         int       `json:"atDay"`
	IntervalType  string    `json:"intervalType"`
	IntervalValue int       `json:"intervalValue"`
}
type PgTrigger struct {
	Id            uuid.UUID `json:"id"`
	RelationId    uuid.UUID `json:"relationId"`
	PgFunctionId  uuid.UUID `json:"pgFunctionId"`
	Fires         string    `json:"fires"`
	OnDelete      bool      `json:"onDelete"`
	OnInsert      bool      `json:"onInsert"`
	OnUpdate      bool      `json:"onUpdate"`
	IsConstraint  bool      `json:"isConstraint"`
	IsDeferrable  bool      `json:"isDeferrable"`
	IsDeferred    bool      `json:"isDeferred"`
	PerRow        bool      `json:"perRow"`
	CodeCondition string    `json:"codeCondition"`
}
type PgIndex struct {
	Id           uuid.UUID          `json:"id"`
	RelationId   uuid.UUID          `json:"relationId"`
	NoDuplicates bool               `json:"noDuplicates"`
	AutoFki      bool               `json:"autoFki"`
	Attributes   []PgIndexAttribute `json:"attributes"`
}
type PgIndexAttribute struct {
	PgIndexId   uuid.UUID `json:"pgIndexId"`
	AttributeId uuid.UUID `json:"attributeId"`
	Position    int       `json:"position"`
	OrderAsc    bool      `json:"orderAsc"`
}
type JsFunction struct {
	Id           uuid.UUID   `json:"id"`
	ModuleId     uuid.UUID   `json:"moduleId"`
	FormId       pgtype.UUID `json:"formId"`
	Name         string      `json:"name"`
	CodeArgs     string      `json:"codeArgs"`
	CodeFunction string      `json:"codeFunction"`
	CodeReturns  string      `json:"codeReturns"`
	Captions     CaptionMap  `json:"captions"`
}
type Deletion struct {
	Id     uuid.UUID `json:"id"`
	Entity string    `json:"entity"`
}
type CaptionMap map[string]map[string]string // content->language_code->value

// custom marshallers
// use local type to avoid marshal loop (has same fields but none of the original methods)
func (src OpenForm) MarshalJSON() ([]byte, error) {

	if src.FormIdOpen == uuid.Nil {
		return []byte("null"), nil
	}
	type alias OpenForm
	return json.Marshal(alias(src))
}
