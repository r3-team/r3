package request

import (
	"path/filepath"
	"r3/config"
	"r3/transfer"
)

func PackageInstall() (interface{}, error) {
	return nil, transfer.ImportFromFiles(
		[]string{filepath.Join(config.File.Paths.Packages, "core_company.rei3")})
}
