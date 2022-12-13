package request

import (
	"r3/backup"
)

func BackupGet() (interface{}, error) {
	return backup.TocFileReadCreate()
}
