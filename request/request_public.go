package request

import (
	"r3/cache"
	"r3/config"
)

func PublicGet() (interface{}, error) {
	var res struct {
		Activated          bool     `json:"activated"`
		AppName            string   `json:"appName"`
		AppNameShort       string   `json:"appNameShort"`
		AppVersion         string   `json:"appVersion"`
		ClusterNodeName    string   `json:"clusterNodeName"`
		CompanyColorHeader string   `json:"companyColorHeader"`
		CompanyColorLogin  string   `json:"companyColorLogin"`
		CompanyLogo        string   `json:"companyLogo"`
		CompanyLogoUrl     string   `json:"companyLogoUrl"`
		CompanyName        string   `json:"companyName"`
		CompanyWelcome     string   `json:"companyWelcome"`
		Css                string   `json:"css"`
		LanguageCodes      []string `json:"languageCodes"`
		ProductionMode     uint64   `json:"productionMode"`
		SchemaTimestamp    int64    `json:"schemaTimestamp"`
		SearchDictionaries []string `json:"searchDictionaries"`
	}
	res.Activated = config.GetLicenseActive()
	res.AppName = config.GetString("appName")
	res.AppNameShort = config.GetString("appNameShort")
	res.AppVersion, _, _, _ = config.GetAppVersions()
	res.ClusterNodeName = cache.GetNodeName()
	res.CompanyColorHeader = config.GetString("companyColorHeader")
	res.CompanyColorLogin = config.GetString("companyColorLogin")
	res.CompanyLogo = config.GetString("companyLogo")
	res.CompanyLogoUrl = config.GetString("companyLogoUrl")
	res.CompanyName = config.GetString("companyName")
	res.CompanyWelcome = config.GetString("companyWelcome")
	res.Css = config.GetString("css")
	res.LanguageCodes = cache.GetCaptionLanguageCodes()
	res.ProductionMode = config.GetUint64("productionMode")
	res.SchemaTimestamp = cache.GetSchemaTimestamp()
	res.SearchDictionaries = cache.GetSearchDictionaries()
	return res, nil
}
