package transfer

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"r3/cache"
	"r3/config"
	"r3/db"
	"r3/log"
	"r3/module_option"
	"r3/tools"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

// export a module stored as compressed file
// if the exported module had any changes, the module meta (version,
//  dependent app version, release date) will be updated
func ExportToFile(moduleId uuid.UUID, zipFilePath string) error {
	cache.Schema_mx.RLock()
	defer cache.Schema_mx.RUnlock()

	log.Info("transfer", fmt.Sprintf("start export for module %s", moduleId))

	if exportKey == "" {
		return errors.New("no export key for module signing set")
	}

	tx, err := db.Pool.Begin(db.Ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(db.Ctx)

	// export all modules as JSON files
	var moduleJsonPaths []string
	var moduleIdsExported []uuid.UUID
	if err := export_tx(tx, moduleId, true, &moduleJsonPaths, &moduleIdsExported); err != nil {
		return err
	}

	// package modules into compressed file
	if err := writeFilesToZip(zipFilePath, moduleJsonPaths); err != nil {
		return err
	}
	return tx.Commit(db.Ctx)
}

func export_tx(tx pgx.Tx, moduleId uuid.UUID, original bool, filePaths *[]string,
	moduleIdsExported *[]uuid.UUID) error {

	// ignore if already exported (dependent on modules can have similar dependencies)
	if tools.UuidInSlice(moduleId, *moduleIdsExported) {
		return nil
	}
	*moduleIdsExported = append(*moduleIdsExported, moduleId)

	var exists bool
	var file types.TransferFile

	file.Content.Module, exists = cache.ModuleIdMap[moduleId]
	if !exists {
		return errors.New("module does not exist")
	}

	// export all modules that this module is dependent on
	for _, modId := range file.Content.Module.DependsOn {
		if err := export_tx(tx, modId, false, filePaths, moduleIdsExported); err != nil {
			return err
		}
	}

	// check for ownership
	var isOwner bool
	if err := tx.QueryRow(db.Ctx, `
		SELECT owner
		FROM instance.module_option
		WHERE module_id = $1
	`, moduleId).Scan(&isOwner); err != nil {
		return err
	}

	log.Info("transfer", fmt.Sprintf("exporting module '%s' (owner: %v)",
		file.Content.Module.Name, isOwner))

	// user is not owner, export original version
	if !isOwner {
		*filePaths = append(*filePaths, filepath.Join(
			config.File.Paths.Transfer, getModuleFilename(moduleId)))

		return nil
	}

	// user is owner, export module fresh
	jsonContent, err := json.Marshal(file.Content)
	if err != nil {
		return err
	}
	hashed := sha256.Sum256(jsonContent)
	hashedStr := base64.URLEncoding.EncodeToString(hashed[:])
	hashedStrEx, err := module_option.GetHashById(moduleId)
	if err != nil {
		return err
	}

	if hashedStr != hashedStrEx {
		return fmt.Errorf("module '%s' has changes outside the current version, abort",
			file.Content.Module.Name)
	}

	// generate signature from content hash
	privKeyPem, _ := pem.Decode([]byte(exportKey))
	if privKeyPem == nil {
		return errors.New("could not decode PEM block from private key")
	}

	privKey, err := x509.ParsePKCS1PrivateKey(privKeyPem.Bytes)
	if err != nil {
		return err
	}

	signature, err := rsa.SignPKCS1v15(rand.Reader,
		privKey, crypto.SHA256, hashed[:])

	if err != nil {
		return err
	}

	file.Signature = base64.URLEncoding.EncodeToString(signature)

	// store file name
	filePath := filepath.Join(config.File.Paths.Transfer, getModuleFilename(moduleId))
	*filePaths = append(*filePaths, filePath)

	// write finished JSON to file
	jsonFile, err := json.Marshal(file)
	if err != nil {
		return err
	}
	return os.WriteFile(filePath, jsonFile, 0644)
}
