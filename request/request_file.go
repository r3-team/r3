package request

import (
	"encoding/json"
	"fmt"
	"r3/cluster"
	"r3/data"
	"r3/db"
	"r3/schema"

	"github.com/gofrs/uuid"
)

// request file(s) to be copied (synchronized across all clients for login)
func FilesCopy(reqJson json.RawMessage, loginId int64) (interface{}, error) {
	var req struct {
		AttributeId uuid.UUID   `json:"attributeId"`
		FileIds     []uuid.UUID `json:"fileIds"`
		RecordId    int64       `json:"recordId"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, cluster.FilesCopied(true, loginId,
		req.AttributeId, req.FileIds, req.RecordId)
}

// request file(s) to be pasted
func FilesPaste(reqJson json.RawMessage, loginId int64) (interface{}, error) {
	var req struct {
		SrcAttributeId uuid.UUID   `json:"srcAttributeId"`
		SrcFileIds     []uuid.UUID `json:"srcFileIds"`
		SrcRecordId    int64       `json:"srcRecordId"`
		DstAttributeId uuid.UUID   `json:"dstAttributeId"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return data.CopyFiles(loginId, req.SrcAttributeId,
		req.SrcFileIds, req.SrcRecordId, req.DstAttributeId)
}

// request file to be opened by fat client
func FileRequest(reqJson json.RawMessage, loginId int64) (interface{}, error) {
	var req struct {
		AttributeId uuid.UUID `json:"attributeId"`
		FileId      uuid.UUID `json:"fileId"`
		RecordId    int64     `json:"recordId"`
		ChooseApp   bool      `json:"chooseApp"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	// get current file name and latest hash
	var hash string
	var name string
	if err := db.Pool.QueryRow(db.Ctx, fmt.Sprintf(`
		SELECT v.hash, r.name
		FROM instance_file."%s" AS v
		JOIN instance_file."%s" AS r
			ON  r.file_id   = v.file_id
			AND r.record_id = $1
		WHERE v.file_id = $2
		ORDER BY v.version DESC 
		LIMIT 1
	`, schema.GetFilesTableNameVersions(req.AttributeId),
		schema.GetFilesTableNameRecords(req.AttributeId)),
		req.RecordId, req.FileId).Scan(&hash, &name); err != nil {
		return nil, err
	}

	return nil, cluster.FileRequested(true, loginId,
		req.AttributeId, req.FileId, hash, name, req.ChooseApp)
}
