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
	Id          uuid.UUID         `json:"id"`
	HostId      uuid.UUID         `json:"hostId"`
	Name        string            `json:"name"`
	Comment     string            `json:"comment"`
	CodeSql     string            `json:"codeSql"`
	DateAttempt pgtype.Int8       `json:"dateAttempt"`
	DateSuccess pgtype.Int8       `json:"dateSuccess"`
	JobType     DbSyncJobType     `json:"jobType"` // LOAD, SEND_INSERT, SEND_UPDATE, SEND_DELETE
	Columns     []DbSyncJobColumn `json:"columns"`
	Joins       []QueryJoin       `json:"joins"`
	Lookups     []QueryLookup     `json:"lookups"`
	Active      bool              `json:"active"`

	// LOAD only
	DeleteMissing   bool        `json:"deleteMissing"`   // delete non-existing records
	IntervalSeconds int64       `json:"intervalSeconds"` // execute every X seconds
	PageLimit       pgtype.Int4 `json:"pageLimit"`       // limit rows fetched in one go
}

type DbSyncJobColumn struct {
	AttributeId uuid.UUID `json:"attributeId"`
	Index       int       `json:"index"` // relation index
}
