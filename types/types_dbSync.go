package types

import (
	"errors"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type DbSyncDbType string
type DbSyncJobType string

const (
	DbSyncDbTypeClickhouse DbSyncDbType = "clickhouse"
	DbSyncDbTypeFirebird   DbSyncDbType = "firebird"
	DbSyncDbTypePgsql      DbSyncDbType = "pgsql"
	DbSyncDbTypeMssql      DbSyncDbType = "mssql"
	DbSyncDbTypeMysql      DbSyncDbType = "mysql"

	DbSyncJobTypeLoad       DbSyncJobType = "LOAD"
	DbSyncJobTypeSendDelete DbSyncJobType = "SEND_DELETE"
	DbSyncJobTypeSendInsert DbSyncJobType = "SEND_INSERT"
	DbSyncJobTypeSendUpdate DbSyncJobType = "SEND_UPDATE"
)

var (
	DbSyncJobTypesSend       = []DbSyncJobType{DbSyncJobTypeSendDelete, DbSyncJobTypeSendInsert, DbSyncJobTypeSendUpdate}
	ErrJobNoJoins      error = errors.New("job has no relation")
)

type DbSyncHost struct {
	Id      uuid.UUID    `json:"id"`
	Name    string       `json:"name"`
	Comment string       `json:"comment"`
	DbName  string       `json:"dbName"`
	DbType  DbSyncDbType `json:"dbType"`
	Active  bool         `json:"active"`

	// connection details
	Address  string `json:"address"`
	Port     int    `json:"port"`
	Username string `json:"username"`
	Password string `json:"password"`
}

// a job to LOAD from or SEND to external DB systems
type DbSyncJob struct {
	Id      uuid.UUID     `json:"id"`
	HostId  uuid.UUID     `json:"hostId"`
	JobType DbSyncJobType `json:"jobType"`
	Name    string        `json:"name"`
	Comment string        `json:"comment"`
	CodeSql string        `json:"codeSql"`
	Joins   []QueryJoin   `json:"joins"`
	Active  bool          `json:"active"`

	// scheduling (last attempt/success timestamps)
	// updated in cache on executing node (for speed) and DB (for cache reloads)
	DateAttempt pgtype.Int8 `json:"dateAttempt"`
	DateSuccess pgtype.Int8 `json:"dateSuccess"`

	// LOAD
	DeleteMissing   bool          `json:"deleteMissing"`   // delete non-existing records
	IntervalSeconds int64         `json:"intervalSeconds"` // execute every X seconds
	PageLimit       pgtype.Int4   `json:"pageLimit"`       // limit rows fetched in one transaction
	Lookups         []QueryLookup `json:"lookups"`
	SkipLogs        bool          `json:"skipLogs"` // skips expensive data SET logs

	// LOAD, SEND_INSERT, SEND_UPDATE
	Columns []DbSyncJobColumn `json:"columns"`
}

type DbSyncJobColumn struct {
	AttributeId uuid.UUID `json:"attributeId"`
	Index       int       `json:"index"` // relation index
}

type DbSyncJobLog struct {
	JobId        string `json:"jobId"`
	RecordsCount int    `json:"recordsCount"`
	DateRan      int64  `json:"dateRan"`
}
