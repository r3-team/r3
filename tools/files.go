package tools

import (
	"crypto/sha256"
	"fmt"
	"io"
	"io/fs"
	"io/ioutil"
	"math/rand"
	"os"
	"path/filepath"
	"strconv"

	"github.com/h2non/filetype"
)

func GetFileContents(filePath string, removeUtf8Bom bool) ([]byte, error) {

	output, err := ioutil.ReadFile(filePath)
	if err != nil {
		return []byte("{}"), err
	}
	if removeUtf8Bom {
		output = RemoveUtf8Bom(output)
	}
	return output, nil
}

func GetFileHash(filePath string) (string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	h := sha256.New()
	if _, err := io.Copy(h, file); err != nil {
		return "", err
	}
	return fmt.Sprintf("%x", h.Sum(nil)), nil
}

func GetFileType(filepath string) (string, error) {
	buf, _ := ioutil.ReadFile(filepath)

	kind, err := filetype.Match(buf)
	if err != nil {
		return "", err
	}

	return kind.MIME.Value, nil
}

func GetFileExtension(fileName string) string {
	var ext string = filepath.Ext(fileName)
	if ext == "" {
		return ext
	}
	return ext[1:len(ext)]
}

func GetFileNameWithoutExt(fileName string) string {
	return fileName[0 : len(fileName)-len(filepath.Ext(fileName))]
}

// attempts to find a unique file path in the given directory dst
// uses numbered file names with random values between min and max value
func GetUniqueFilePath(dst string, min int64, max int64) (string, error) {

	var attempts int = 10
	var maxProper int64 = max - min
	var path string

	for tries := 0; tries < attempts; tries++ {
		path = filepath.Join(dst, strconv.FormatInt(rand.Int63n(maxProper)+min, 10))

		if _, err := os.Stat(path); os.IsNotExist(err) {
			return path, nil
		}
	}
	return "", fmt.Errorf("could not find unique file path after %d attempts", attempts)
}

func FileMove(src string, dst string, copyModTime bool) error {

	// try move first
	if err := os.Rename(src, dst); err == nil {
		return nil
	}

	// error is expected in one case: os.Rename does not move files between disks
	// since moving is much less effort than copy, always try moving first
	// if move fails, we try to execute a regular file copy
	if err := FileCopy(src, dst, copyModTime); err != nil {
		return err
	}

	// delete source file after successful copy
	if err := os.Remove(src); err != nil {

		// source file could not be deleted, delete copied file
		// this is done to not keep an unconsistent state
		if err := os.Remove(dst); err != nil {
			return err
		}
		return err
	}
	return nil
}

func FileCopy(src string, dst string, copyModTime bool) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	if _, err = io.Copy(out, in); err != nil {

		// in case of copy error, try to delete target file
		out.Close()
		_ = os.Remove(dst)

		return err
	}
	if err := out.Sync(); err != nil {
		return err
	}

	if !copyModTime {
		return nil
	}

	// manually close handlers so that chtimes can run
	out.Close()
	in.Close()

	fileInfo, err := os.Stat(src)
	if err != nil {
		return err
	}

	if err := os.Chtimes(dst, fileInfo.ModTime(), fileInfo.ModTime()); err != nil {
		return err
	}
	return nil
}

func Exists(path string) (bool, error) {
	_, err := os.Stat(path)
	if err == nil {
		return true, nil
	}
	if os.IsNotExist(err) {
		return false, nil
	}
	return false, err
}

func PathCreateIfNotExists(path string, perm fs.FileMode) error {
	_, err := os.Stat(path)
	if err == nil {
		return nil
	}
	if !os.IsNotExist(err) {
		return err
	}
	return os.Mkdir(path, perm)
}
