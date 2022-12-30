//go:build linux || darwin

package backup

func getPgDumpPath() string {
	return "pg_dump"
}
