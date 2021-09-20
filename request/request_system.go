package request

import (
	"r3/config"
)

func SystemGet() (interface{}, error) {

	var res struct {
		AppBuild   string `json:"appBuild"`
		EmbeddedDb bool   `json:"embeddedDb"`
	}
	_, _, res.AppBuild, _ = config.GetAppVersions()
	res.EmbeddedDb = config.File.Db.Embedded

	return res, nil
}
