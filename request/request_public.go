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
		CompanyColorHeader string   `json:"companyColorHeader"`
		CompanyColorLogin  string   `json:"companyColorLogin"`
		CompanyLogo        string   `json:"companyLogo"`
		CompanyLogoUrl     string   `json:"companyLogoUrl"`
		CompanyName        string   `json:"companyName"`
		CompanyWelcome     string   `json:"companyWelcome"`
		LanguageCodes      []string `json:"languageCodes"`
		ProductionMode     uint64   `json:"productionMode"`
		SchemaTimestamp    int64    `json:"schemaTimestamp"`
	}
	res.Activated = config.GetLicenseActive()
	res.AppName = config.GetString("appName")
	res.AppNameShort = config.GetString("appNameShort")
	res.AppVersion, _, _, _ = config.GetAppVersions()
	res.CompanyColorHeader = config.GetString("companyColorHeader")
	res.CompanyColorLogin = config.GetString("companyColorLogin")
	res.CompanyLogo = config.GetString("companyLogo")
	res.CompanyLogoUrl = config.GetString("companyLogoUrl")
	res.CompanyName = config.GetString("companyName")
	res.CompanyWelcome = config.GetString("companyWelcome")
	res.LanguageCodes = cache.GetCaptionLanguageCodes()
	res.ProductionMode = config.GetUint64("productionMode")
	res.SchemaTimestamp = cache.GetSchemaTimestamp()
	return res, nil
}
