package db_sync

import (
	"database/sql"
	"fmt"
	"net/url"
	"r3/types"

	_ "github.com/nakagami/firebirdsql"
)

func getDbConFirebird(h types.DbSyncHost) (*sql.DB, error) {
	q := url.Values{
		"charset": []string{"UTF8"},
	}
	u := &url.URL{
		Host:     fmt.Sprintf("%s:%d", h.Address, h.Port),
		Path:     h.DbName,
		RawQuery: q.Encode(),
		User:     url.UserPassword(h.Username, h.Password),
	}
	// remove leading slashes '//' from DSN URL
	return sql.Open("firebirdsql", u.String()[2:])
}
