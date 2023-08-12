package compress

import (
	"archive/zip"
	"io"
	"os"
	"path/filepath"
	"strings"
)

func Path(zipPath string, sourcePath string) error {

	zipFile, err := os.Create(zipPath)
	if err != nil {
		return err
	}
	defer zipFile.Close()

	zipWriter := zip.NewWriter(zipFile)
	defer zipWriter.Close()

	sourcePathInfo, err := os.Stat(sourcePath)
	if err != nil {
		return err
	}

	var baseDir string
	if sourcePathInfo.IsDir() {
		baseDir = filepath.Base(sourcePath)
	}

	filepath.Walk(sourcePath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// ignore directories themselves
		// included files have header paths which include their respective paths
		if info.IsDir() {
			return nil
		}

		header, err := zip.FileInfoHeader(info)
		if err != nil {
			return err
		}

		if baseDir != "" {
			// trim prefix to remove source path from file path inside zip
			header.Name = strings.Trim(strings.TrimPrefix(path, filepath.Clean(sourcePath)), "/\\")
		}
		header.Method = zip.Deflate

		writer, err := zipWriter.CreateHeader(header)
		if err != nil {
			return err
		}

		file, err := os.Open(path)
		if err != nil {
			return err
		}
		defer file.Close()

		_, err = io.Copy(writer, file)
		return err
	})
	return nil
}
