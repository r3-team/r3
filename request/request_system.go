package request

import (
	"fmt"
	"r3/config"
)

func SystemGet() (interface{}, error) {

	var res struct {
		AppBuild   string `json:"appBuild"`
		EmbeddedDb bool   `json:"embeddedDb"`
	}
	res.AppBuild = fmt.Sprintf("%d", config.GetAppVersion().Build)
	res.EmbeddedDb = config.File.Db.Embedded

	return res, nil
}
