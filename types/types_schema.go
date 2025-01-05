package types

import (
	"encoding/json"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type Module struct {
	Id                    uuid.UUID         `json:"id"`
	ParentId              pgtype.UUID       `json:"parentId"`              // module parent ID
	FormId                pgtype.UUID       `json:"formId"`                // default start form
	IconId                pgtype.UUID       `json:"iconId"`                // module icon in header/menu
	IconIdPwa1            pgtype.UUID       `json:"iconIdPwa1"`            // PWA icon, 192x192
	IconIdPwa2            pgtype.UUID       `json:"iconIdPwa2"`            // PWA icon, 512x512
	PgFunctionIdLoginSync pgtype.UUID       `json:"pgFunctionIdLoginSync"` // function called, when login meta changes
	Name                  string            `json:"name"`                  // name of module, is used for DB schema
	NamePwa               pgtype.Text       `json:"namePwa"`               // name of module shown for PWA
	NamePwaShort          pgtype.Text       `json:"namePwaShort"`          // name of module shown for PWA, short version
	Color1                pgtype.Text       `json:"color1"`                // primary module color (used for header)
	Position              int               `json:"position"`              // position of module in nav. contexts (home, header)
	LanguageMain          string            `json:"languageMain"`          // language code of main language (for fallback)
	ReleaseBuild          int               `json:"releaseBuild"`          // build of this module, incremented with each release
	ReleaseBuildApp       int               `json:"releaseBuildApp"`       // build of app at last release
	ReleaseDate           int64             `json:"releaseDate"`           // date of last release
	DependsOn             []uuid.UUID       `json:"dependsOn"`             // modules that this module is dependent on
	StartForms            []ModuleStartForm `json:"startForms"`            // start forms, assigned via role membership
	Languages             []string          `json:"languages"`             // language codes that this module supports
	Relations             []Relation        `json:"relations"`
	Forms                 []Form            `json:"forms"`
	MenuTabs              []MenuTab         `json:"menuTabs"`
	Icons                 []Icon            `json:"icons"`
	Roles                 []Role            `json:"roles"`
	Articles              []Article         `json:"articles"`
	LoginForms            []LoginForm       `json:"loginForms"`
	PgFunctions           []PgFunction      `json:"pgFunctions"`
	PgTriggers            []PgTrigger       `json:"pgTriggers"`
	JsFunctions           []JsFunction      `json:"jsFunctions"`
	Collections           []Collection      `json:"collections"`
	Apis                  []Api             `json:"apis"`
	ClientEvents          []ClientEvent     `json:"clientEvents"`
	Variables             []Variable        `json:"variables"`
	Widgets               []Widget          `json:"widgets"`
	ArticleIdsHelp        []uuid.UUID       `json:"articleIdsHelp"` // IDs of articles for primary module help, in order
	Captions              CaptionMap        `json:"captions"`

	// legacy
	Menus []Menu `json:"menus"`
}
type ModuleStartForm struct {
	Position int       `json:"position"`
	RoleId   uuid.UUID `json:"roleId"`
	FormId   uuid.UUID `json:"formId"`
}
type Api struct {
	Id         uuid.UUID   `json:"id"`
	ModuleId   uuid.UUID   `json:"moduleId"`
	Name       string      `json:"name"`
	Comment    pgtype.Text `json:"comment"` // author comment
	Query      Query       `json:"query"`
	Columns    []Column    `json:"columns"`
	HasDelete  bool        `json:"hasDelete"`
	HasGet     bool        `json:"hasGet"`
	HasPost    bool        `json:"hasPost"`
	LimitDef   int         `json:"limitDef"`   // default limit, if nothing else is specified
	LimitMax   int         `json:"limitMax"`   // maximum limit that can be requested
	VerboseDef bool        `json:"verboseDef"` // default input/output option, verbose shows relation indexes and attribute names
	Version    int         `json:"version"`
}
type Article struct {
	Id       uuid.UUID  `json:"id"`
	ModuleId uuid.UUID  `json:"moduleId"`
	Name     string     `json:"name"`
	Captions CaptionMap `json:"captions"`
}
type Relation struct {
	Id             uuid.UUID        `json:"id"`
	ModuleId       uuid.UUID        `json:"moduleId"`
	AttributeIdPk  uuid.UUID        `json:"attributeIdPk"`  // read only, ID of PK attribute
	Name           string           `json:"name"`           // unique (within module) relation name
	Comment        pgtype.Text      `json:"comment"`        // author comment
	Encryption     bool             `json:"encryption"`     // relation supports encrypted attribute values
	RetentionCount pgtype.Int4      `json:"retentionCount"` // minimum number of retained change events
	RetentionDays  pgtype.Int4      `json:"retentionDays"`  // minimum age of retained change events
	Attributes     []Attribute      `json:"attributes"`     // read only, all relation attributes
	Indexes        []PgIndex        `json:"indexes"`        // read only, all relation indexes
	Policies       []RelationPolicy `json:"policies"`       // read only, all relation policies
	Presets        []Preset         `json:"presets"`        // read only, all relation presets

	// legacy
	Triggers []PgTrigger `json:"triggers"` // moved to module pgTriggers
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
	Value         pgtype.Text `json:"value"`
}
type Attribute struct {
	Id             uuid.UUID   `json:"id"`
	RelationId     uuid.UUID   `json:"relationId"`     // attribute belongs to this relation
	RelationshipId pgtype.UUID `json:"relationshipId"` // ID of target relation
	IconId         pgtype.UUID `json:"iconId"`         // default icon
	Name           string      `json:"name"`           // name, used as table column
	Content        string      `json:"content"`        // content (integer, varchar, text, real, uuid, files, n:1, ...)
	ContentUse     string      `json:"contentUse"`     // content use (default, richtext, color, datetime, ...)
	Length         int         `json:"length"`         // numeric precision (digits number + fractions) / varchar length / max file size in KB
	LengthFract    int         `json:"lengthFract"`    // numeric scale (digits fractions)
	Nullable       bool        `json:"nullable"`       // value is nullable
	Encrypted      bool        `json:"encrypted"`      // value is encrypted (end-to-end for logins)
	Def            string      `json:"def"`            // default value
	OnUpdate       string      `json:"onUpdate"`       // relationship attribute, action on 'UPDATE'
	OnDelete       string      `json:"onDelete"`       // relationship attribute, action on 'DELETE'
	Captions       CaptionMap  `json:"captions"`
}
type Menu struct {
	Id           uuid.UUID            `json:"id"`
	FormId       pgtype.UUID          `json:"formId"`
	IconId       pgtype.UUID          `json:"iconId"`
	Menus        []Menu               `json:"menus"`
	Color        pgtype.Text          `json:"color"`
	ShowChildren bool                 `json:"showChildren"`
	Collections  []CollectionConsumer `json:"collections"` // collection values to display on menu entry
	Captions     CaptionMap           `json:"captions"`
}
type MenuTab struct {
	Id       uuid.UUID   `json:"id"`
	ModuleId uuid.UUID   `json:"moduleId"`
	IconId   pgtype.UUID `json:"iconId"`
	Menus    []Menu      `json:"menus"`
	Captions CaptionMap  `json:"captions"`
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
	PopUpType pgtype.Text `json:"popUpType"` // if set, form is opened as pop-up, values: float, inline
	Context   pgtype.Text `json:"context"`   // used when same entity needs multiple open forms, values: bulk
	MaxHeight int         `json:"maxHeight"` // max. height in PX for opened form (pop-up only)
	MaxWidth  int         `json:"maxWidth"`  // max. width  in PX for opened form (pop-up only)

	// open form
	RelationIndexOpen int       `json:"relationIndexOpen"` // relation index of record to open
	FormIdOpen        uuid.UUID `json:"formIdOpen"`        // form to open record in (must have chosen relation as base relation)

	// apply record from current form as relationship value on target form
	RelationIndexApply int         `json:"relationIndexApply"` // relation index of record to use as relationship value
	AttributeIdApply   pgtype.UUID `json:"attributeIdApply"`   // apply record ID as relationship value to attribute on opened form

	// legacy
	RelationIndex int  `json:"relationIndex"` // replaced by relationIndexApply
	PopUp         bool `json:"popUp"`         // replaced by popUpType
}
type Icon struct {
	Id       uuid.UUID `json:"id"`
	ModuleId uuid.UUID `json:"moduleId"`
	Name     string    `json:"name"`
	File     []byte    `json:"file"`
}
type Form struct {
	Id             uuid.UUID      `json:"id"`
	ModuleId       uuid.UUID      `json:"moduleId"`
	PresetIdOpen   pgtype.UUID    `json:"presetIdOpen"`
	FieldIdFocus   pgtype.UUID    `json:"fieldIdFocus"` // field to set focus to on form load
	IconId         pgtype.UUID    `json:"iconId"`
	Name           string         `json:"name"`
	NoDataActions  bool           `json:"noDataActions"` // disables record manipulation actions (new/save/delete)
	Query          Query          `json:"query"`
	Fields         []interface{}  `json:"fields"`
	Actions        []FormAction   `json:"actions"`
	Functions      []FormFunction `json:"functions"`
	States         []FormState    `json:"states"`
	ArticleIdsHelp []uuid.UUID    `json:"articleIdsHelp"` // IDs of articles for form context help, in order
	Captions       CaptionMap     `json:"captions"`
}
type FormAction struct {
	Id           uuid.UUID   `json:"id"`
	JsFunctionId uuid.UUID   `json:"jsFunctionId"`
	IconId       pgtype.UUID `json:"iconId"`
	Color        pgtype.Text `json:"color"`
	State        string      `json:"state"` // default state (hidden, default, readonly)
	Captions     CaptionMap  `json:"captions"`
}
type FormFunction struct {
	Position     int       `json:"position"`
	JsFunctionId uuid.UUID `json:"jsFunctionId"`
	Event        string    `json:"event"` // open, save, delete
	EventBefore  bool      `json:"eventBefore"`
}
type FormState struct {
	Id          uuid.UUID            `json:"id"`
	Description string               `json:"description"` // builder reference, used to order and search by
	Conditions  []FormStateCondition `json:"conditions"`  // conditions to be met for effects to be applied
	Effects     []FormStateEffect    `json:"effects"`     // effects to apply when conditions are met
}
type FormStateCondition struct {
	Position  int                    `json:"position"`
	Connector string                 `json:"connector"` // AND, OR
	Operator  string                 `json:"operator"`  // comparison operator (=, <>, etc.)
	Side0     FormStateConditionSide `json:"side0"`     // comparison: left side
	Side1     FormStateConditionSide `json:"side1"`     // comparison: right side
}
type FormStateConditionSide struct {
	Brackets     int         `json:"brackets"`     // opening/closing brackets (side 0/1)
	Content      string      `json:"content"`      // collection, field, fieldChanged, fieldValid, formChanged, formState, login, preset, recordNew, role, true, value, variable
	CollectionId pgtype.UUID `json:"collectionId"` // collection ID of which column value to compare
	ColumnId     pgtype.UUID `json:"columnId"`     // column ID from collection of which value to compare
	FieldId      pgtype.UUID `json:"fieldId"`      // field ID, for checks: value / has changed / is valid
	FormStateId  pgtype.UUID `json:"formStateId"`  // form state ID, for taking result of other form state as condition
	PresetId     pgtype.UUID `json:"presetId"`     // preset ID of record to be compared
	RoleId       pgtype.UUID `json:"roleId"`       // role ID assigned to user
	VariableId   pgtype.UUID `json:"variableId"`   // variable ID of value to retrieve
	Value        pgtype.Text `json:"value"`        // fixed value, can be anything including NULL
}
type FormStateEffect struct {
	FormActionId pgtype.UUID `json:"formActionId"` // affected form action
	FieldId      pgtype.UUID `json:"fieldId"`      // affected field
	TabId        pgtype.UUID `json:"tabId"`        // affected tab
	NewState     string      `json:"newState"`     // applied state (hidden, default, readonly, optional, required)
}
type Field struct {
	Id       uuid.UUID   `json:"id"`
	TabId    pgtype.UUID `json:"tabId"`
	IconId   pgtype.UUID `json:"iconId"`
	Content  string      `json:"content"`  // content (button, header, data, list, calendar, chart, tabs)
	State    string      `json:"state"`    // default state (hidden, default, readonly, optional, required)
	Flags    []string    `json:"flags"`    // flags for field display/behaviour options (clipboard, monospace, alignEnd, ...)
	OnMobile bool        `json:"onMobile"` // display this field on mobile?
}
type FieldButton struct {
	Id           uuid.UUID   `json:"id"`
	TabId        pgtype.UUID `json:"tabId"`
	IconId       pgtype.UUID `json:"iconId"`
	Content      string      `json:"content"`
	State        string      `json:"state"`
	Flags        []string    `json:"flags"`
	OnMobile     bool        `json:"onMobile"`
	JsFunctionId pgtype.UUID `json:"jsFunctionId"` // JS function to executing when triggering button
	OpenForm     OpenForm    `json:"openForm"`
	Captions     CaptionMap  `json:"captions"`
}
type FieldCalendar struct {
	Id               uuid.UUID            `json:"id"`
	TabId            pgtype.UUID          `json:"tabId"`
	IconId           pgtype.UUID          `json:"iconId"`
	Content          string               `json:"content"`
	State            string               `json:"state"`
	Flags            []string             `json:"flags"`
	OnMobile         bool                 `json:"onMobile"`
	AttributeIdDate0 uuid.UUID            `json:"attributeIdDate0"`
	AttributeIdDate1 uuid.UUID            `json:"attributeIdDate1"`
	AttributeIdColor pgtype.UUID          `json:"attributeIdColor"`
	IndexDate0       int                  `json:"indexDate0"`
	IndexDate1       int                  `json:"indexDate1"`
	IndexColor       pgtype.Int4          `json:"indexColor"`
	Gantt            bool                 `json:"gantt"`            // gantt presentation
	GanttSteps       pgtype.Text          `json:"ganttSteps"`       // gantt step type (hours, days)
	GanttStepsToggle bool                 `json:"ganttStepsToggle"` // user can toggle between gantt step types
	Ics              bool                 `json:"ics"`              // calendar available as ICS download
	DateRange0       int64                `json:"dateRange0"`       // ICS/gantt time range before NOW (seconds)
	DateRange1       int64                `json:"dateRange1"`       // ICS/gantt time range after NOW (seconds)
	Days             int                  `json:"days"`             // how many days to show on calendar by default (1,3,5,7,42)
	DaysToggle       bool                 `json:"daysToggle"`       // if enabled, user can choose how many days to show
	OpenForm         OpenForm             `json:"openForm"`
	Columns          []Column             `json:"columns"`
	Collections      []CollectionConsumer `json:"collections"` // collections to select values for query filters
	Query            Query                `json:"query"`
}
type FieldChart struct {
	Id          uuid.UUID   `json:"id"`
	TabId       pgtype.UUID `json:"tabId"`
	IconId      pgtype.UUID `json:"iconId"`
	Content     string      `json:"content"`
	State       string      `json:"state"`
	Flags       []string    `json:"flags"`
	OnMobile    bool        `json:"onMobile"`
	ChartOption string      `json:"chartOption"`
	Columns     []Column    `json:"columns"`
	Query       Query       `json:"query"`
	Captions    CaptionMap  `json:"captions"`
}
type FieldContainer struct {
	Id             uuid.UUID     `json:"id"`
	TabId          pgtype.UUID   `json:"tabId"`
	IconId         pgtype.UUID   `json:"iconId"`
	Content        string        `json:"content"`
	State          string        `json:"state"`
	Flags          []string      `json:"flags"`
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
	Id             uuid.UUID          `json:"id"`
	TabId          pgtype.UUID        `json:"tabId"`
	IconId         pgtype.UUID        `json:"iconId"`
	Content        string             `json:"content"`
	State          string             `json:"state"`
	Flags          []string           `json:"flags"`
	OnMobile       bool               `json:"onMobile"`
	Clipboard      bool               `json:"clipboard"`      // enable copy-to-clipboard action
	AttributeId    uuid.UUID          `json:"attributeId"`    // data attribute
	AttributeIdAlt pgtype.UUID        `json:"attributeIdAlt"` // altern. data attribute (currently used for date period only)
	Index          int                `json:"index"`          // data attribute index
	Display        string             `json:"display"`        // display mode (text, date, color, ...)
	Def            string             `json:"def"`            // data field default value
	DefCollection  CollectionConsumer `json:"defCollection"`  // data field default value from collection
	Min            pgtype.Int4        `json:"min"`
	Max            pgtype.Int4        `json:"max"`
	RegexCheck     pgtype.Text        `json:"regexCheck"`   // regex expression to check field value against
	JsFunctionId   pgtype.UUID        `json:"jsFunctionId"` // JS function to exec when changing values
	Captions       CaptionMap         `json:"captions"`

	// legacy
	CollectionIdDef pgtype.UUID `json:"collectionIdDef"` // collection to fill default values with
	ColumnIdDef     pgtype.UUID `json:"columnIdDef"`     // collection column to fill default values with
}
type FieldDataRelationship struct {
	Id             uuid.UUID   `json:"id"`
	TabId          pgtype.UUID `json:"tabId"`
	IconId         pgtype.UUID `json:"iconId"`
	Content        string      `json:"content"`
	State          string      `json:"state"`
	Flags          []string    `json:"flags"`
	OnMobile       bool        `json:"onMobile"`
	Clipboard      bool        `json:"clipboard"`
	AttributeId    uuid.UUID   `json:"attributeId"`
	AttributeIdAlt pgtype.UUID `json:"attributeIdAlt"`
	AttributeIdNm  pgtype.UUID `json:"attributeIdNm"`
	Index          int         `json:"index"`
	Display        string      `json:"display"`
	AutoSelect     int         `json:"autoSelect"` // auto select record(s)
	// 1:1, n:1: 0 = none, 2 = second, -3 = third last
	// n:m: 0 = none, 2 = first two, -3 = last three
	Def           string             `json:"def"`
	DefCollection CollectionConsumer `json:"defCollection"` // data field default value from collection
	DefPresetIds  []uuid.UUID        `json:"defPresetIds"`  // data field default from record IDs via presets
	Min           pgtype.Int4        `json:"min"`
	Max           pgtype.Int4        `json:"max"`
	RegexCheck    pgtype.Text        `json:"regexCheck"` // not used for relationships
	JsFunctionId  pgtype.UUID        `json:"jsFunctionId"`
	Columns       []Column           `json:"columns"`
	Category      bool               `json:"category"`
	FilterQuick   bool               `json:"filterQuick"`
	OutsideIn     bool               `json:"outsideIn"`
	Query         Query              `json:"query"`
	OpenForm      OpenForm           `json:"openForm"`
	Captions      CaptionMap         `json:"captions"`

	// legacy
	CollectionIdDef pgtype.UUID `json:"collectionIdDef"`
	ColumnIdDef     pgtype.UUID `json:"columnIdDef"`
}
type FieldHeader struct {
	Id       uuid.UUID   `json:"id"`
	TabId    pgtype.UUID `json:"tabId"`
	IconId   pgtype.UUID `json:"iconId"`
	Content  string      `json:"content"`
	State    string      `json:"state"`
	Flags    []string    `json:"flags"`
	OnMobile bool        `json:"onMobile"`
	Richtext bool        `json:"richtext"`
	Size     int         `json:"size"`
	Captions CaptionMap  `json:"captions"`
}
type FieldKanban struct {
	Id                 uuid.UUID            `json:"id"`
	TabId              pgtype.UUID          `json:"tabId"`
	IconId             pgtype.UUID          `json:"iconId"`
	Content            string               `json:"content"`
	State              string               `json:"state"`
	Flags              []string             `json:"flags"`
	OnMobile           bool                 `json:"onMobile"`
	RelationIndexData  int                  `json:"relationIndexData"`
	RelationIndexAxisX int                  `json:"relationIndexAxisX"`
	RelationIndexAxisY pgtype.Int2          `json:"relationIndexAxisY"`
	AttributeIdSort    pgtype.UUID          `json:"attributeIdSort"`
	Columns            []Column             `json:"columns"`
	Collections        []CollectionConsumer `json:"collections"` // collections to select values for query filters
	OpenForm           OpenForm             `json:"openForm"`
	Query              Query                `json:"query"`
}
type FieldList struct {
	Id           uuid.UUID            `json:"id"`
	TabId        pgtype.UUID          `json:"tabId"`
	IconId       pgtype.UUID          `json:"iconId"`
	Content      string               `json:"content"`
	State        string               `json:"state"`
	Flags        []string             `json:"flags"`
	OnMobile     bool                 `json:"onMobile"`
	CsvExport    bool                 `json:"csvExport"`
	CsvImport    bool                 `json:"csvImport"`
	AutoRenew    pgtype.Int4          `json:"autoRenew"`   // automatic list refresh
	Layout       string               `json:"layout"`      // list layout: table, cards
	FilterQuick  bool                 `json:"filterQuick"` // enable quickfilter (uses all visible columns)
	ResultLimit  int                  `json:"resultLimit"` // predefined limit, overwritable by user
	Columns      []Column             `json:"columns"`
	Collections  []CollectionConsumer `json:"collections"`  // collections to select values for query filters
	OpenForm     OpenForm             `json:"openForm"`     // regular form to open records with
	OpenFormBulk OpenForm             `json:"openFormBulk"` // form for bulk actions (multiple record updates)
	Query        Query                `json:"query"`
	Captions     CaptionMap           `json:"captions"`
}
type FieldTabs struct {
	Id       uuid.UUID   `json:"id"`
	TabId    pgtype.UUID `json:"tabId"`
	IconId   pgtype.UUID `json:"iconId"`
	Content  string      `json:"content"`
	State    string      `json:"state"`
	Flags    []string    `json:"flags"`
	OnMobile bool        `json:"onMobile"`
	Captions CaptionMap  `json:"captions"`
	Tabs     []Tab       `json:"tabs"`
}
type FieldVariable struct {
	Id           uuid.UUID   `json:"id"`
	VariableId   pgtype.UUID `json:"variableId"`
	JsFunctionId pgtype.UUID `json:"jsFunctionId"`
	IconId       pgtype.UUID `json:"iconId"`
	Content      string      `json:"content"`
	State        string      `json:"state"`
	Flags        []string    `json:"flags"`
	OnMobile     bool        `json:"onMobile"`
	Clipboard    bool        `json:"clipboard"`
	Columns      []Column    `json:"columns"`
	Query        Query       `json:"query"`
	Captions     CaptionMap  `json:"captions"`
}
type Collection struct {
	Id       uuid.UUID            `json:"id"`
	ModuleId uuid.UUID            `json:"moduleId"`
	IconId   pgtype.UUID          `json:"iconId"`
	Name     string               `json:"name"`
	Columns  []Column             `json:"columns"`
	Query    Query                `json:"query"`
	InHeader []CollectionConsumer `json:"inHeader"` // collection consumers used by application header
}
type CollectionConsumer struct {
	Id              uuid.UUID   `json:"id"`
	CollectionId    uuid.UUID   `json:"collectionId"`
	ColumnIdDisplay pgtype.UUID `json:"columnIdDisplay"` // ID of collection column to display (inputs etc.)
	MultiValue      bool        `json:"multiValue"`      // if active, values of multiple record rows can be selected
	NoDisplayEmpty  bool        `json:"noDisplayEmpty"`  // if collection is used for display and value is 'empty' (0, '', null), it is not shown
	OnMobile        bool        `json:"onMobile"`        // if collection is used for display and mobile view is active, decides whether to show collection
	OpenForm        OpenForm    `json:"openForm"`
}
type Column struct {
	Id          uuid.UUID   `json:"id"`
	AttributeId uuid.UUID   `json:"attributeId"`
	Index       int         `json:"index"`      // attribute index
	GroupBy     bool        `json:"groupBy"`    // group by column attribute value?
	Aggregator  pgtype.Text `json:"aggregator"` // aggregator (SUM, COUNT, etc.)
	Distincted  bool        `json:"distincted"` // attribute values are distinct?
	SubQuery    bool        `json:"subQuery"`   // column uses sub query?
	Query       Query       `json:"query"`      // sub query
	Captions    CaptionMap  `json:"captions"`   // column titles

	// presentation
	Basis    int         `json:"basis"`    // size basis (usually width)
	Batch    pgtype.Int4 `json:"batch"`    // index of column batch (multiple columns as one)
	Display  string      `json:"display"`  // how to display value (email, gallery, etc.)
	Hidden   bool        `json:"hidden"`   // hide column by default?
	Length   int         `json:"length"`   // text length limit (in characters)
	OnMobile bool        `json:"onMobile"` // display column on mobile by default?
	Styles   []string    `json:"styles"`   // alignEnd, alignMid, bold, clipboard, hide, italic, vertical, wrap

	// legacy
	BatchVertical bool `json:"batchVertical"`
	Clipboard     bool `json:"clipboard"`
	Wrap          bool `json:"wrap"`
}
type Role struct {
	Id                 uuid.UUID         `json:"id"`
	ModuleId           uuid.UUID         `json:"moduleId"`
	ChildrenIds        []uuid.UUID       `json:"childrenIds"`
	Name               string            `json:"name"`
	Content            string            `json:"content"`
	Assignable         bool              `json:"assignable"`
	AccessApis         map[uuid.UUID]int `json:"accessApis"`
	AccessAttributes   map[uuid.UUID]int `json:"accessAttributes"`
	AccessClientEvents map[uuid.UUID]int `json:"accessClientEvents"`
	AccessCollections  map[uuid.UUID]int `json:"accessCollections"`
	AccessMenus        map[uuid.UUID]int `json:"accessMenus"`
	AccessRelations    map[uuid.UUID]int `json:"accessRelations"`
	AccessWidgets      map[uuid.UUID]int `json:"accessWidgets"`
	Captions           CaptionMap        `json:"captions"`
}
type PgFunction struct {
	Id             uuid.UUID            `json:"id"`
	ModuleId       uuid.UUID            `json:"moduleId"`
	Name           string               `json:"name"`
	CodeArgs       string               `json:"codeArgs"`
	CodeFunction   string               `json:"codeFunction"`
	CodeReturns    string               `json:"codeReturns"`
	IsFrontendExec bool                 `json:"isFrontendExec"` // can be called from JS function
	IsLoginSync    bool                 `json:"isLoginSync"`    // special login sync function
	IsTrigger      bool                 `json:"isTrigger"`      // is relation TRIGGER function
	Volatility     string               `json:"volatility"`     // VOLATILE, STABLE, IMMUTABLE
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
	ModuleId      uuid.UUID `json:"moduleId"`
	RelationId    uuid.UUID `json:"relationId"`
	PgFunctionId  uuid.UUID `json:"pgFunctionId"`
	Fires         string    `json:"fires"` // BEFORE/AFTER
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
	Id              uuid.UUID          `json:"id"`
	RelationId      uuid.UUID          `json:"relationId"`
	AttributeIdDict pgtype.UUID        `json:"attributeIdDict"` // attribute used as dictionary for full text search (if set, GIN is used)
	Method          string             `json:"method"`          // BTREE/GIN
	NoDuplicates    bool               `json:"noDuplicates"`    // index is unique
	AutoFki         bool               `json:"autoFki"`         // index belongs to foreign key attribute (auto-generated)
	PrimaryKey      bool               `json:"primaryKey"`      // index belongs to primary key attribute
	Attributes      []PgIndexAttribute `json:"attributes"`      // attributes the index is made of
}
type PgIndexAttribute struct {
	PgIndexId   uuid.UUID `json:"pgIndexId"`
	AttributeId uuid.UUID `json:"attributeId"`
	Position    int       `json:"position"`
	OrderAsc    bool      `json:"orderAsc"`
}
type JsFunction struct {
	Id                uuid.UUID   `json:"id"`
	ModuleId          uuid.UUID   `json:"moduleId"`
	FormId            pgtype.UUID `json:"formId"`
	Name              string      `json:"name"`
	CodeArgs          string      `json:"codeArgs"`
	CodeFunction      string      `json:"codeFunction"`
	CodeReturns       string      `json:"codeReturns"`
	IsClientEventExec bool        `json:"isClientEventExec"` // can be executed from client events
	Captions          CaptionMap  `json:"captions"`
}
type Tab struct {
	Id             uuid.UUID     `json:"id"`
	Position       int           `json:"position"`
	ContentCounter bool          `json:"contentCounter"` // tab shows counter of its child field values (list rows, calendar entries, file counts)
	State          string        `json:"state"`          // tab default state (default, hidden)
	Fields         []interface{} `json:"fields"`         // fields assigned to tab
	Captions       CaptionMap    `json:"captions"`
}
type ClientEvent struct {
	Id              uuid.UUID   `json:"id"`
	ModuleId        uuid.UUID   `json:"moduleId"`
	Action          string      `json:"action"`          // action to execute when event is running (callJsFunction, callPgFunction)
	Arguments       []string    `json:"arguments"`       // arguments to supply to function call (clipboard, hostname, username, windowTitle)
	Event           string      `json:"event"`           // events to react to (onConnect, onDisconnect, onHotkey)
	HotkeyChar      string      `json:"hotkeyChar"`      // single character
	HotkeyModifier1 string      `json:"hotkeyModifier1"` // ALT, CMD, CTRL, SHIFT
	HotkeyModifier2 pgtype.Text `json:"hotkeyModifier2"` // ALT, CMD, CTRL, SHIFT (optional)
	JsFunctionId    pgtype.UUID `json:"jsFunctionId"`
	PgFunctionId    pgtype.UUID `json:"pgFunctionId"`
	Captions        CaptionMap  `json:"captions"`
}
type Variable struct {
	Id         uuid.UUID   `json:"id"`
	ModuleId   uuid.UUID   `json:"moduleId"`
	FormId     pgtype.UUID `json:"formId"` // if assigned to form, otherwise global
	Name       string      `json:"name"`
	Comment    pgtype.Text `json:"comment"` // author comment
	Content    string      `json:"content"`
	ContentUse string      `json:"contentUse"`
}
type Widget struct {
	Id         uuid.UUID          `json:"id"`
	ModuleId   uuid.UUID          `json:"moduleId"`
	FormId     pgtype.UUID        `json:"formId"`
	Name       string             `json:"name"`
	Size       int                `json:"size"`
	Collection CollectionConsumer `json:"collection"` // collection to display
	Captions   CaptionMap         `json:"captions"`
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
func (src CollectionConsumer) MarshalJSON() ([]byte, error) {

	if src.CollectionId == uuid.Nil {
		return []byte("null"), nil
	}
	type alias CollectionConsumer
	return json.Marshal(alias(src))
}
