package schema

import (
	"fmt"

	"github.com/gofrs/uuid"
)

// constants
var PkName = "id"

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
	return fmt.Sprintf("%s_file", attributeId.String())
}
func GetFilesTableNameRecords(attributeId uuid.UUID) string {
	return fmt.Sprintf("%s_record", attributeId.String())
}
func GetFilesTableNameVersions(attributeId uuid.UUID) string {
	return fmt.Sprintf("%s_version", attributeId.String())
}
