package db_sync

import (
	"database/sql"
	"fmt"
	"r3/types"

	"github.com/ClickHouse/clickhouse-go/v2"
)

func getDbConClickhouse(h types.DbSyncHost, pw string) (*sql.DB, error) {
	return clickhouse.OpenDB(&clickhouse.Options{
		Addr: []string{fmt.Sprintf("%s:%d", h.Address, h.Port)},
		Auth: clickhouse.Auth{
			Database: h.DbName,
			Username: h.Username,
			Password: pw,
		},
		Compression: &clickhouse.Compression{
			Method: clickhouse.CompressionLZ4,
		},
	}), nil
}
