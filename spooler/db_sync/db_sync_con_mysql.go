package db_sync

import (
	"database/sql"
	"fmt"
	"r3/types"

	"github.com/go-sql-driver/mysql"
)

func getDbConMysql(h types.DbSyncHost, pw string) (*sql.DB, error) {
	conf := mysql.NewConfig()
	conf.User = h.Username
	conf.Passwd = pw
	conf.Addr = fmt.Sprintf("%s:%d", h.Address, h.Port)
	conf.DBName = h.DbName
	conf.ParseTime = true
	conf.Params = map[string]string{
		"charset": "utf8mb4",
	}
	return sql.Open("mysql", conf.FormatDSN())
}
