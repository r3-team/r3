package request

import (
	"r3/backup"
	"r3/config"
	"r3/types"
)

func BackupGet() (any, error) {

	// no backup directory set, return empty value
	if config.GetString("backupDir") == "" {
		return types.BackupTocFile{Backups: make([]types.BackupDef, 0)}, nil
	}
	return backup.TocFileReadCreate()
}
