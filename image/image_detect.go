package image

import (
	"net/http"
	"os"
)

func detectType(filePath string) (string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	// read first 512 bytes to detect content type
	// http://golang.org/pkg/net/http/#DetectContentType
	fileBytes := make([]byte, 512)
	if _, err := file.Read(fileBytes); err != nil {
		return "", err
	}
	return http.DetectContentType(fileBytes), nil
}
