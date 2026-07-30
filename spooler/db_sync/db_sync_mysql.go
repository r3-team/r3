package db_sync

import (
	"database/sql"
	"fmt"
	"r3/types"

	"github.com/go-sql-driver/mysql"
)

func getDbConMysql(h types.DbSyncHost) (*sql.DB, error) {
	conf := mysql.NewConfig()
	conf.User = h.Username
	conf.Passwd = h.Password
	conf.Addr = fmt.Sprintf("%s:%d", h.Address, h.Port)
	conf.DBName = h.DbName
	conf.ParseTime = true
	conf.Params = map[string]string{
		"charset": "utf8mb4", // to make sure any returned text value is UTF8 encoded
	}
	return sql.Open("mysql", conf.FormatDSN())
}
