package backup

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"r3/compress"
	"r3/config"
	"r3/log"
	"r3/tools"
	"strconv"
	"sync"
)

type backupDef struct {
	AppBuild  int    `json:"appBuild"`
	JobName   string `json:"jobName"`
	Timestamp int64  `json:"timestamp"`
}
type tocFileType struct {
	Backups []backupDef `json:"backups"`
}

var (
	access_mx sync.Mutex

	backupDir   string      // working directory for backups
	tocFilePath string      // path to table of content file for backups
	tocFile     tocFileType // in-memory table of content file

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
	backupDir = config.GetString("backupDir")
	tocFilePath = filepath.Join(backupDir, "backups_toc.json")

	if backupDir == "" {
		err := errors.New("backup directory not defined")
		log.Error("backup", "could start", err)
		return err
	}

	// check for table of contents backup file
	exists, err := tools.Exists(tocFilePath)
	if err != nil {
		log.Error("backup", "could not check existence of TOC file", err)
		return err
	}

	if !exists {
		// create new TOC file
		if err := tocFileWrite(); err != nil {
			log.Error("backup", "could not write TOC file", err)
			return err
		}
	} else {
		// read existing
		if err := tocFileRead(); err != nil {
			log.Error("backup", "could not read TOC file", err)
			return err
		}
	}

	// clean up old backups then create new backups
	now := tools.GetTimeUnix()
	jobRan := false // limit to one job per run

	var runOne = func(jobName string, keepVersions uint64, interval int64) error {
		log.Info("backup", fmt.Sprintf("is considering job '%s' for execution", jobName))

		if getLatestTimestamp(jobName) > (now - interval) {
			log.Info("backup", fmt.Sprintf("does not need to execute '%s', latest backup is still valid", jobName))
			return nil
		}

		if err := cleanup(jobName, keepVersions); err != nil {
			log.Error("backup", fmt.Sprintf("could not delete old versions of job '%s'", jobName), err)
			return err
		}
		if err := runJob(jobName); err != nil {
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

func cleanup(jobName string, countKeep uint64) error {

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

		timestampToDelete, timestampIndex := getOldestTimestamp(jobName)

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
		tocFile.Backups[timestampIndex] = tocFile.Backups[len(tocFile.Backups)-1]
		tocFile.Backups = tocFile.Backups[:len(tocFile.Backups)-1]

		if err := tocFileWrite(); err != nil {
			return err
		}
		log.Info("backup", fmt.Sprintf("has successfully deleted '%s'", pathToDelete))
	}
	return nil
}

func runJob(jobName string) error {

	log.Info("backup", fmt.Sprintf("started for job '%s'", jobName))

	newTimestamp := tools.GetTimeUnix()
	_, _, appBuild, _ := config.GetAppVersions()
	appBuildInt, err := strconv.Atoi(appBuild)
	if err != nil {
		return err
	}

	// create database backup
	dbPath := filepath.Join(getBackupJobDir(newTimestamp, jobName), subPathDb)
	if err := os.MkdirAll(dbPath, 0600); err != nil {
		return err
	}
	if err := dumpDb(dbPath); err != nil {
		return err
	}

	// create certificates backup
	target := filepath.Join(getBackupJobDir(newTimestamp, jobName), subPathCerts)
	if err := compress.Path(target, config.File.Paths.Certificates); err != nil {
		return err
	}

	// create config backup
	target = filepath.Join(getBackupJobDir(newTimestamp, jobName), subPathConfig)
	if err := tools.FileCopy(config.GetConfigFilepath(), target, false); err != nil {
		return err
	}

	// create files backup
	target = filepath.Join(getBackupJobDir(newTimestamp, jobName), subPathFiles)
	if err := compress.Path(target, config.File.Paths.Files); err != nil {
		return err
	}

	// create transfer backup
	target = filepath.Join(getBackupJobDir(newTimestamp, jobName), subPathTransfer)
	if err := compress.Path(target, config.File.Paths.Transfer); err != nil {
		return err
	}

	// update TOC file
	tocFile.Backups = append(tocFile.Backups, backupDef{
		AppBuild:  appBuildInt,
		JobName:   jobName,
		Timestamp: newTimestamp,
	})
	if err := tocFileWrite(); err != nil {
		return err
	}
	log.Info("backup", fmt.Sprintf("successfully completed job '%s'", jobName))
	return nil
}

func dumpDb(path string) error {
	args := []string{
		"-h", config.File.Db.Host,
		"-p", fmt.Sprintf("%d", config.File.Db.Port),
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

func tocFileRead() error {
	jsonFile, err := os.ReadFile(tocFilePath)
	if err != nil {
		return err
	}
	jsonFile = tools.RemoveUtf8Bom(jsonFile)

	return json.Unmarshal(jsonFile, &tocFile)
}
func tocFileWrite() error {
	jsonFile, err := json.MarshalIndent(tocFile, "", "\t")
	if err != nil {
		return err
	}
	return os.WriteFile(tocFilePath, jsonFile, 0644)
}

func getLatestTimestamp(jobName string) int64 {

	var timestamp int64

	for _, backup := range tocFile.Backups {
		if backup.JobName == jobName && backup.Timestamp > timestamp {
			timestamp = backup.Timestamp
		}
	}
	return timestamp
}

func getOldestTimestamp(jobName string) (int64, int) {

	var timestamp int64
	var timestampIndex int

	for i, backup := range tocFile.Backups {
		if backup.JobName == jobName && (timestamp == 0 || backup.Timestamp < timestamp) {
			timestamp = backup.Timestamp
			timestampIndex = i
		}
	}
	return timestamp, timestampIndex
}

func getBackupJobDir(timestamp int64, jobName string) string {
	return filepath.Join(backupDir, fmt.Sprintf("%d_%s", timestamp, jobName))
}
