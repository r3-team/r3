package request

import (
	"encoding/json"
	"r3/cluster"

	"github.com/gofrs/uuid"
)

func FileRequest(reqJson json.RawMessage, loginId int64) (interface{}, error) {
	var req struct {
		AttributeId uuid.UUID `json:"attributeId"`
		ChooseApp   bool      `json:"chooseApp"`
		FileId      uuid.UUID `json:"fileId"`
		FileHash    string    `json:"fileHash"`
		FileName    string    `json:"fileName"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, cluster.FileRequested(true, loginId, req.AttributeId,
		req.FileId, req.FileHash, req.FileName, req.ChooseApp)
}
