package types

import (
	"github.com/gofrs/uuid"
	"github.com/jackc/pgtype"
)

// data GET request, translates to SELECT statements
// * different expressions are available for SELECTing data (attributes, sub queries)
// * multiple relations can be joined via relationship attributes
// * filters directly translate to WHERE clauses

// a filter translates to a WHERE clause
// for each clause, a left side (0) and right side (1) are needed
// to build complex filters, multiple clauses can be connected by AND|OR
// if attributes are used, the index of which relation the attribute belongs to, is required
// if sub queries are used, the nesting level needs to be specified (0 = main query, 1 = 1st sub query)
//  this is required as a sub query from the same relation might refer to itself or to a parent query with similar relations/attributes
type DataGetFilter struct {
	Connector string            `json:"connector"` // clause connector (AND|OR), first clause is always AND
	Operator  string            `json:"operator"`  // operator (=, <, >, ...)
	Side0     DataGetFilterSide `json:"side0"`     // comparison: left side
	Side1     DataGetFilterSide `json:"side1"`     // comparison: right side
}
type DataGetFilterSide struct {
	AttributeId     pgtype.UUID    `json:"attributeId"`     // attribute ID, optional
	AttributeIndex  int            `json:"attributeIndex"`  // attribute relation index
	AttributeNested int            `json:"attributeNested"` // attribute nesting level (0 = main query, 1 = 1st sub query)
	Brackets        int            `json:"brackets"`        // brackets before (side0) or after (side1)
	Query           DataGet        `json:"query"`           // sub query, optional
	QueryAggregator pgtype.Varchar `json:"queryAggregator"` // sub query aggregator, optional
	Value           interface{}    `json:"value"`           // fixed value, optional, filled by frontend with value of field/login ID/record/...
}

// a JOIN connects multiple relations via a relationship attribute
// the join index is a unique number for each relation
//  this is required as the same relation can be joined multiple times or even be self-joined
// index from is used to ascertain the join chain until the first relation (usually index=0)
type DataGetJoin struct {
	AttributeId uuid.UUID `json:"attributeId"` // relationship attribute ID
	Connector   string    `json:"connector"`   // join type (INNER, LEFT, etc.)
	Index       int       `json:"index"`       // join relation index
	IndexFrom   int       `json:"indexFrom"`   // index from which this join was joined (0 = source relation join)
}

// an expression can currently be either an attribute or a sub query
type DataGetExpression struct {
	// attribute expression
	AttributeId   pgtype.UUID `json:"attributeId"`   // ID of attribute to retrieve
	AttributeIdNm pgtype.UUID `json:"attributeIdNm"` // ID of n:m attribute to retrieve
	Index         int         `json:"index"`         // relation index attribute belongs to
	OutsideIn     bool        `json:"outsideIn"`     // attribute comes from other relation

	// sub query expression
	Query DataGet `json:"query"` // a regular data GET request

	// expression options
	Aggregator pgtype.Varchar `json:"aggregator"` // set AGGREGATE function (min, max, avg, count, ...)
	Distincted bool           `json:"distincted"` // set DISTINCT
	GroupBy    bool           `json:"groupBy"`    // set GROUP BY
}

type DataGetOrder struct {
	// order by attribute value
	AttributeId pgtype.UUID `json:"attributeId"`
	Index       pgtype.Int4 `json:"index"` // join relation index

	// order by expression
	ExpressionPos pgtype.Int4 `json:"expressionPos"` // array index of expression to order by

	Ascending bool `json:"ascending"` // ascending/descending
}

// data GET request
type DataGet struct {
	RelationId  uuid.UUID           `json:"relationId"`  // source relation ID
	IndexSource int                 `json:"indexSource"` // defines which index is source relation (usually 0 but can be different for getting data from specific, joined relations)
	Joins       []DataGetJoin       `json:"joins"`       // joined relations
	Expressions []DataGetExpression `json:"expressions"` // expressions to get data for (keep order)
	Filters     []DataGetFilter     `json:"filters"`     // result filters (keep order)
	Orders      []DataGetOrder      `json:"orders"`      // result order criteria (keep order)
	Limit       int                 `json:"limit"`       // result limit
	Offset      int                 `json:"offset"`      // result offset
	GetPerm     bool                `json:"getPerm"`     // get result permissions (SET/DEL) from relation policy, GET is ignored as results are filtered by it already
}
type DataGetResult struct {
	IndexRecordIds     map[int]interface{} `json:"indexRecordIds"`     // IDs of relation records, key: relation index
	IndexRecordEncKeys map[int]string      `json:"indexRecordEncKeys"` // record data keys, encrypted with login´s public key, key: relation index
	IndexesPermNoDel   []int               `json:"indexesPermNoDel"`   // if getPerm, relation indexes of which records may not be deleted
	IndexesPermNoSet   []int               `json:"indexesPermNoSet"`   // if getPerm, relation indexes of which records may not be updated
	Values             []interface{}       `json:"values"`             // expression values, same order as requested expressions
}

// data SET request
type DataSetAttribute struct {
	AttributeId   uuid.UUID   `json:"attributeId"`   // attribute ID
	AttributeIdNm pgtype.UUID `json:"attributeIdNm"` // attribute ID for n:m relationship
	OutsideIn     bool        `json:"outsideIn"`     // not from this index, comes from other relation via relationship attribute
	Value         interface{} `json:"value"`
}
type DataSet struct {
	RelationId  uuid.UUID          `json:"relationId"`  // relation ID to update
	AttributeId uuid.UUID          `json:"attributeId"` // attribute ID of relationship to join with
	IndexFrom   int                `json:"indexFrom"`   // from relation index
	RecordId    int64              `json:"recordId"`    // record ID to update (0 if new)
	Attributes  []DataSetAttribute `json:"attributes"`  // attribute values to set
	EncKeysSet  []DataSetEncKeys   `json:"encKeysSet"`  // data encryption keys to store, encrypted with login´s public key
}
type DataSetEncKeys struct {
	LoginId int64  `json:"loginId"`
	KeyEnc  string `json:"keyEnc"` // encrypted data key, stored as base64
}
type DataSetFile struct {
	Id   uuid.UUID `json:"id"`
	Name string    `json:"name"`
	New  bool      `json:"new"`
	Size int64     `json:"size"`
}
type DataSetFiles struct {
	Files           []DataSetFile `json:"files"`
	FileIdMapChange map[uuid.UUID]struct {
		Action string `json:"action"` // create, delete, rename, update
		Name   string `json:"name"`   // file name for reference in change logs (new name if rename action)
	} `json:"fileIdMapChange"`
}
type DataSetResult struct {
	IndexRecordIds map[int]int64 `json:"indexRecordIds"` // IDs of relation records, key: relation index
}

// data LOG request
type DataLog struct {
	Id         uuid.UUID          `json:"id"`
	RelationId uuid.UUID          `json:"relationId"`
	RecordId   int64              `json:"recordId"`
	DateChange int64              `json:"dateChange"`
	LoginName  string             `json:"loginName"`
	Attributes []DataSetAttribute `json:"attributes"`
}
