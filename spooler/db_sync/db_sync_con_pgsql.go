package db_sync

import (
	"database/sql"
	"r3/types"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/stdlib"
)

func getDbConPgsql(h types.DbSyncHost) (*sql.DB, error) {
	conf, err := pgx.ParseConfig("")
	if err != nil {
		return nil, err
	}
	conf.Host = h.Address
	conf.Port = uint16(h.Port)
	conf.Database = h.DbName
	conf.User = h.Username
	conf.Password = h.Password

	return stdlib.OpenDB(*conf), nil
}
