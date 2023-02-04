package request

import (
	"encoding/json"
	"fmt"
	"r3/db"
	"r3/schema"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// returns deleted or unassigned files
func FileGet() (interface{}, error) {
	type file struct {
		Id       uuid.UUID   `json:"id"`
		Name     string      `json:"name"`
		Size     int64       `json:"size"`
		Deleted  pgtype.Int8 `json:"deleted"`
		RecordId pgtype.Int8 `json:"recordId"`
	}

	var res struct {
		AttributeIdMapDeleted map[uuid.UUID][]file `json:"attributeIdMapDeleted"`
	}
	res.AttributeIdMapDeleted = make(map[uuid.UUID][]file)

	attributeIdsFile := make([]uuid.UUID, 0)
	if err := db.Pool.QueryRow(db.Ctx, `
		SELECT ARRAY_AGG(id)
		FROM app.attribute
		WHERE content = 'files'
	`).Scan(&attributeIdsFile); err != nil {
		return nil, err
	}

	// get files which record assignment was deleted
	// if file is assigned to multiple records, return all
	// files without record assignment are just deleted in cleanup, not retrieved here
	for _, atrId := range attributeIdsFile {
		rows, err := db.Pool.Query(db.Ctx, fmt.Sprintf(`
			SELECT file_id, name, date_delete, record_id, (
				SELECT v.size_kb
				FROM instance.file_version AS v
				WHERE v.file_id = r.file_id
				ORDER BY v.version DESC
				LIMIT 1
			)
			FROM instance_file."%s" AS r
			WHERE date_delete IS NOT NULL
			ORDER BY date_delete ASC NULLS LAST, name ASC
		`, schema.GetFilesTableName(atrId)))
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var f file
			if err := rows.Scan(&f.Id, &f.Name, &f.Deleted, &f.RecordId, &f.Size); err != nil {
				return nil, err
			}

			if _, exists := res.AttributeIdMapDeleted[atrId]; !exists {
				res.AttributeIdMapDeleted[atrId] = make([]file, 0)
			}
			res.AttributeIdMapDeleted[atrId] = append(res.AttributeIdMapDeleted[atrId], f)
		}
		rows.Close()
	}
	return res, nil
}

// removed deletion state from file
// file must still be assigned to a record to be restored to its file attribute
func FileRestore(reqJson json.RawMessage) (interface{}, error) {
	var req struct {
		AttributeId uuid.UUID `json:"attributeId"`
		FileId      uuid.UUID `json:"fileId"`
		RecordId    int64     `json:"recordId"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	_, err := db.Pool.Exec(db.Ctx, fmt.Sprintf(`
		UPDATE instance_file."%s"
		SET date_delete = NULL
		WHERE file_id   = $1
		AND   record_id = $2
	`, schema.GetFilesTableName(req.AttributeId)), req.FileId, req.RecordId)
	return nil, err
}
