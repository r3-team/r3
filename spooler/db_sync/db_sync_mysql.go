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
	conf.ParseTime = true

	return sql.Open("mysql", conf.FormatDSN())
}
