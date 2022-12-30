//go:build windows

package backup

import (
	"path/filepath"
	"r3/config"
	"r3/db/embedded"
)

func getPgDumpPath() string {
	if config.File.Db.Embedded {
		return filepath.Join(embedded.GetDbBinPath(), "pg_dump")
	}
	return "pg_dump"
}
