package image

import (
	"bufio"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"r3/config"
	"r3/log"
	"r3/tools"
	"strings"
	"sync"

	"github.com/gofrs/uuid"
)

var (
	canProcess         bool                       // has access to image converter
	convertPath        string                     // path to image converter
	fileIdMapFailed    = make(map[uuid.UUID]bool) // map of file IDs that failed processing before
	fileIdMapFailed_mx sync.Mutex
	fileIdMapQueue     = make(map[uuid.UUID][]chan error) // tells requestors when their processing is done
	fileIdMapQueue_mx  sync.Mutex
	workChan           = make(chan bool, 2) // channel to limit concurrent workers
)

// checks whether app has access to expected image processing commands and sets appropriate path to image converter
func PrepareProcessing(filePathOverwrite string) {
	canProcess = setCheckConvertPath(filePathOverwrite)

	log.Info("imager", fmt.Sprintf("started, processing capabilities: %v", canProcess))
}

func GetCanProcess() bool {
	return canProcess
}

// create a thumbnail for given file
// optionally waits for result to use it directly
func CreateThumbnail(fileId uuid.UUID, ext string, src string,
	dst string, waitForResult bool) error {

	// abort if it cannot process images
	if !canProcess {
		return errors.New("no image processing capabilities")
	}

	// abort if failed before
	fileIdMapFailed_mx.Lock()
	if _, exists := fileIdMapFailed[fileId]; exists {
		fileIdMapFailed_mx.Unlock()
		return errors.New("failed previously")
	}
	fileIdMapFailed_mx.Unlock()

	// start concurrent thumbnail creation if not already queued up
	fileIdMapQueue_mx.Lock()
	if _, exists := fileIdMapQueue[fileId]; !exists {
		fileIdMapQueue[fileId] = make([]chan error, 0)
		go processFile(fileId, ext, src, dst)
	}

	// return immediately if requestor does not want to wait for result
	if !waitForResult {
		fileIdMapQueue_mx.Unlock()
		return nil
	}

	// add own error channel to queue to wait for result
	errChan := make(chan error, 1)
	fileIdMapQueue[fileId] = append(fileIdMapQueue[fileId], errChan)
	fileIdMapQueue_mx.Unlock()

	// wait for result
	return <-errChan
}

func processFile(fileId uuid.UUID, ext string, src string, dst string) {

	// request worker
	var returnErr error = nil
	workChan <- true

	// clean extension
	ext = strings.ToLower(strings.Replace(ext, ".", "", -1))

	log.Info("imager", fmt.Sprintf("is working on file '%s' (%s)", fileId, ext))

	defer func() {
		fileIdMapQueue_mx.Lock()
		if _, exists := fileIdMapQueue[fileId]; exists {

			// inform and then close waiting channels
			for _, ch := range fileIdMapQueue[fileId] {
				ch <- returnErr
				close(ch)
			}
			delete(fileIdMapQueue, fileId)
		}
		fileIdMapQueue_mx.Unlock()

		// register & log failure
		if returnErr != nil {
			fileIdMapFailed_mx.Lock()
			fileIdMapFailed[fileId] = true
			fileIdMapFailed_mx.Unlock()

			log.Warning("imager", "failed to create thumbnail", returnErr)
		}

		// free up worker
		<-workChan
	}()

	// define working parameters
	var appArgs []string
	quality := "70"
	sizeWidth := config.GetUint64("imagerThumbWidth")

	switch ext {

	// image thumbnails
	case "bmp", "jpeg", "jpg", "png", "svg", "webp":
		appArgs = []string{"-quality", quality, "-resize", fmt.Sprintf("x%d", sizeWidth),
			fmt.Sprintf("%s", src), dst}

	// gif thumbnail, [0] defines first frame of GIF
	case "gif":
		appArgs = []string{"-quality", quality, "-resize", fmt.Sprintf("x%d", sizeWidth),
			fmt.Sprintf("%s[0]", src), dst}

	// GIMP merged layer thumbnail
	case "xcf":
		appArgs = []string{"-background", "none", "-alpha", "on", "-layers", "merge",
			"-scale", "50%", fmt.Sprintf("%s", src), dst}

	// Photoshop merged layer thumbnail
	case "psd":
		appArgs = []string{"-auto-orient", "-strip", "-colorspace", "sRGB",
			"-density", "72", "-quality", quality, "-resize", fmt.Sprintf("x%d", sizeWidth),
			fmt.Sprintf("%s[0]", src), dst}

	// PDF rastered thumbnail, GhostScript is required as external dependency
	case "pdf":
		// [0] defines first page of PDF document
		appArgs = []string{"-background", "white", "-alpha", "off", "-density", "200",
			"-resize", fmt.Sprintf("x%d", sizeWidth), fmt.Sprintf("%s[0]", src), dst}

	// text based, drawn thumbnails
	case "cfg", "conf", "css", "csv", "go", "html", "ini", "java", "js",
		"json", "log", "md", "php", "pl", "ps1", "py", "sql", "txt", "xml":

		textThumb := ""
		textLines := 30

		file, err := os.Open(src)
		if err != nil {
			returnErr = err
			return
		}

		scanner := bufio.NewScanner(file)
		for scanner.Scan() {
			if textLines < 1 {
				break
			}
			textLines--
			textThumb = fmt.Sprintf("%s%s\n", textThumb, scanner.Text())
		}
		file.Close()
		if scanner.Err() != nil {
			returnErr = scanner.Err()
			return
		}

		appArgs = []string{"-size", fmt.Sprintf("%dx%d", sizeWidth, sizeWidth),
			"-quality", quality, "xc:white", "-font", "Verdana",
			"-pointsize", "12", "-fill", "black", "-gravity", "NorthWest",
			"-annotate", "+10+40", fmt.Sprintf("%s", textThumb), dst}

	default:
		returnErr = fmt.Errorf("unsupported file extension '%s'", ext)
		return
	}

	// everything is ready, call external image processing
	cmd := exec.Command(convertPath, appArgs...)
	tools.CmdAddSysProgAttrs(cmd)
	if out, err := cmd.CombinedOutput(); err != nil {
		returnErr = errors.New(string(out))
		return
	}
}
