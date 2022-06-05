package request

import (
	"encoding/json"
	"fmt"
	"r3/cluster/tasks"
	"r3/config"
	"r3/tools"
	"strconv"

	"github.com/jackc/pgx/v4"
)

func ConfigGet() (interface{}, error) {

	// not directly changeable configuration options
	ignore := []string{"dbVersionCut", "tokenSecret"}

	res := make(map[string]string)

	for _, name := range config.NamesString {

		if tools.StringInSlice(name, ignore) {
			continue
		}
		res[name] = config.GetString(name)
	}

	for _, name := range config.NamesUint64 {

		if tools.StringInSlice(name, ignore) {
			continue
		}
		res[name] = fmt.Sprintf("%d", config.GetUint64(name))
	}
	return res, nil
}

func ConfigSet_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req map[string]string
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	// check for config changes that have specific consequences
	switchToMaintenance := false
	if value, exists := req["productionMode"]; exists &&
		value != strconv.FormatInt(int64(config.GetUint64("productionMode")), 10) {

		switchToMaintenance = true
	}

	// update config values in DB and local config store
	for name, value := range req {

		if tools.StringInSlice(name, config.NamesString) {
			if err := config.SetString_tx(tx, name, value); err != nil {
				return nil, err
			}
		} else if tools.StringInSlice(name, config.NamesUint64) {

			val, err := strconv.ParseUint(value, 10, 64)
			if err != nil {
				return nil, err
			}

			if err := config.SetUint64_tx(tx, name, val); err != nil {
				return nil, err
			}
		}
	}
	return nil, tasks.ConfigApply(true, false, switchToMaintenance)
}
