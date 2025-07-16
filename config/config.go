package config

import (
	"context"
	"encoding/json"
	"math/rand"
	"os"
	"r3/log"
	"r3/tools"
	"r3/types"
	"regexp"
	"strconv"
	"sync"

	"github.com/gbrlsnchs/jwt/v3"
	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

var (
	access_mx = &sync.RWMutex{}

	// application names
	appName      string
	appNameShort string

	// application versions
	appVersion       types.Version // r3
	appVersionClient types.Version // r3 fat client

	// configuration file location
	filePath      string // location of configuration file in JSON format
	filePathTempl string = "config_template.json"

	// configuration values from file, must not be changed during runtime
	File types.FileType

	// operation data
	hostname    string
	license     = types.License{}
	tokenSecret *jwt.HMACSHA

	// regex
	rxVersionBuild = regexp.MustCompile(`^\d+\.\d+\.\d+\.`)
	rxVersionCut   = regexp.MustCompile(`\.\d+\.\d+$`)
)

func GetAppVersion() types.Version {
	access_mx.RLock()
	defer access_mx.RUnlock()
	return appVersion
}

func GetAppVersionClient() types.Version {
	access_mx.RLock()
	defer access_mx.RUnlock()
	return appVersionClient
}

func GetAppName() (string, string) {
	access_mx.RLock()
	defer access_mx.RUnlock()
	return appName, appNameShort
}
func GetConfigFilepath() string {
	access_mx.RLock()
	defer access_mx.RUnlock()
	return filePath
}
func GetDbVersionCut() string {
	return GetString("dbVersionCut")
}
func GetHostname() string {
	access_mx.RLock()
	defer access_mx.RUnlock()
	return hostname
}
func GetLicense() types.License {
	access_mx.RLock()
	defer access_mx.RUnlock()
	return license
}
func GetLicenseActive() bool {
	access_mx.RLock()
	defer access_mx.RUnlock()
	return license.ValidUntil > tools.GetTimeUnix()
}
func GetLicenseLoginCount(limitedLogins bool) int64 {
	access_mx.RLock()
	defer access_mx.RUnlock()

	if limitedLogins {
		return license.LoginCount * 3
	}
	return license.LoginCount
}
func GetLicenseUsed() bool {
	access_mx.RLock()
	defer access_mx.RUnlock()
	return license.ValidUntil != 0
}
func GetLicenseValidUntil() int64 {
	access_mx.RLock()
	defer access_mx.RUnlock()
	return license.ValidUntil
}
func GetTokenSecret() *jwt.HMACSHA {
	access_mx.RLock()
	defer access_mx.RUnlock()
	return tokenSecret
}

// setters
func SetAppVersion(versionFull string, target string) error {
	access_mx.Lock()
	defer access_mx.Unlock()

	build, err := strconv.Atoi(rxVersionBuild.ReplaceAllString(versionFull, ""))
	if err != nil {
		return err
	}

	if target == "service" {
		appVersion.Build = build
		appVersion.Cut = rxVersionCut.ReplaceAllString(versionFull, "")
		appVersion.Full = versionFull
	} else if target == "fatClient" {
		appVersionClient.Build = build
		appVersionClient.Cut = rxVersionCut.ReplaceAllString(versionFull, "")
		appVersionClient.Full = versionFull
	}
	return nil
}
func SetAppName(name string, nameShort string) {
	access_mx.Lock()
	defer access_mx.Unlock()
	appName = name
	appNameShort = nameShort
}
func SetConfigFilePath(path string) {
	access_mx.Lock()
	defer access_mx.Unlock()
	filePath = path
}
func SetHostnameFromOs() error {
	access_mx.Lock()
	defer access_mx.Unlock()
	var err error
	hostname, err = os.Hostname()
	return err
}
func SetLicense(l types.License) {
	access_mx.Lock()
	defer access_mx.Unlock()
	license = l
}
func SetLogLevels() {
	log.SetLogLevel(log.ContextApi, int(GetUint64("logApi")))
	log.SetLogLevel(log.ContextBackup, int(GetUint64("logBackup")))
	log.SetLogLevel(log.ContextCache, int(GetUint64("logCache")))
	log.SetLogLevel(log.ContextCluster, int(GetUint64("logCluster")))
	log.SetLogLevel(log.ContextCsv, int(GetUint64("logCsv")))
	log.SetLogLevel(log.ContextFile, int(GetUint64("logFile")))
	log.SetLogLevel(log.ContextImager, int(GetUint64("logImager")))
	log.SetLogLevel(log.ContextLdap, int(GetUint64("logLdap")))
	log.SetLogLevel(log.ContextMail, int(GetUint64("logMail")))
	log.SetLogLevel(log.ContextModule, int(GetUint64("logModule")))
	log.SetLogLevel(log.ContextOauth, int(GetUint64("logOauth")))
	log.SetLogLevel(log.ContextScheduler, int(GetUint64("logScheduler")))
	log.SetLogLevel(log.ContextServer, int(GetUint64("logServer")))
	log.SetLogLevel(log.ContextTransfer, int(GetUint64("logTransfer")))
	log.SetLogLevel(log.ContextWebsocket, int(GetUint64("logWebsocket")))
}
func SetInstanceIdIfEmpty_tx(ctx context.Context, tx pgx.Tx) error {
	if GetString("instanceId") != "" {
		return nil
	}

	id, err := uuid.NewV4()
	if err != nil {
		return err
	}
	return SetString_tx(ctx, tx, "instanceId", id.String())
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
	return json.Unmarshal(configJson, &File)
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
	return os.WriteFile(filePath, json, 0644)
}

// token
func ProcessTokenSecret_tx(ctx context.Context, tx pgx.Tx) error {
	secret := GetString("tokenSecret")
	if secret == "" {
		min, max := 32, 48
		secret = tools.RandStringRunes(rand.Intn(max-min+1) + min)

		if err := SetString_tx(ctx, tx, "tokenSecret", secret); err != nil {
			return err
		}
	}

	access_mx.Lock()
	defer access_mx.Unlock()

	tokenSecret = jwt.NewHS256([]byte(secret))
	return nil
}
