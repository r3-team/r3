package db

import (
	"context"
	"fmt"
	"net/url"
	"r3/tools"
	"r3/types"
	"strings"
	"time"

	"github.com/jackc/pgtype"
	"github.com/jackc/pgx/v4/pgxpool"
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
	var err error

	// connect_timeout specifies how long new connections wait for DB to respond
	// it has no influence on initial DB connection
	conString := fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=disable&connect_timeout=5",
		config.User, url.QueryEscape(config.Pass), config.Host, config.Port, config.Name)

	poolConfig, err := pgxpool.ParseConfig(conString)
	if err != nil {
		return err
	}

	Pool, err = pgxpool.ConnectConfig(context.Background(), poolConfig)
	if err != nil {
		return err
	}

	if err := Pool.Ping(context.Background()); err != nil {
		return err
	}
	return nil
}

func Close() {
	Pool.Close()
	Pool = nil
}

func PgxNumericToString(value pgtype.Numeric) string {
	s := value.Int.String()
	l := len(s)
	e := int(value.Exp)

	// zero exponent, as in 12 (int=12, len=2, exp=0)
	if e == 0 {
		return s
	}

	// positive exponent, as in 2500 (int=25, len=2, exp=2)
	if e > 0 {
		return fmt.Sprintf("%s%s", s, strings.Repeat("0", e))
	}

	// negative exponents
	// equals out length, as in 0.12 (int=12, len=2, exp=-2)
	if l+e == 0 {
		return fmt.Sprintf("0.%s", s)
	}

	// below zero, as in 0.012 (int=12, len=2, exp=-3)
	if l+e < 0 {
		return fmt.Sprintf("0.%s%s", strings.Repeat("0", (l+e)-((l+e)*2)), s)
	}

	// above zero, as in 11.1 (int=111, len=3, exp=-1)
	return fmt.Sprintf("%s.%s", s[0:l+e], s[l+e:])
}
