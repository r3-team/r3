package db

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/url"
	"r3/tools"
	"r3/types"
	"time"

	pgxuuid "github.com/jackc/pgx-gofrs-uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var Ctx = context.TODO()
var Pool *pgxpool.Pool

// attempts to open a database connection
// repeat attempts until successful or predefined time limit is reached
func OpenWait(timeoutSeconds int64, config types.FileTypeDb) error {

	started := tools.GetTimeUnix()
	var err error

	for tools.GetTimeUnix()-started < timeoutSeconds {
		err = Open(config)
		if err == nil {
			return nil
		}
		time.Sleep(time.Millisecond * 500)
	}
	return fmt.Errorf("timeout reached, last error: %s", err)
}

func Open(config types.FileTypeDb) error {

	sslMode := "disable"
	if config.Ssl {
		sslMode = "require"
	}

	// connect_timeout specifies how long new connections wait for DB to respond
	// it has no influence on initial DB connection
	conString := fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=%s&connect_timeout=5",
		config.User, url.QueryEscape(config.Pass), config.Host, config.Port, config.Name, sslMode)

	poolConfig, err := pgxpool.ParseConfig(conString)
	if err != nil {
		return err
	}

	if config.Ssl {
		poolConfig.ConnConfig.TLSConfig = &tls.Config{
			InsecureSkipVerify: config.SslSkipVerify,
			ServerName:         config.Host,
		}
	}

	poolConfig.AfterConnect = func(ctx context.Context, con *pgx.Conn) error {
		pgxuuid.Register(con.TypeMap())
		return err
	}

	Pool, err = pgxpool.NewWithConfig(context.Background(), poolConfig)
	if err != nil {
		return err
	}
	return Pool.Ping(context.Background())
}

func Close() {
	Pool.Close()
	Pool = nil
}
