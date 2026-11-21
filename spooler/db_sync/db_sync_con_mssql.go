package db_sync

import (
	"database/sql"
	"fmt"
	"net/url"
	"r3/types"

	_ "github.com/microsoft/go-mssqldb"
)

func getDbConMssql(h types.DbSyncHost, pw string) (*sql.DB, error) {
	q := url.Values{
		"database": []string{h.DbName},
	}
	u := &url.URL{
		Host:     fmt.Sprintf("%s:%d", h.Address, h.Port),
		Scheme:   "sqlserver",
		RawQuery: q.Encode(),
		User:     url.UserPassword(h.Username, pw),
	}
	return sql.Open("sqlserver", u.String())
}
