package request

import (
	"encoding/json"
	"fmt"
	"r3/cluster"
	"r3/config"
	"slices"
	"strconv"

	"github.com/jackc/pgx/v5"
)

func ConfigGet() (interface{}, error) {

	// not directly changeable configuration options
	ignore := []string{"dbVersionCut", "tokenSecret"}

	res := make(map[string]string)

	for _, name := range config.NamesString {

		if slices.Contains(ignore, name) {
			continue
		}
		res[name] = config.GetString(name)
	}

	for _, name := range config.NamesUint64 {

		if slices.Contains(ignore, name) {
			continue
		}
		res[name] = fmt.Sprintf("%d", config.GetUint64(name))
	}

	for _, name := range config.NamesUint64Slice {

		if slices.Contains(ignore, name) {
			continue
		}
		json, err := json.Marshal(config.GetUint64Slice(name))
		if err != nil {
			return nil, err
		}
		res[name] = string(json)
	}
	return res, nil
}

func ConfigSet_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req map[string]string
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	// check for config changes that have specific consequences
	productionModeChange := false
	if value, exists := req["productionMode"]; exists &&
		value != strconv.FormatInt(int64(config.GetUint64("productionMode")), 10) {

		productionModeChange = true
	}

	// update config values in DB and local config store
	for name, value := range req {

		if slices.Contains(config.NamesString, name) {
			if err := config.SetString_tx(tx, name, value); err != nil {
				return nil, err
			}
		} else if slices.Contains(config.NamesUint64, name) {

			val, err := strconv.ParseUint(value, 10, 64)
			if err != nil {
				return nil, err
			}

			if err := config.SetUint64_tx(tx, name, val); err != nil {
				return nil, err
			}

		} else if slices.Contains(config.NamesUint64Slice, name) {

			var val []uint64
			if err := json.Unmarshal([]byte(value), &val); err != nil {
				return nil, err
			}

			if err := config.SetUint64Slice_tx(tx, name, val); err != nil {
				return nil, err
			}
		}
	}
	return nil, cluster.ConfigChanged(true, false, productionModeChange)
}
