package data

import (
	"fmt"
	"r3/db"
	"r3/schema"
	"r3/tools"
	"r3/types"

	"github.com/gofrs/uuid"
)

func CopyFiles(loginId int64, srcAttributeId uuid.UUID, srcFileIds []uuid.UUID,
	dstAttributeId uuid.UUID) ([]types.DataGetValueFile, error) {

	files := make([]types.DataGetValueFile, 0)

	// check access to source/destination attribute
	if err := MayAccessFile(loginId, srcAttributeId); err != nil {
		return files, err
	}
	if err := MayAccessFile(loginId, dstAttributeId); err != nil {
		return files, err
	}

	srcRelFile := schema.GetFilesTableName(srcAttributeId)
	srcRelVersion := schema.GetFilesTableNameVersions(srcAttributeId)
	dstRelFile := schema.GetFilesTableName(dstAttributeId)
	dstRelVersion := schema.GetFilesTableNameVersions(dstAttributeId)

	rows, err := db.Pool.Query(db.Ctx, fmt.Sprintf(`
		SELECT f.id, f.name, v.hash, v.size_kb, v.date_change
		FROM instance_file."%s" AS f
		JOIN instance_file."%s" AS v
			ON  v.file_id = f.id
			AND v.version = (
				SELECT MAX(version)
				FROM instance_file."%s" AS v
				WHERE file_id = f.id
			)
		WHERE f.id = ANY($1)
	`, srcRelFile, srcRelVersion, srcRelVersion), srcFileIds)
	if err != nil {
		return files, err
	}

	for rows.Next() {
		var f types.DataGetValueFile
		if err := rows.Scan(&f.Id, &f.Name, &f.Hash, &f.Size, &f.Changed); err != nil {
			return files, err
		}
		files = append(files, f)
	}
	rows.Close()

	// check if all requested files exist before starting
	for _, f := range files {
		exists, err := tools.Exists(GetFilePathVersion(srcAttributeId, f.Id, f.Version))
		if err != nil {
			return files, err
		}
		if !exists {
			return files, fmt.Errorf("file requested to be copied ('%s') cannot be found", f.Id)
		}
	}
	for i, f := range files {

		// create new file ID
		idNew, err := uuid.NewV4()
		if err != nil {
			return files, err
		}

		srcPath := GetFilePathVersion(srcAttributeId, f.Id, f.Version)
		dstPath := GetFilePathVersion(dstAttributeId, idNew, 0)

		if err := tools.FileCopy(srcPath, dstPath, false); err != nil {
			return files, err
		}

		// insert every successfully created file immediately
		// (to have the reference to clean in case of issues)
		tx, err := db.Pool.Begin(db.Ctx)
		if err != nil {
			return files, err
		}

		if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
			INSERT INTO instance_file."%s" (id, name)
			VALUES ($1,$2)
		`, dstRelFile), idNew, f.Name); err != nil {
			tx.Rollback(db.Ctx)
			return files, err
		}
		if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
			INSERT INTO instance_file."%s" (
				file_id, version, login_id, hash, size_kb, date_change)
			VALUES ($1,$2,$3,$4,$5,$6)
		`, dstRelVersion), idNew, 0, loginId, f.Hash, f.Size, f.Changed); err != nil {
			tx.Rollback(db.Ctx)
			return files, err
		}
		if err := tx.Commit(db.Ctx); err != nil {
			return files, err
		}

		// file written successfully
		files[i].Id = idNew
		files[i].Version = 0
	}
	return files, nil
}
