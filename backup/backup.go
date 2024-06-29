package backup

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"r3/config"
	"r3/log"
	"r3/tools"
	"r3/tools/compress"
	"r3/types"
	"sync"
)

var (
	access_mx       sync.Mutex
	subPathConfig   = "config.json"      // path within backup dir for config file
	subPathDb       = "database"         // path within backup dir for database dump
	subPathCerts    = "certificates.zip" // path within backup dir for certificate files
	subPathFiles    = "files.zip"        // path within backup dir for attribute files
	subPathTransfer = "transfer.zip"     // path within backup dir for transfer files
)

func Run() error {
	access_mx.Lock()
	defer access_mx.Unlock()

	// check if anything is to be done
	if config.GetUint64("backupDaily") == 0 &&
		config.GetUint64("backupWeekly") == 0 &&
		config.GetUint64("backupMonthly") == 0 {

		log.Info("backup", "no backup jobs active, do nothing")
		return nil
	}

	// initialize state
	if config.GetString("backupDir") == "" {
		err := errors.New("backup directory not defined")
		log.Error("backup", "could not start", err)
		return err
	}

	// read table of contents backup file
	tocFile, err := TocFileReadCreate()
	if err != nil {
		return err
	}

	// clean up old backups then create new backups
	now := tools.GetTimeUnix()
	jobRan := false // limit to one job per run

	var runOne = func(jobName string, keepVersions uint64, interval int64) error {
		log.Info("backup", fmt.Sprintf("is considering job '%s' for execution", jobName))

		var timestampLatest int64
		for _, backup := range tocFile.Backups {
			if backup.JobName == jobName && backup.Timestamp > timestampLatest {
				timestampLatest = backup.Timestamp
			}
		}

		if timestampLatest > (now - interval) {
			log.Info("backup", fmt.Sprintf("does not need to execute '%s', latest backup is still valid", jobName))
			return nil
		}

		if err := jobCleanup(&tocFile, jobName, keepVersions); err != nil {
			log.Error("backup", fmt.Sprintf("could not delete old versions of job '%s'", jobName), err)
			return err
		}
		if err := jobBackup(&tocFile, jobName); err != nil {
			log.Error("backup", fmt.Sprintf("could not execute job '%s'", jobName), err)
			return err
		}
		jobRan = true
		return nil
	}

	if !jobRan && config.GetUint64("backupMonthly") == 1 {
		if err := runOne("monthly", config.GetUint64("backupCountMonthly"), 2592000); err != nil {
			return err
		}
	}
	if !jobRan && config.GetUint64("backupWeekly") == 1 {
		if err := runOne("weekly", config.GetUint64("backupCountWeekly"), 604800); err != nil {
			return err
		}
	}
	if !jobRan && config.GetUint64("backupDaily") == 1 {
		if err := runOne("daily", config.GetUint64("backupCountDaily"), 86400); err != nil {
			return err
		}
	}
	return nil
}

