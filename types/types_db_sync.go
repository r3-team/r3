package types

import (
	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type DbSyncJobType string

type DbSyncHost struct {
	Id      uuid.UUID `json:"id"`
	Name    string    `json:"name"`
	Comment string    `json:"comment"`
	DbName  string    `json:"dbName"`
	DbType  string    `json:"dbType"` // mssql, mysql, pgsql, clickhouse
	Active  bool      `json:"active"`

	// connection details
	Address  string `json:"address"`
	Port     int    `json:"port"`
	Username string `json:"username"`
	Password string `json:"password"`

	// jobs
	JobIdMap map[uuid.UUID]DbSyncJob `json:"jobIdMap"`
}

// a job to send or receive data from external DB systems
type DbSyncJob struct {
	Id      uuid.UUID     `json:"id"`
	HostId  uuid.UUID     `json:"hostId"`
	Name    string        `json:"name"`
	Comment string        `json:"comment"`
	CodeSql string        `json:"codeSql"`
	JobType DbSyncJobType `json:"jobType"` // LOAD, SEND_INSERT, SEND_UPDATE, SEND_DELETE

	// map to relation attributes
	RelationId   uuid.UUID   `json:"relationId"`   // relation to read from (sending) or write to (receiving)
	AttributeIds []uuid.UUID `json:"attributeIds"` // attributes (in order) to map to parameters (SEND) or expressions (LOAD)

	// receiving only
	DeleteMissing   bool        `json:"deleteMissing"`   // delete non-existing records
	PageLimit       pgtype.Int4 `json:"pageLimit"`       // limit rows fetched in one go
	PgIndexIdLookup pgtype.UUID `json:"pgIndexIdLookup"` // if used, records are identified via attributes assigned to the chosen unique index
}
