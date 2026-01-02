package request

import (
	"context"
	"r3/cluster"
	"r3/config"

	"github.com/jackc/pgx/v5"
)

func LicenseDel_tx(ctx context.Context, tx pgx.Tx) (any, error) {
	if err := config.SetString_tx(ctx, tx, "licenseFile", ""); err != nil {
		return nil, err
	}
	return nil, cluster.ConfigChanged_tx(ctx, tx, true, false, false)
}
