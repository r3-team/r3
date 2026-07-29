package cache_dbSync

import (
	"context"
	"r3/db"
	"r3/types"
	"sync"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

var (
	access_mx sync.RWMutex
	hostIdMap = make(map[uuid.UUID]types.DbSyncHost)
	jobIdMap  = make(map[uuid.UUID]types.DbSyncJob)
)

func Load() error {
	ctx, ctxCanc := context.WithTimeout(context.Background(), db.CtxDefTimeoutSysTask)
	defer ctxCanc()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	return Load_tx(ctx, tx)
}

func Load_tx(ctx context.Context, tx pgx.Tx) error {
	if err := LoadHosts_tx(ctx, tx); err != nil {
		return err
	}
	if err := LoadJobs_tx(ctx, tx); err != nil {
		return err
	}
	return nil
}
