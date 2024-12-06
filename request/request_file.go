package request

import (
	"context"
	"encoding/json"
	"r3/data"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

// request file(s) to be pasted
func filesPaste_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage, loginId int64) (interface{}, error) {
	var req struct {
		SrcAttributeId uuid.UUID   `json:"srcAttributeId"`
		SrcFileIds     []uuid.UUID `json:"srcFileIds"`
		SrcRecordId    int64       `json:"srcRecordId"`
		DstAttributeId uuid.UUID   `json:"dstAttributeId"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return data.CopyFiles_tx(ctx, tx, loginId, req.SrcAttributeId, req.SrcFileIds, req.SrcRecordId, req.DstAttributeId)
}
