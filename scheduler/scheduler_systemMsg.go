package scheduler

import (
	"context"
	"r3/cluster"
	"r3/config"
	"r3/db"
	"r3/tools"
)

// switch to maintenance mode after system message expired
// if feature is enabled and system is not already in maintenance mode
func systemMsgMaintenance() error {
	date1 := config.GetUint64("systemMsgDate1")
	now := uint64(tools.GetTimeUnix())
	switchToMaintenance := config.GetUint64("systemMsgMaintenance") == 1
	systemInMaintenance := config.GetUint64("productionMode") == 0

	if date1 != 0 && date1 < now && switchToMaintenance && !systemInMaintenance {
		ctx, ctxCanc := context.WithTimeout(context.Background(), db.CtxDefTimeoutSysTask)
		defer ctxCanc()

		tx, err := db.Pool.Begin(ctx)
		if err != nil {
			return err
		}
		defer tx.Rollback(ctx)

		if err := config.SetUint64_tx(ctx, tx, "systemMsgMaintenance", 0); err != nil {
			return err
		}
		if err := config.SetUint64_tx(ctx, tx, "productionMode", 0); err != nil {
			return err
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
		cluster.ConfigChanged(true, false, true)
	}
	return nil
}
