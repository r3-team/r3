package types

import (
	"encoding/json"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

var (
	QueryJoinConnectors   = []string{"INNER", "LEFT", "RIGHT", "FULL", "CROSS"}
	QueryFilterConnectors = []string{"AND", "OR"}
	QueryFilterOperators  = []string{"=", "<>", "<", ">", "<=", ">=", "IS NULL",
		"IS NOT NULL", "LIKE", "ILIKE", "NOT LIKE", "NOT ILIKE", "= ANY",
		"<> ALL", "@>", "<@", "&&", "@@", "~", "~*", "!~", "!~*"}
)

// a query starts at a relation to retrieve attribute values
// it can join other relations via relationship attributes from both sides
// each relation (original and joined) is referred via an unique index (simple counter)
// because the same relation can join multiple times, an unique index is required to know which relation is referred to
// via indexes, joins know their source (index from), filters can refer to attributes from specific relations, etc.
type Query struct {
	Id         uuid.UUID     `json:"id"`
	RelationId pgtype.UUID   `json:"relationId"` // query source relation
	FixedLimit int           `json:"fixedLimit"` // fixed limit, used for queries like 'top 5 of X'
	Joins      []QueryJoin   `json:"joins"`      // query joins over multiple relations
	Filters    []QueryFilter `json:"filters"`    // default query filter
	Orders     []QueryOrder  `json:"orders"`     // default query sort
	Lookups    []QueryLookup `json:"lookups"`    // import lookups via PG indexes
	Choices    []QueryChoice `json:"choices"`    // named filter sets, selectable by users
}

type QueryJoin struct {
	RelationId  uuid.UUID   `json:"relationId"`  // relation to join
	AttributeId pgtype.UUID `json:"attributeId"` // join relationship attribute
	IndexFrom   int         `json:"indexFrom"`   // index that we joined from (always lower than own index)
	Index       int         `json:"index"`       // this relation index
	Connector   string      `json:"connector"`   // join connector (INNER, LEFT, RIGHT, FULL)

	// for frontend processing
	ApplyCreate bool `json:"applyCreate"` // allow new records to be created
	ApplyUpdate bool `json:"applyUpdate"` // allow existing records to be updated
	ApplyDelete bool `json:"applyDelete"` // allow existing records to be deleted
}

// a filter compares two values from left & right sides (0/1)
// example comparisons: attribute value (from DB) to...
// ...to other attribute (from DB as well)
// ...to other attribute from DB sub query
// ...to field value     (from UI)
// ...to login ID        (from user session)
// ...to fixed value     (pre-defined string)
type QueryFilter struct {
	Connector string          `json:"connector"` // AND, OR
	Operator  string          `json:"operator"`  // comparison operator (=, <>, etc.)
	Index     int             `json:"index"`     // relation index to apply filter to (0 = filter query, 1+ = filter relation join)
	Side0     QueryFilterSide `json:"side0"`     // comparison: left side
	Side1     QueryFilterSide `json:"side1"`     // comparison: right side
}
type QueryFilterSide struct {
	Brackets int         `json:"brackets"` // opening/closing brackets (side 0/1)
	Value    pgtype.Text `json:"value"`    // fixed value, can be anything including NULL

	// for backend processing
	AttributeId     pgtype.UUID `json:"attributeId"`     // attribute (database value)
	AttributeIndex  int         `json:"attributeIndex"`  // relation index of attribute
	AttributeNested int         `json:"attributeNested"` // nesting level of attribute  (0=main query, 1=1st sub query)
	Query           Query       `json:"query"`           // sub query
	QueryAggregator pgtype.Text `json:"queryAggregator"` // sub query aggregator (COUNT, AGG, etc.)

	// for frontend processing
	Content      string      `json:"content"`      // attribute, collection, field, language code, login, nowDate, nowDatetime, nowTime, preset, record, record new, role, sub query, true, value
	CollectionId pgtype.UUID `json:"collectionId"` // collection ID of which column value to compare
	ColumnId     pgtype.UUID `json:"columnId"`     // column ID from collection of which value to compare
	FieldId      pgtype.UUID `json:"fieldId"`      // frontend field value
	PresetId     pgtype.UUID `json:"presetId"`     // preset ID of record to be compared
	RoleId       pgtype.UUID `json:"roleId"`       // role ID assigned to user
	VariableId   pgtype.UUID `json:"variableId"`   // variable ID of value to compare

	NowOffset pgtype.Int4 `json:"nowOffset"` // offset in seconds (+/-) for now* content (e. g. nowDatetime - 86400 -> last day)
}

type QueryOrder struct {
	AttributeId uuid.UUID `json:"attributeId"`
	Index       int       `json:"index"`
	Ascending   bool      `json:"ascending"`
}

type QueryLookup struct {
	PgIndexId uuid.UUID `json:"pgIndexId"`
	Index     int       `json:"index"`
}

type QueryChoice struct {
	Id       uuid.UUID     `json:"id"`
	Name     string        `json:"name"`
	Filters  []QueryFilter `json:"filters"` // filters for this choice
	Captions CaptionMap    `json:"captions"`
}

// custom marshallers
// use local type to avoid marshal loop (has same fields but none of the original methods)
func (src Query) MarshalJSON() ([]byte, error) {

	// if relation is not set, query is empty
	if !src.RelationId.Valid {
		return []byte("null"), nil
	}
	type alias Query
	return json.Marshal(alias(src))
}
