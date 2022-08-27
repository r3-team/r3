package request

import (
	"encoding/json"
	"fmt"
	"r3/cluster"
	"r3/db"
	"r3/schema"

	"github.com/gofrs/uuid"
)

func FileRequest(reqJson json.RawMessage, loginId int64) (interface{}, error) {
	var req struct {
		AttributeId uuid.UUID `json:"attributeId"`
		FileId      uuid.UUID `json:"fileId"`
		ChooseApp   bool      `json:"chooseApp"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	// get current file name and latest hash
	var hash string
	var name string
	if err := db.Pool.QueryRow(db.Ctx, fmt.Sprintf(`
		SELECT v.hash, f.name
		FROM instance_file."%s" AS v
		JOIN instance_file."%s" AS f ON f.id = v.file_id
		WHERE v.file_id = $1
		ORDER BY version DESC 
		LIMIT 1
	`, schema.GetFilesTableNameVersions(req.AttributeId),
		schema.GetFilesTableName(req.AttributeId)),
		req.FileId).Scan(&hash, &name); err != nil {
		return nil, err
	}

	return nil, cluster.FileRequested(true, loginId,
		req.AttributeId, req.FileId, hash, name, req.ChooseApp)
}
