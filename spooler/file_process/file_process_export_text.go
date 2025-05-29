package file_process

import (
	"bufio"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"r3/config"
	"r3/log"
)

func doExportText(filePath string, fileContentText string, overwrite bool) error {

	// invalid configuration
	if config.File.Paths.FileExport == "" {
		return errConfigNoExportPath
	}

	// invalid parameters, log and then disregard
	if filePath == "" {
		log.Error(log.ContextFile, "ignoring task", errPathEmpty)
		return nil
	}

	// define paths
	filePathTarget := filepath.Join(config.File.Paths.FileExport, filePath)

	log.Info(log.ContextFile, fmt.Sprintf("exporting text file to path '%s'", filePathTarget))

	if err := checkClearFilePath(filePathTarget, overwrite); err != nil {
		if errors.Is(err, errPathExists) || errors.Is(err, errPathIsDir) {
			log.Error(log.ContextFile, "ignoring task", err)
			return nil
		}
		return err
	}

	file, err := os.Create(filePathTarget)
	if err != nil {
		return err
	}
	defer file.Close()

	bufWriter := bufio.NewWriter(file)
	if _, err := bufWriter.WriteString(fileContentText); err != nil {
		return err
	}
	return bufWriter.Flush()
}
