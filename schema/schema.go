package schema

import (
	"context"
	"fmt"
	"r3/types"
	"r3/types/constants"
	"slices"

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
func IsContentFiles(content types.DbSchemaAppAttributeContent) bool {
	return content == constants.DbAttributeContentFiles
}
func IsContentGeometry(content types.DbSchemaAppAttributeContent) bool {
	return content == constants.DbAttributeContentGeometry
}
func IsContentNumeric(content types.DbSchemaAppAttributeContent) bool {
	return content == constants.DbAttributeContentNumeric
}
func IsContentRegconfig(content types.DbSchemaAppAttributeContent) bool {
	return content == constants.DbAttributeContentRegconfig
}
func IsContentRelationship(content types.DbSchemaAppAttributeContent) bool {
	return content == constants.DbAttributeContentRel11 || content == constants.DbAttributeContentRelN1
}
func IsContentRelationship11(content types.DbSchemaAppAttributeContent) bool {
	return content == constants.DbAttributeContentRel11
}
func IsContentText(content types.DbSchemaAppAttributeContent) bool {
	return content == constants.DbAttributeContentVarchar || content == constants.DbAttributeContentText
}
func IsContentUseBarcodeAny(content types.DbSchemaAppAttributeContentUse) bool {
	return slices.Contains([]types.DbSchemaAppAttributeContentUse{
		constants.DbAttributeContentUseBarcode,
		constants.DbAttributeContentUseBarcodeCodabar,
		constants.DbAttributeContentUseBarcodeCode39,
		constants.DbAttributeContentUseBarcodeCode128,
		constants.DbAttributeContentUseBarcodeEan8,
		constants.DbAttributeContentUseBarcodeEan13,
		constants.DbAttributeContentUseBarcodeItf,
		constants.DbAttributeContentUseBarcodeQrcode,
		constants.DbAttributeContentUseBarcodeUpcA,
		constants.DbAttributeContentUseBarcodeUpcE},
		content)
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
