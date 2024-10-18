package config

import (
	"context"
	"encoding/json"
	"fmt"
	"r3/db"
	"r3/log"
	"strconv"

	"github.com/jackc/pgx/v5"
)

var (
	// configuration store (with values from database)
	storeString      = make(map[string]string)
	storeUint64      = make(map[string]uint64)
	storeUint64Slice = make(map[string][]uint64)

	NamesString = []string{"adminMails", "appName", "appNameShort", "backupDir",
		"companyColorHeader", "companyColorLogin", "companyLoginImage",
		"companyLogo", "companyLogoUrl", "companyName", "companyWelcome", "css",
		"dbVersionCut", "exportPrivateKey", "iconPwa1", "iconPwa2",
		"instanceId", "licenseFile", "publicHostName", "proxyUrl", "repoPass",
		"repoPublicKeys", "repoUrl", "repoUser", "systemMsgText", "tokenSecret",
		"updateCheckUrl", "updateCheckVersion"}

	NamesUint64 = []string{"backupDaily", "backupMonthly", "backupWeekly",
		"backupCountDaily", "backupCountMonthly", "backupCountWeekly",
		"bruteforceAttempts", "bruteforceProtection", "builderMode",
		"clusterNodeMissingAfter", "dbTimeoutCsv", "dbTimeoutDataRest",
		"dbTimeoutDataWs", "dbTimeoutIcs", "filesKeepDaysDeleted",
		"fileVersionsKeepCount", "fileVersionsKeepDays", "icsDaysPost",
		"icsDaysPre", "icsDownload", "imagerThumbWidth", "logApi", "logBackup",
		"logCache", "logCluster", "logCsv", "logImager", "logLdap", "logMail",
		"logModule", "logServer", "logScheduler", "logTransfer", "logWebsocket",
		"logsKeepDays", "mailTrafficKeepDays", "productionMode", "pwForceDigit",
		"pwForceLower", "pwForceSpecial", "pwForceUpper", "pwLengthMin",
		"repoChecked", "repoFeedback", "repoSkipVerify", "systemMsgDate0",
		"systemMsgDate1", "systemMsgMaintenance", "tokenExpiryHours",
		"tokenKeepEnable", "tokenReauthHours"}

	NamesUint64Slice = []string{"loginBackgrounds"}
)

// store setters
func SetString_tx(tx pgx.Tx, name string, value string) error {
	access_mx.Lock()
	defer access_mx.Unlock()

	if _, exists := storeString[name]; !exists {
		return fmt.Errorf("configuration string value '%s' does not exist", name)
	}
	if err := writeToDb_tx(tx, name, value); err != nil {
		return err
	}
	storeString[name] = value
	return nil
}
func SetUint64_tx(tx pgx.Tx, name string, value uint64) error {
	access_mx.Lock()
	defer access_mx.Unlock()

	if _, exists := storeUint64[name]; !exists {
		return fmt.Errorf("configuration uint64 value '%s' does not exist", name)
	}
	if err := writeToDb_tx(tx, name, fmt.Sprintf("%d", value)); err != nil {
		return err
	}
	storeUint64[name] = value
	return nil
}
func SetUint64Slice_tx(tx pgx.Tx, name string, value []uint64) error {
	access_mx.Lock()
	defer access_mx.Unlock()

	if _, exists := storeUint64Slice[name]; !exists {
		return fmt.Errorf("configuration uint64 slice value '%s' does not exist", name)
	}
	vJson, err := json.Marshal(value)
	if err != nil {
		return err
	}
	if err := writeToDb_tx(tx, name, string(vJson)); err != nil {
		return err
	}
	storeUint64Slice[name] = value
	return nil
}

// store getters
func GetString(name string) string {
	access_mx.RLock()
	defer access_mx.RUnlock()

	if _, exists := storeString[name]; !exists {
		log.Error("server", "configuration store get error",
			fmt.Errorf("string value '%s' does not exist", name))

		return ""
	}
	return storeString[name]
}
func GetUint64(name string) uint64 {
	access_mx.RLock()
	defer access_mx.RUnlock()

	if _, exists := storeUint64[name]; !exists {
		log.Error("server", "configuration store get error",
			fmt.Errorf("uint64 value '%s' does not exist", name))

		return 0
	}
	return storeUint64[name]
}
func GetUint64Slice(name string) []uint64 {
	access_mx.RLock()
	defer access_mx.RUnlock()

	if _, exists := storeUint64Slice[name]; !exists {
		log.Error("server", "configuration store get error",
			fmt.Errorf("uint64 slice value '%s' does not exist", name))

		return make([]uint64, 0)
	}
	return storeUint64Slice[name]
}

func LoadFromDb() error {
	access_mx.Lock()
	defer access_mx.Unlock()

	// reset value stores
	for _, name := range NamesString {
		storeString[name] = ""
	}
	for _, name := range NamesUint64 {
		storeUint64[name] = 0
	}
	for _, name := range NamesUint64Slice {
		storeUint64Slice[name] = make([]uint64, 0)
	}

	rows, err := db.Pool.Query(db.Ctx, "SELECT name, value FROM instance.config")
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var name string
		var value string

		if err := rows.Scan(&name, &value); err != nil {
			return err
		}

		if _, exists := storeString[name]; exists {
			storeString[name] = value
		} else if _, exists := storeUint64[name]; exists {
			storeUint64[name], err = strconv.ParseUint(value, 10, 64)
			if err != nil {
				return err
			}
		} else if _, exists := storeUint64Slice[name]; exists {
			var v []uint64
			if err := json.Unmarshal([]byte(value), &v); err != nil {
				return err
			}
			storeUint64Slice[name] = v
		}
	}
	return nil
}

func writeToDb_tx(tx pgx.Tx, name string, value string) error {
	_, err := tx.Exec(context.Background(), `
		UPDATE instance.config SET value = $1 WHERE name = $2
	`, value, name)

	return err
}
