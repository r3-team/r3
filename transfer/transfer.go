// Module schema transfer between running instances.
// Supports exporting schemas as well as importing/upgrading existing modules.

package transfer

import (
	"archive/zip"
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"r3/cache"
	"r3/config"
	"r3/config/module_meta"
	"r3/tools"
	"r3/types"
	"sync"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

var (
	exportKey string       // in memory storage for export key
	Import_mx sync.RWMutex // transfer import mutex
)

func StoreExportKey(key string) {
	exportKey = key
}

func AddVersion_tx(ctx context.Context, tx pgx.Tx, moduleId uuid.UUID) error {
	cache.Schema_mx.RLock()
	defer cache.Schema_mx.RUnlock()

	var exists bool
	var file types.TransferFile

	file.Content.Module, exists = cache.ModuleIdMap[moduleId]
	if !exists {
		return errors.New("module does not exist")
	}

	// update version info
	file.Content.Module.ReleaseBuildApp = config.GetAppVersion().Build
	file.Content.Module.ReleaseBuild = file.Content.Module.ReleaseBuild + 1
	file.Content.Module.ReleaseDate = tools.GetTimeUnix()

	// recreate hash with updated module meta
	hashedStr, err := getModuleHashFromFile(file)
	if err != nil {
		return err
	}

	if err := module_meta.SetHash_tx(ctx, tx, moduleId, hashedStr); err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `
		UPDATE app.module
		SET release_build_app = $1, release_build = $2,
			release_date = $3
		WHERE id = $4
	`, file.Content.Module.ReleaseBuildApp,
		file.Content.Module.ReleaseBuild,
		file.Content.Module.ReleaseDate, moduleId)

	return err
}

// start with 1 module and check whether it or its dependent upon modules had changed
// returns map of module IDs, changed yes/no
func GetModuleChangedWithDependencies(moduleId uuid.UUID) (map[uuid.UUID]bool, error) {
	cache.Schema_mx.RLock()
	defer cache.Schema_mx.RUnlock()

	mapChecked := make(map[uuid.UUID]bool)

	var checkRecursive func(id uuid.UUID, moduleIdMapChecked map[uuid.UUID]bool) error
	checkRecursive = func(id uuid.UUID, moduleIdMapChecked map[uuid.UUID]bool) error {

		// already checked?
		if _, exists := moduleIdMapChecked[id]; exists {
			return nil
		}

		module, exists := cache.ModuleIdMap[id]
		if !exists {
			return errors.New("unknown module")
		}

		var err error
		var file types.TransferFile
		file.Content.Module = module

		moduleIdMapChecked[id], err = hasModuleChanged(file)
		if err != nil {
			return err
		}

		// check dependencies
		for _, moduleIdDependsOn := range module.DependsOn {

			if err := checkRecursive(moduleIdDependsOn, moduleIdMapChecked); err != nil {
				return err
			}
		}
		return nil
	}

	if err := checkRecursive(moduleId, mapChecked); err != nil {
		return nil, err
	}
	return mapChecked, nil
}

// verifies that the importing module matches the running application build
func verifyCompatibilityWithApp(releaseBuildApp int) error {

	if config.GetAppVersion().Build < releaseBuildApp {
		return fmt.Errorf("module was released for application version %d (current version %d)",
			releaseBuildApp, config.GetAppVersion().Build)
	}
	return nil
}

// verifies that the raw content of JSON file matches given signature
// verify raw content, as target JSON might have different structure (new elements due to schema change)
// returns error if verification fails, also module hash
func verifyContent(jsonFileData *[]byte) ([32]byte, error) {

	var hashed [32]byte
	var verify types.TransferFileVerify
	if err := json.Unmarshal(*jsonFileData, &verify); err != nil {
		return hashed, err
	}

	hashed = sha256.Sum256(verify.Content)

	signature, err := base64.URLEncoding.DecodeString(verify.Signature)
	if err != nil {
		return hashed, err
	}

	// check signature against all trusted public keys
	var publicKeys map[string]string
	if err := json.Unmarshal([]byte(config.GetString("repoPublicKeys")), &publicKeys); err != nil {
		return hashed, err
	}

	verified := false

	for _, publicKey := range publicKeys {

		publicKeyPem, _ := pem.Decode([]byte(publicKey))
		if publicKeyPem == nil {
			return hashed, errors.New("could not decode PEM block from public key")
		}

		key, err := x509.ParsePKCS1PublicKey(publicKeyPem.Bytes)
		if err != nil {
			return hashed, err
		}

		// verify hash with public key
		if err := rsa.VerifyPKCS1v15(key, crypto.SHA256, hashed[:], signature); err != nil {
			// verification failed, try next key
			continue
		}

		// verification succeeded
		verified = true
	}

	if !verified {
		return hashed, errors.New("signature could not be verified by any trusted public key")
	}
	return hashed, nil
}

func writeFilesFromZip(zipFile string, destDir string, destFilePrefix string) ([]string, error) {

	filePaths := make([]string, 0)

	reader, err := zip.OpenReader(zipFile)
	if err != nil {
		return filePaths, err
	}
	defer reader.Close()

	for _, file := range reader.File {

		fileIn, err := file.Open()
		if err != nil {
			return filePaths, err
		}

		filePath := filepath.Join(destDir, fmt.Sprintf("%s%s", destFilePrefix, file.FileHeader.Name))

		fileOut, err := os.OpenFile(filePath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, file.Mode())

		if err != nil {
			fileIn.Close()
			return filePaths, err
		}

		if _, err = io.Copy(fileOut, fileIn); err != nil {
			fileIn.Close()
			fileOut.Close()
			return filePaths, err
		}
		fileIn.Close()
		fileOut.Close()
		filePaths = append(filePaths, filePath)
	}
	return filePaths, nil
}

func writeFilesToZip(zipPath string, filePaths []string) error {

	zipFile, err := os.Create(zipPath)
	if err != nil {
		return err
	}
	defer zipFile.Close()

	zipWriter := zip.NewWriter(zipFile)
	defer zipWriter.Close()

	for _, filePath := range filePaths {

		info, err := os.Stat(filePath)
		if err != nil {
			return err
		}

		header, err := zip.FileInfoHeader(info)
		if err != nil {
			return err
		}
		header.Method = zip.Deflate

		writer, err := zipWriter.CreateHeader(header)
		if err != nil {
			return err
		}

		file, err := os.Open(filePath)
		if err != nil {
			return err
		}

		if _, err := io.Copy(writer, file); err != nil {
			file.Close()
			return err
		}
		file.Close()
	}
	return nil
}

// returns whether the module inside the given transfer file has changed
//
//	checked against the stored module hash from the last module version change
func hasModuleChanged(file types.TransferFile) (bool, error) {

	hashedStr, err := getModuleHashFromFile(file)
	if err != nil {
		return false, err
	}
	hashedStrEx, err := module_meta.GetHash(file.Content.Module.Id)
	if err != nil {
		return false, err
	}
	return hashedStr != hashedStrEx, nil
}

// get the export name of a module transfer file
func getModuleFilename(moduleId uuid.UUID) string {
	return fmt.Sprintf("%s.json", moduleId.String())
}

// returns the hash from the content part of a module transfer file
func getModuleHashFromFile(file types.TransferFile) (string, error) {
	jsonContent, err := json.Marshal(file.Content)
	if err != nil {
		return "", err
	}
	hashed := sha256.Sum256(jsonContent)
	return base64.URLEncoding.EncodeToString(hashed[:]), nil
}
