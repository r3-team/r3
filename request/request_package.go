package request

import (
	"context"
	"os"
	"r3/cache"
	"r3/config"
	"r3/tools"
	"r3/transfer"

	"github.com/jackc/pgx/v5"
)

func PackageInstall_tx(ctx context.Context, tx pgx.Tx) (interface{}, error) {

	// store package file from embedded binary data to temp folder
	filePath, err := tools.GetUniqueFilePath(config.File.Paths.Temp, 8999999, 9999999)
	if err != nil {
		return nil, err
	}

	if err := os.WriteFile(filePath, cache.Package_CoreCompany, 0644); err != nil {
		return nil, err
	}

	return nil, transfer.ImportFromFiles_tx(ctx, tx, []string{filePath})
}
