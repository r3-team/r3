package request

import (
	"math/rand"
	"r3/cache"
	"r3/config"

	"github.com/gofrs/uuid"
)

func PublicGet() (interface{}, error) {
	var res struct {
		Activated          bool                 `json:"activated"`
		AppName            string               `json:"appName"`
		AppNameShort       string               `json:"appNameShort"`
		AppVersion         string               `json:"appVersion"`
		ClusterNodeName    string               `json:"clusterNodeName"`
		CompanyColorHeader string               `json:"companyColorHeader"`
		CompanyColorLogin  string               `json:"companyColorLogin"`
		CompanyLogo        string               `json:"companyLogo"`
		CompanyLogoUrl     string               `json:"companyLogoUrl"`
		CompanyName        string               `json:"companyName"`
		CompanyWelcome     string               `json:"companyWelcome"`
		Css                string               `json:"css"`
		LanguageCodes      []string             `json:"languageCodes"`
		LoginBackground    uint64               `json:"loginBackground"`
		ProductionMode     uint64               `json:"productionMode"`
		PwaDomainMap       map[string]uuid.UUID `json:"pwaDomainMap"`
		SchemaTimestamp    int64                `json:"schemaTimestamp"`
		SearchDictionaries []string             `json:"searchDictionaries"`
		TokenKeepEnable    bool                 `json:"tokenKeepEnable"`
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
	res.PwaDomainMap = cache.GetPwaDomainMap()
	res.SchemaTimestamp = cache.GetSchemaTimestamp()
	res.SearchDictionaries = cache.GetSearchDictionaries()
	res.TokenKeepEnable = config.GetUint64("tokenKeepEnable") == 1

	// random background from available list
	var loginBackgrounds = config.GetUint64Slice("loginBackgrounds")
	if len(loginBackgrounds) == 0 {
		res.LoginBackground = 0
	} else {
		res.LoginBackground = loginBackgrounds[rand.Intn(len(loginBackgrounds))]
	}

	return res, nil
}
