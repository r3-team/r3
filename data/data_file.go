package data

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"r3/cache"
	"r3/config"
	"r3/handler"
	"r3/schema"
	"r3/tools"

	"github.com/gofrs/uuid"
)

// returns path to downloadable file
func GetFilePath(loginId int64, attributeId uuid.UUID, fileId uuid.UUID) (string, error) {

	attribute, exists := cache.AttributeIdMap[attributeId]
	if !exists || !schema.IsContentFiles(attribute.Content) {
		return "", errors.New("not a file attribute")
	}

	// check for authorized access, READ(1) for GET
	if !authorizedAttribute(loginId, attributeId, 1) {
		return "", errors.New(handler.ErrUnauthorized)
	}
	return filepath.Join(config.File.Paths.Files, attribute.Id.String(), fileId.String()), nil
}

// attempts to store file upload
// returns file ID if successful
func SetFile(loginId int64, attributeId uuid.UUID, part *multipart.Part) (uuid.UUID, error) {

	var fileId uuid.UUID

	attribute, exists := cache.AttributeIdMap[attributeId]
	if !exists || !schema.IsContentFiles(attribute.Content) {
		return fileId, errors.New("attribute is invalid")
	}

	// check for authorized access, WRITE(2) for SET
	if !authorizedAttribute(loginId, attributeId, 2) {
		return fileId, errors.New(handler.ErrUnauthorized)
	}

	// place file with new UUID in temp dir
	fileId, err := uuid.NewV4()
	if err != nil {
		return fileId, err
	}
	filePath := filepath.Join(config.File.Paths.Temp, fileId.String())

	exists, err = tools.Exists(filePath)
	if err != nil || exists {
		return fileId, fmt.Errorf("could not create unique file ID '%s' in temp directory, err: %v",
			fileId, err)
	}

	dest, err := os.Create(filePath)
	if err != nil {
		return fileId, err
	}

	if _, err := io.Copy(dest, part); err != nil {
		dest.Close()
		return fileId, err
	}
	dest.Close()

	// write file
	buf := new(bytes.Buffer)
	if _, err := buf.ReadFrom(part); err != nil {
		return fileId, err
	}

	// check size
	if attribute.Length != 0 {
		fileInfo, err := os.Stat(filePath)
		if err != nil {
			return fileId, err
		}

		if int64(fileInfo.Size()/1024) > int64(attribute.Length) {
			return fileId, errors.New("file size limit reached")
		}
	}
	return fileId, nil
}
