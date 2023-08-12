//go:build windows

package data_image

import (
	"r3/tools"
)

func setCheckConvertPath(filePathOverwrite string) bool {

	convertPath = "imagemagick/convert.exe"
	if filePathOverwrite != "" {
		convertPath = filePathOverwrite
	}

	exists, err := tools.Exists(convertPath)
	if err != nil {
		return false
	}
	return exists
}
