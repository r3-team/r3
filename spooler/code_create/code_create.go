package code_create

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image/png"
	"r3/cache"
	"r3/db"
	"r3/handler"
	"r3/log"
	"r3/schema"
	"strings"

	"github.com/boombuler/barcode"
	"github.com/boombuler/barcode/codabar"
	"github.com/boombuler/barcode/code128"
	"github.com/boombuler/barcode/code39"
	"github.com/boombuler/barcode/ean"
	"github.com/boombuler/barcode/qr"
	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type codeFormat string
type codeJson struct {
	Format codeFormat  `json:"format"`
	Image  pgtype.Text `json:"image"`
	Text   string      `json:"text"`
}
type codeJob struct {
	Id        uuid.UUID // ID from code_spool
	Format    codeFormat
	TextValue string
	SizeX     int
	SizeY     int
	QrErrCorr qr.ErrorCorrectionLevel // L, M, Q, H

	// attach code to files/barcode attribute
	AttributeIdAttach uuid.UUID
	RecordIdAttach    int64
}

const codeFormatCodabar codeFormat = "CODABAR"
const codeFormatCode39 codeFormat = "CODE_39"
const codeFormatCode128 codeFormat = "CODE_128"
const codeFormatEan8 codeFormat = "EAN_8"
const codeFormatEan13 codeFormat = "EAN_13"
const codeFormatUpcA codeFormat = "UPC_A"
const codeFormatUpcE codeFormat = "UPC_E"
const codeFormatItf codeFormat = "ITF"
const codeFormatQr codeFormat = "QR_CODE"

func DoAll() error {

	rows, err := db.Pool.Query(context.Background(), `
		SELECT id, format, text_value, size_x, size_y, qr_err_corr, attribute_id_attach, record_id_attach
		FROM instance.code_spool
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	codes := make([]codeJob, 0)
	for rows.Next() {
		var c codeJob
		if err := rows.Scan(&c.Id, &c.Format, &c.TextValue, &c.SizeX, &c.SizeY,
			&c.QrErrCorr, &c.AttributeIdAttach, &c.RecordIdAttach); err != nil {

			return err
		}
		codes = append(codes, c)
	}
	rows.Close()

	log.Info(log.ContextCode, fmt.Sprintf("found %d codes to be generated", len(codes)))

	for _, c := range codes {

		if err := do(c); err != nil {
			log.Error(log.ContextCode, "unable to generate code", err)
		} else {
			log.Info(log.ContextCode, "successfully generated code")
		}

		// code spooler is single attempt only - if generation fails, new job must be generated
		// reason: in contrast to mailing/REST calls, what we need to generate codes is in our control, if it fails once it will likely fail again
		if _, err := db.Pool.Exec(context.Background(), `DELETE FROM instance.code_spool WHERE id = $1`, c.Id); err != nil {
			return err
		}
	}
	return nil
}

func do(c codeJob) error {

	ctx, ctxCanc := context.WithTimeout(context.Background(), db.CtxDefTimeoutDocGenerate)
	defer ctxCanc()

	cache.Schema_mx.RLock()
	atr, exists := cache.AttributeIdMap[c.AttributeIdAttach]
	cache.Schema_mx.RUnlock()

	if !exists {
		return handler.ErrSchemaUnknownAttribute(c.AttributeIdAttach)
	}

	code, err := generateCode(c.Format, c.TextValue, c.SizeX, c.SizeY, c.QrErrCorr)
	if err != nil {
		return err
	}

	if schema.IsContentFiles(atr.Content) {
		// attach file
		return nil
	}

	if strings.Contains(atr.Content, "barcode") {

		// update barcode attribute with base64 image
		var buf bytes.Buffer
		if err := png.Encode(&buf, code); err != nil {
			return err
		}
		return storeAsTextAttributeValue(ctx, c.AttributeIdAttach, c.RecordIdAttach, codeJson{
			Format: c.Format,
			Image: pgtype.Text{
				String: base64.StdEncoding.EncodeToString(buf.Bytes()),
				Valid:  true,
			},
			Text: c.TextValue,
		})

	}
	return fmt.Errorf("QR-/barcodes can only be stored in files or QR-/barcode attributes")
}

func storeAsTextAttributeValue(ctx context.Context, attributeId uuid.UUID, recordId int64, value codeJson) error {

	valueJson, err := json.Marshal(value)
	if err != nil {
		return err
	}

	modName, relName, atrName, err := cache.GetAttributeDbNames(attributeId)
	if err != nil {
		return err
	}

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, fmt.Sprintf(`
		UPDATE "%s"."%s"
		SET "%s" = $1
		WHERE "%s" = $2
	`, modName, relName, atrName, schema.PkName), valueJson, recordId); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func generateCode(format codeFormat, textValue string, sizeX, sizeY int, qrErrorCorr qr.ErrorCorrectionLevel) (barcode.Barcode, error) {

	var code barcode.Barcode
	var err error

	switch format {
	case codeFormatCodabar:
		code, err = codabar.Encode(textValue)
	case codeFormatCode39:
		code, err = code39.Encode(textValue, true, true)
	case codeFormatCode128:
		code, err = code128.Encode(textValue)
	case codeFormatEan8, codeFormatEan13:
		// EAN format is decided based on content length
		code, err = ean.Encode(textValue)
	case codeFormatQr:
		code, err = qr.Encode(textValue, qrErrorCorr, qr.Auto)
	case codeFormatUpcA:
		// UPC-A is a subset of EAN13, adding a 0 prefix to an EAN13 makes it a UPC-A
		code, err = ean.Encode(fmt.Sprintf("0%s", textValue))
	default:
		// UPC-E is not supported
		return nil, fmt.Errorf("code format '%s' is currently not supported", format)
	}
	if err != nil {
		return nil, err
	}
	return barcode.Scale(code, sizeX, sizeY)
}
