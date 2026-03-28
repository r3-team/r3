package request

import (
	"context"
	"encoding/json"
	"os"
	"r3/config"
	"r3/data"
	"r3/schema/doc"
	"r3/spooler/doc_create"
	"r3/tools"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func DocCopy_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {
	var req struct {
		Id       uuid.UUID `json:"id"`
		ModuleId uuid.UUID `json:"moduleId"`
		NewName  string    `json:"newName"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, doc.Copy_tx(ctx, tx, req.ModuleId, req.Id, req.NewName)
}

func DocCreate(ctx context.Context, reqJson json.RawMessage, loginId int64) (any, error) {
	var req struct {
		DocId             uuid.UUID `json:"docId"`
		RecordIdLoad      int64     `json:"recordIdLoad"`
		AttributeIdTarget uuid.UUID `json:"attributeIdTarget"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	filePath, err := tools.GetUniqueFilePath(config.File.Paths.Temp, 8999999, 9999999)
	if err != nil {
		return nil, err
	}
	fileId, err := uuid.NewV4()
	if err != nil {
		return nil, err
	}
	filename, err := doc_create.Run(ctx, req.DocId, loginId, req.RecordIdLoad, filePath)
	if err != nil {
		return nil, err
	}
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		return nil, err
	}
	fileSizeKb := int64(fileInfo.Size() / 1024)

	if err := data.SetFile(ctx, loginId, req.AttributeIdTarget, fileId, nil, pgtype.Text{String: filePath, Valid: true}, pgtype.Text{}, true); err != nil {
		return nil, err
	}
	return types.DataGetValueFile{
		Id:   fileId,
		Name: filename,
		Size: fileSizeKb,
	}, nil
}

func DocDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {
	var id uuid.UUID
	if err := json.Unmarshal(reqJson, &id); err != nil {
		return nil, err
	}
	return nil, doc.Del_tx(ctx, tx, id)
}

func DocSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {
	var req types.Doc
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, doc.Set_tx(ctx, tx, req)
}
