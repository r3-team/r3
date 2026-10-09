package schema

import (
	"context"
	"fmt"
	"r3/types"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

// checks whether a record exists for the given primary ID
func CheckId_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID, entity types.DbSchemaApp, pkName string) (bool, error) {
	var known bool
	err := tx.QueryRow(ctx, fmt.Sprintf(`SELECT EXISTS(SELECT 1 FROM app.%s WHERE "%s" = $1)`, entity, pkName), id).Scan(&known)
	return known, err
}

// attribute checks
func IsContentFiles(content string) bool {
	return content == "files"
}
func IsContentGeometry(content string) bool {
	return content == "geometry"
}
func IsContentNumeric(content string) bool {
	return content == "numeric"
}
func IsContentRegconfig(content string) bool {
	return content == "regconfig"
}
func IsContentRelationship(content string) bool {
	return content == "1:1" || content == "n:1"
}
func IsContentRelationship11(content string) bool {
	return content == "1:1"
}
func IsContentText(content string) bool {
	return content == "varchar" || content == "text"
}
func GetPgTypeByAttributeContent(content string) (string, error) {
	switch content {
	case "integer", "bigint", "numeric", "real", "double precision", "text", "varchar", "boolean", "regconfig", "uuid", "geometry":
		return content, nil
	case "1:1", "n:1":
		return "bigint", nil
	}
	return "", fmt.Errorf("attribute content '%s' cannot be mapped to a native Postgres type", content)
}

// scheduler checks
func GetValidAtDay(intervalType string, atDay int) int {
	switch intervalType {
	case "months":
		// day < 1 would go to previous month, which is undesirable on a monthly interval
		if atDay < 1 || atDay > 31 {
			atDay = 1
		}
	case "weeks":
		// 0 = Sunday, 6 = Saturday
		if atDay < 0 || atDay > 6 {
			atDay = 1
		}
	case "years":
		if atDay > 365 {
			atDay = 1
		}
	}
	return atDay
}
