//go:build !windows

package data_image

import "os/exec"

const fontForTextImage = "DejaVu-Sans"

func setCheckConvertPath(filePathOverwrite string) bool {

	convertPath = "magick"
	if filePathOverwrite != "" {
		convertPath = filePathOverwrite
	}

	_, err := exec.LookPath(convertPath)
	return err == nil
}
