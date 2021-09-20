package config

import (
	"encoding/json"
	"errors"
	"path/filepath"
	"tools"
)

var (
	captionByCode = make(map[string]json.RawMessage) // app captions, key = language code (en_us, ...)
)

// get all captions by language code
func GetAppCaptions(code string) (json.RawMessage, error) {
	access_mx.Lock()
	defer access_mx.Unlock()

	if _, exists := captionByCode[code]; !exists {
		return json.RawMessage{}, errors.New("language code does not exist")
	}
	return captionByCode[code], nil
}

// load application captions into memory for regular retrieval
func InitAppCaptions() (err error) {
	access_mx.Lock()
	defer access_mx.Unlock()

	// load application captions from text files
	for _, code := range languageCodes {

		captionByCode[code], err = tools.GetFileContents(
			filepath.Join(File.Paths.Captions, code), true)

		if err != nil {
			return err
		}
	}
	return nil
}
