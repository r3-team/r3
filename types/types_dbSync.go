package types

import (
	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type DbSyncJobType string

const (
	DbSyncJobTypeLoad       DbSyncJobType = "LOAD"
	DbSyncJobTypeSendDelete DbSyncJobType = "SEND_DELETE"
	DbSyncJobTypeSendInsert DbSyncJobType = "SEND_INSERT"
	DbSyncJobTypeSendUpdate DbSyncJobType = "SEND_UPDATE"
)

var (
	DbSyncJobTypesSend = []DbSyncJobType{DbSyncJobTypeSendDelete, DbSyncJobTypeSendInsert, DbSyncJobTypeSendUpdate}
)

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
}

// a job to LOAD from or SEND to external DB systems
type DbSyncJob struct {
	Id          uuid.UUID     `json:"id"`
	HostId      uuid.UUID     `json:"hostId"`
	Name        string        `json:"name"`
	Comment     string        `json:"comment"`
	CodeSql     string        `json:"codeSql"`
	DateAttempt pgtype.Int8   `json:"dateAttempt"`
	DateSuccess pgtype.Int8   `json:"dateSuccess"`
	JobType     DbSyncJobType `json:"jobType"` // LOAD, SEND_INSERT, SEND_UPDATE, SEND_DELETE
	Active      bool          `json:"active"`

	// map to relation attributes
	RelationId   uuid.UUID   `json:"relationId"`   // relation to read from (sending) or write to (receiving)
	AttributeIds []uuid.UUID `json:"attributeIds"` // attributes (in order) to map to parameters (SEND) or expressions (LOAD)

	// LOAD only
	DeleteMissing   bool        `json:"deleteMissing"`   // delete non-existing records
	IntervalSeconds int64       `json:"intervalSeconds"` // execute every X seconds
	PageLimit       pgtype.Int4 `json:"pageLimit"`       // limit rows fetched in one go
	PgIndexIdLookup pgtype.UUID `json:"pgIndexIdLookup"` // if used, records are identified via attributes assigned to the chosen unique index
}
