package schema

import (
	"fmt"
	"r3/types"
	"strings"

	"github.com/gofrs/uuid/v5"
)

// constants
const PkName = "id"

// database entity names
func GetPkConstraintName(relationId uuid.UUID) string {
	return fmt.Sprintf("pk_%s", relationId.String())
}
func GetFkConstraintName(attributeId uuid.UUID) string {
	return fmt.Sprintf("fk_%s", attributeId.String())
}
func GetSequenceName(relationId uuid.UUID) string {
	return fmt.Sprintf("sq_%s", relationId.String())
}
func GetPgIndexName(pgIndexId uuid.UUID) string {
	return fmt.Sprintf("ind_%s", pgIndexId.String())
}
func GetEncKeyTableName(relationId uuid.UUID) string {
	return fmt.Sprintf("keys_%s", relationId.String())
}
func GetFilesTableName(attributeId uuid.UUID) string {
	return fmt.Sprintf("%s_record", attributeId.String())
}
func GetFilesTriggerName(attributeId uuid.UUID) string {
	return fmt.Sprintf("trg_%s_record", attributeId.String())
}
func GetDbSyncTriggerName(relationId uuid.UUID, jobType types.DbSyncJobType) string {
	return fmt.Sprintf("trg_%s_db_sync_%s", relationId, strings.ToLower(fmt.Sprintf("%s", jobType)))
}
