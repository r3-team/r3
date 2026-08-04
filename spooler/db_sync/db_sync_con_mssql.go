package db_sync

import (
	"database/sql"
	"fmt"
	"net/url"
	"r3/types"

	_ "github.com/microsoft/go-mssqldb"
)

func getDbConMssql(h types.DbSyncHost) (*sql.DB, error) {
	q := url.Values{
		"database": []string{h.DbName},
	}
	u := &url.URL{
		Scheme:   "sqlserver",
		User:     url.UserPassword(h.Username, h.Password),
		Host:     fmt.Sprintf("%s:%d", h.Address, h.Port),
		RawQuery: q.Encode(),
	}
	return sql.Open("sqlserver", u.String())
}
