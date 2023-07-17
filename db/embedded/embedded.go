/*
controls embedded postgres database via pg_ctl
sets locale for messages (LC_MESSAGES) for parsing call outputs
*/
package embedded

import (
	"path/filepath"
	"r3/config"
)

var (
	dbBin    string // pgsql binary directory
	dbBinCtl string // pgsql service control
	dbData   string // pgsql data directory

	locale string = "en_US"

	msgStarted = "server started"
	msgStopped = "server stopped"
	msgState0  = "no server running"
	msgState1  = "server is running"
)

func GetDbBinPath() string {
	return dbBin
}
func SetPaths() {
	dbBin = config.File.Paths.EmbeddedDbBin
	dbBinCtl = filepath.Join(dbBin, "pg_ctl")
	dbData = config.File.Paths.EmbeddedDbData
}
