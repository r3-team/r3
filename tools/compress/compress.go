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

	return filepath.Walk(sourcePath, func(pathWalked string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// directories do not need to be created in zip files
		if info.IsDir() {
			return nil
		}

		// ignore non-regular files (symbolic links, devices, named pipes, sockets, ...)
		if !info.Mode().IsRegular() {
			return nil
		}

		fileWalked, err := os.Open(pathWalked)
		if err != nil {
			return err
		}
		defer fileWalked.Close()

		// trim source directory from file path
		pathWalkedRel := strings.TrimPrefix(pathWalked, filepath.Dir(sourcePath)+string(os.PathSeparator))

		zipFileWriter, err := zipWriter.Create(pathWalkedRel)
		if err != nil {
			return err
		}

		_, err = io.Copy(zipFileWriter, fileWalked)
		return err
	})
}
