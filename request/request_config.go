package request

import (
	"encoding/json"
	"fmt"
	"r3/bruteforce"
	"r3/config"
	"strconv"
	"tools"

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

	// update system state
	bruteforce.SetConfig()
	config.SetLogLevels()
	return nil, nil
}
