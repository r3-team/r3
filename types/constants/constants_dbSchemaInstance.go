package constants

import "r3/types"

const (
	// tables, columns in instance schema
	DbLoginProviderOauth types.DbSchemaInstance = "oauth_client"
	DbLoginProviderLdap  types.DbSchemaInstance = "ldap"

	// ENUM types in instance schema
	DbLoginSessionDeviceBrowser   types.DbSchemaInstanceLoginSessionDevice = "browser"
	DbLoginSessionDeviceFatClient types.DbSchemaInstanceLoginSessionDevice = "fatClient"

	DbSyncDbTypeClickhouse types.DbSyncDbType = "clickhouse"
	DbSyncDbTypeFirebird   types.DbSyncDbType = "firebird"
	DbSyncDbTypePgsql      types.DbSyncDbType = "pgsql"
	DbSyncDbTypeMssql      types.DbSyncDbType = "mssql"
	DbSyncDbTypeMysql      types.DbSyncDbType = "mysql"

	DbSyncJobTypeLoad       types.DbSyncJobType = "LOAD"
	DbSyncJobTypeSendDelete types.DbSyncJobType = "SEND_DELETE"
	DbSyncJobTypeSendInsert types.DbSyncJobType = "SEND_INSERT"
	DbSyncJobTypeSendUpdate types.DbSyncJobType = "SEND_UPDATE"
)

var (
	DbSyncJobTypesSend = []types.DbSyncJobType{DbSyncJobTypeSendDelete, DbSyncJobTypeSendInsert, DbSyncJobTypeSendUpdate}
)
