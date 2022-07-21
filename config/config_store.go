package config

import (
	"context"
	"fmt"
	"r3/db"
	"r3/log"
	"strconv"

	"github.com/jackc/pgx/v4"
)

var (
	// configuration store (with values from database)
	storeUint64 map[string]uint64 = make(map[string]uint64)
	storeString map[string]string = make(map[string]string)

	NamesString = []string{"appName", "appNameShort", "backupDir", "companyColorHeader",
		"companyColorLogin", "companyLogo", "companyLogoUrl", "companyName",
		"companyWelcome", "dbVersionCut", "defaultLanguageCode", "exportPrivateKey",
		"instanceId", "licenseFile", "publicHostName", "repoPass", "repoPublicKeys",
		"repoUrl", "repoUser", "tokenSecret", "updateCheckUrl", "updateCheckVersion"}

	NamesUint64 = []string{"backupDaily", "backupMonthly", "backupWeekly",
		"backupCountDaily", "backupCountMonthly", "backupCountWeekly",
		"bruteforceAttempts", "bruteforceProtection", "builderMode",
		"clusterNodeMissingAfter", "dbTimeoutCsv", "dbTimeoutDataRest",
		"dbTimeoutDataWs", "dbTimeoutIcs", "icsDaysPost", "icsDaysPre",
		"icsDownload", "logApplication", "logBackup", "logCache",
		"logCluster", "logCsv", "logLdap", "logMail", "logServer",
		"logScheduler", "logTransfer", "logsKeepDays", "productionMode",
		"pwForceDigit", "pwForceLower", "pwForceSpecial", "pwForceUpper",
		"pwLengthMin", "schemaTimestamp", "repoChecked", "repoFeedback",
		"repoSkipVerify", "tokenExpiryHours"}
)

// store setters
func SetString_tx(tx pgx.Tx, name string, value string) error {
	access_mx.Lock()
	defer access_mx.Unlock()

	if _, exists := storeString[name]; !exists {
		return fmt.Errorf("configuration string value '%s' does not exist", name)
	}

	if _, err := tx.Exec(context.Background(), `
		UPDATE instance.config SET value = $1 WHERE name = $2
	`, value, name); err != nil {
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

	if _, err := tx.Exec(context.Background(), `
		UPDATE instance.config SET value = $1 WHERE name = $2
	`, fmt.Sprintf("%d", value), name); err != nil {
		return err
	}
	storeUint64[name] = value
	return nil
}

// store getters
func GetString(name string) string {
	access_mx.Lock()
	defer access_mx.Unlock()

	if _, exists := storeString[name]; !exists {
		log.Error("server", "configuration store get error",
			fmt.Errorf("string value '%s' does not exist", name))

		return ""
	}
	return storeString[name]
}
func GetUint64(name string) uint64 {
	access_mx.Lock()
	defer access_mx.Unlock()

	if _, exists := storeUint64[name]; !exists {
		log.Error("server", "configuration store get error",
			fmt.Errorf("uint64 value '%s' does not exist", name))

		return 0
	}
	return storeUint64[name]
}

func LoadFromDb() error {
	access_mx.Lock()
	defer access_mx.Unlock()

	// reset value stores
	for _, name := range NamesUint64 {
		storeUint64[name] = 0
	}
	for _, name := range NamesString {
		storeString[name] = ""
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
		}
	}
	return nil
}
