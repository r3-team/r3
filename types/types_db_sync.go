package types

import (
	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type DbSyncHost struct {
	Name    string `json:"name"`
	Comment string `json:"comment"`
	DbType  string `json:"dbType"` // mssql, mysql, pgsql, clickhouse
	Active  bool   `json:"active"`

	// connection details
	Address  string `json:"address"`
	Port     int    `json:"port"`
	Username string `json:"username"`
	Password string `json:"password"`
}

// a job to send or receive data from external DB systems
type DbSyncJob struct {
	Comment string    `json:"comment"`
	CodeSql string    `json:"codeSql"`
	DbName  string    `json:"dbName"`
	HostId  uuid.UUID `json:"hostId"`
	Sending bool      `json:"sending"` // is sending or receiving

	// map to relation attributes
	RelationId   uuid.UUID   `json:"relationId"`   // relation to read from (sending) or write to (receiving)
	AttributeIds []uuid.UUID `json:"attributeIds"` // attributes (in order) to map to parameters (sending) or expressions (receiving)

	// receiving only
	PgIndexIdLookup pgtype.UUID `json:"pgIndexIdLookup"` // for receiving, to identify unique key attributes

	// sending only
	OnDelete bool `json:"onDelete"` // execute on DELETE
	OnInsert bool `json:"onInsert"` // execute on INSERT
	OnUpdate bool `json:"onUpdate"` // execute on UPDATE
}