func jobCleanup(tocFile *types.BackupTocFile, jobName string, countKeep uint64) error {

	log.Info("backup", fmt.Sprintf("starting cleanup for job '%s', keep %d versions",
		jobName, countKeep))

	defer log.Info("backup", fmt.Sprintf("finished cleanup for job '%s'", jobName))

	// get current count
	var countCurrent int
	for _, backup := range tocFile.Backups {
		if backup.JobName == jobName {
			countCurrent++
		}
	}

	log.Info("backup", fmt.Sprintf("found %d versions for job '%s'", countCurrent, jobName))

	// delete not-kept versions
	// if 3 are to be kept, delete all but 2 (to make room for next backup)
	for countDelete := countCurrent - int(countKeep) + 1; countDelete > 0; countDelete-- {

		var timestampToDelete int64
		var timestampToDeleteIndex int

		for i, backup := range tocFile.Backups {
			if backup.JobName == jobName && (timestampToDelete == 0 || backup.Timestamp < timestampToDelete) {
				timestampToDelete = backup.Timestamp
				timestampToDeleteIndex = i
			}
		}
		pathToDelete := getBackupJobDir(timestampToDelete, jobName)

		log.Info("backup", fmt.Sprintf("is attempting to delete '%s'", pathToDelete))

		exists, err := tools.Exists(pathToDelete)
		if err != nil {
			return err
		}
		if exists {
			// physically delete backup
			if err := os.RemoveAll(pathToDelete); err != nil {
				return err
			}
		}

		// update TOC file in any case
		tocFile.Backups[timestampToDeleteIndex] = tocFile.Backups[len(tocFile.Backups)-1]
		tocFile.Backups = tocFile.Backups[:len(tocFile.Backups)-1]

		if err := tocFileWrite(*tocFile); err != nil {
			return err
		}
		log.Info("backup", fmt.Sprintf("has successfully deleted '%s'", pathToDelete))
	}
	return nil
}
func jobBackup(tocFile *types.BackupTocFile, jobName string) error {
	log.Info("backup", fmt.Sprintf("started for job '%s'", jobName))

	newTimestamp := tools.GetTimeUnix()
	jobDir := getBackupJobDir(newTimestamp, jobName)

	// database backup
	dbPath := filepath.Join(jobDir, subPathDb)
	if err := os.MkdirAll(dbPath, 0755); err != nil {
		return err
	}
	if err := dumpDb(dbPath); err != nil {
		return err
	}

	// certificates backup
	target := filepath.Join(jobDir, subPathCerts)
	if err := compress.Path(target, config.File.Paths.Certificates); err != nil {
		return err
	}

	// config backup
	target = filepath.Join(jobDir, subPathConfig)
	if err := tools.FileCopy(config.GetConfigFilepath(), target, false); err != nil {
		return err
	}

	// files backup
	target = filepath.Join(jobDir, subPathFiles)
	if err := compress.Path(target, config.File.Paths.Files); err != nil {
		return err
	}

	// transfer backup
	target = filepath.Join(jobDir, subPathTransfer)
	if err := compress.Path(target, config.File.Paths.Transfer); err != nil {
		return err
	}

	// update TOC file
	tocFile.Backups = append(tocFile.Backups, types.BackupDef{
		AppBuild:  config.GetAppVersion().Build,
		JobName:   jobName,
		Timestamp: newTimestamp,
	})
	if err := tocFileWrite(*tocFile); err != nil {
		return err
	}
	log.Info("backup", fmt.Sprintf("successfully completed job '%s'", jobName))
	return nil
}

// helpers
func dumpDb(path string) error {
	args := []string{
		"-h", config.File.Db.Host,
		"-p", fmt.Sprintf("%d", config.File.Db.Port),
		"-d", config.File.Db.Name,
		"-U", config.File.Db.User,
		"-j", "4", // number of parallel jobs
		"-Fd", // custom format, to file directory
		"-f", path,
	}
	cmd := exec.Command(getPgDumpPath(), args...)
	tools.CmdAddSysProgAttrs(cmd)
	cmd.Env = append(cmd.Env, fmt.Sprintf("LC_MESSAGES=%s", "en_US"))
	cmd.Env = append(cmd.Env, fmt.Sprintf("PGPASSWORD=%s", config.File.Db.Pass))
	return cmd.Run()
}
func TocFileReadCreate() (types.BackupTocFile, error) {
	var tocFile = types.BackupTocFile{}
	var path = getTocFilePath()

	exists, err := tools.Exists(path)
	if err != nil {
		log.Error("backup", "could not check existence of TOC file", err)
		return tocFile, err
	}
	if !exists {
		tocFile.Backups = make([]types.BackupDef, 0)
		return tocFile, tocFileWrite(tocFile)
	}

	jsonFile, err := os.ReadFile(path)
	if err != nil {
		return tocFile, err
	}
	return tocFile, json.Unmarshal(tools.RemoveUtf8Bom(jsonFile), &tocFile)
}
func tocFileWrite(tocFile types.BackupTocFile) error {
	jsonFile, err := json.MarshalIndent(tocFile, "", "\t")
	if err != nil {
		return err
	}
	return os.WriteFile(getTocFilePath(), jsonFile, 0644)
}
func getTocFilePath() string {
	return filepath.Join(config.GetString("backupDir"), "backups_toc.json")
}
func getBackupJobDir(timestamp int64, jobName string) string {
	return filepath.Join(config.GetString("backupDir"), fmt.Sprintf("%d_%s", timestamp, jobName))
}
