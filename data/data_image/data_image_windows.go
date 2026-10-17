//go:build windows

package data_image

import (
	"r3/tools"
)

const fontForTextImage = "Verdana"

func setCheckConvertPath(filePathOverwrite string) bool {

	convertPath = "imagemagick/magick.exe"
	if filePathOverwrite != "" {
		convertPath = filePathOverwrite
	}

	exists, err := tools.Exists(convertPath)
	if err != nil {
		return false
	}
	return exists
}
