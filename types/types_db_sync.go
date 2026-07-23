package types

import (
	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type DbSyncHost struct {
	Name    string `json:"name"`
	Comment string `json:"comment"`
	DbName  string `json:"dbName"`
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
	HostId  uuid.UUID `json:"hostId"`
	Name    string    `json:"name"`
	Sending bool      `json:"sending"` // is sending or receiving

	// map to relation attributes
	RelationId   uuid.UUID   `json:"relationId"`   // relation to read from (sending) or write to (receiving)
	AttributeIds []uuid.UUID `json:"attributeIds"` // attributes (in order) to map to parameters (sending) or expressions (receiving)

	// receiving only
	Limit           pgtype.Int4 `json:"limit"`           // limit rows fetched in one go
	PgIndexIdLookup pgtype.UUID `json:"pgIndexIdLookup"` // if used, records are identified via attributes assigned to the chosen unique index

	// sending only
	OnDelete bool `json:"onDelete"` // execute on DELETE
	OnInsert bool `json:"onInsert"` // execute on INSERT
	OnUpdate bool `json:"onUpdate"` // execute on UPDATE
}
