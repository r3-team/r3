package config

import (
	"encoding/json"
	"math/rand"
	"os"
	"r3/db"
	"r3/log"
	"r3/tools"
	"r3/types"
	"regexp"
	"sync"

	"github.com/gbrlsnchs/jwt/v3"
	"github.com/gofrs/uuid"
)

var (
	access_mx = &sync.Mutex{}

	// application names
	appName      string
	appNameShort string

	// application version details (version syntax: major.minor.patch.build)
	// only major/minor version updates may effect the database
	appVersion      string // full version of this application (1.2.0.1023)
	appVersionCut   string // major+minor version of this application (1.2)
	appVersionBuild string // build counter of this application (1023)

	// configuration file location
	filePath      string = "config.json"
	filePathTempl string = "config_template.json"

	// configuration values from file, must not be changed during runtime
	File types.FileType

	// operation data
	TokenSecret *jwt.HMACSHA
	License     types.License = types.License{}

	// system language codes
	languageCodeDefault = "en_us"
	languageCodes       = []string{"de_de", "en_us"}
)

// returns
// *full application version (1.2.0.1023)
// *major+minor application version (1.2)
// *build number (1023)
// *database version (1.2), which is kept equal to major+minor app version
func GetAppVersions() (string, string, string, string) {
	dbVersionCut := GetString("dbVersionCut")

	access_mx.Lock()
	defer access_mx.Unlock()
	return appVersion, appVersionCut, appVersionBuild, dbVersionCut
}
func GetAppName() (string, string) {
	return appName, appNameShort
}
func GetConfigFilepath() string {
	return filePath
}
func GetLicenseActive() bool {
	return License.ValidUntil > tools.GetTimeUnix()
}
func GetLanguageCodeValid(requestedCode string) string {
	if tools.StringInSlice(requestedCode, languageCodes) {
		return requestedCode
	}
	return languageCodeDefault
}

// setters
func SetAppVersion(version string) {
	access_mx.Lock()
	defer access_mx.Unlock()

	appVersion = version
	appVersionCut = regexp.MustCompile(`\.\d+\.\d+$`).ReplaceAllString(version, "")
	appVersionBuild = regexp.MustCompile(`^\d+\.\d+\.\d+\.`).ReplaceAllString(version, "")
}
func SetAppName(name string, nameShort string) {
	appName = name
	appNameShort = nameShort
}
func SetConfigFilePath(path string) {
	filePath = path
}
func SetLogLevels() {
	log.SetLogLevel("application", int(GetUint64("logApplication")))
	log.SetLogLevel("backup", int(GetUint64("logBackup")))
	log.SetLogLevel("cache", int(GetUint64("logCache")))
	log.SetLogLevel("csv", int(GetUint64("logCsv")))
	log.SetLogLevel("ldap", int(GetUint64("logLdap")))
	log.SetLogLevel("mail", int(GetUint64("logMail")))
	log.SetLogLevel("scheduler", int(GetUint64("logScheduler")))
	log.SetLogLevel("server", int(GetUint64("logServer")))
	log.SetLogLevel("transfer", int(GetUint64("logTransfer")))
}

func SetInstanceIdIfEmpty() error {
	if GetString("instanceId") != "" {
		return nil
	}

	id, err := uuid.NewV4()
	if err != nil {
		return err
	}

	tx, err := db.Pool.Begin(db.Ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(db.Ctx)

	if err := SetString_tx(tx, "instanceId", id.String()); err != nil {
		return err
	}
	return tx.Commit(db.Ctx)
}

// config file
func LoadFile() error {
	access_mx.Lock()
	defer access_mx.Unlock()

	// check for config file existence
	exists, err := tools.Exists(filePath)
	if err != nil {
		return err
	}
	if !exists {
		// file does not exist, attempt to copy from template
		if err := tools.FileCopy(filePathTempl, filePath, false); err != nil {
			return err
		}
	}

	// read configuration from JSON file
	configJson, err := os.ReadFile(filePath)
	if err != nil {
		return err
	}
	configJson = tools.RemoveUtf8Bom(configJson)

	// unmarshal configuration JSON file
	if err := json.Unmarshal(configJson, &File); err != nil {
		return err
	}
	return nil
}
func WriteFile() error {
	access_mx.Lock()
	defer access_mx.Unlock()

	// marshal configuration JSON
	json, err := json.MarshalIndent(File, "", "\t")
	if err != nil {
		return err
	}

	// write configuration to JSON file
	if err := os.WriteFile(filePath, json, 0644); err != nil {
		return err
	}
	return nil
}

// token
func GetTokenSecret() *jwt.HMACSHA {
	access_mx.Lock()
	defer access_mx.Unlock()

	return TokenSecret
}
func ProcessTokenSecret() error {
	secret := GetString("tokenSecret")
	if secret == "" {
		tx, err := db.Pool.Begin(db.Ctx)
		if err != nil {
			return err
		}

		min, max := 32, 48
		secret = tools.RandStringRunes(rand.Intn(max-min+1) + min)

		if err := SetString_tx(tx, "tokenSecret", secret); err != nil {
			tx.Rollback(db.Ctx)
			return err
		}
		tx.Commit(db.Ctx)
	}

	access_mx.Lock()
	defer access_mx.Unlock()

	TokenSecret = jwt.NewHS256([]byte(secret))
	return nil
}
