package request

import (
	"encoding/json"
	"r3/data"

	"github.com/gofrs/uuid"
)

// request file(s) to be pasted
func filesPaste(reqJson json.RawMessage, loginId int64) (interface{}, error) {
	var req struct {
		SrcAttributeId uuid.UUID   `json:"srcAttributeId"`
		SrcFileIds     []uuid.UUID `json:"srcFileIds"`
		SrcRecordId    int64       `json:"srcRecordId"`
		DstAttributeId uuid.UUID   `json:"dstAttributeId"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return data.CopyFiles(loginId, req.SrcAttributeId, req.SrcFileIds, req.SrcRecordId, req.DstAttributeId)
}
