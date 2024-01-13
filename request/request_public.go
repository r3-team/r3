package request

import (
	"math/rand"
	"r3/cache"
	"r3/config"
	"r3/types"

	"github.com/gofrs/uuid"
)

func PublicGet() (interface{}, error) {
	var res struct {
		Activated           bool                           `json:"activated"`
		AppName             string                         `json:"appName"`
		AppNameShort        string                         `json:"appNameShort"`
		AppVersion          string                         `json:"appVersion"`
		CaptionMapCustom    types.CaptionMapsAll           `json:"captionMapCustom"`
		ClusterNodeName     string                         `json:"clusterNodeName"`
		CompanyColorHeader  string                         `json:"companyColorHeader"`
		CompanyColorLogin   string                         `json:"companyColorLogin"`
		CompanyLoginImage   string                         `json:"companyLoginImage"`
		CompanyLogo         string                         `json:"companyLogo"`
		CompanyLogoUrl      string                         `json:"companyLogoUrl"`
		CompanyName         string                         `json:"companyName"`
		CompanyWelcome      string                         `json:"companyWelcome"`
		Css                 string                         `json:"css"`
		LanguageCodes       []string                       `json:"languageCodes"`
		LoginBackground     uint64                         `json:"loginBackground"`
		ModuleIdMapMeta     map[uuid.UUID]types.ModuleMeta `json:"moduleIdMapMeta"`
		PresetIdMapRecordId map[uuid.UUID]int64            `json:"presetIdMapRecordId"`
		ProductionMode      uint64                         `json:"productionMode"`
		PwaDomainMap        map[string]uuid.UUID           `json:"pwaDomainMap"`
		SearchDictionaries  []string                       `json:"searchDictionaries"`
		TokenKeepEnable     bool                           `json:"tokenKeepEnable"`
	}
	res.Activated = config.GetLicenseActive()
	res.AppName = config.GetString("appName")
	res.AppNameShort = config.GetString("appNameShort")
	res.AppVersion, _, _, _ = config.GetAppVersions()
	res.CaptionMapCustom = cache.GetCaptionMapCustom()
	res.ClusterNodeName = cache.GetNodeName()
	res.CompanyColorHeader = config.GetString("companyColorHeader")
	res.CompanyColorLogin = config.GetString("companyColorLogin")
	res.CompanyLoginImage = config.GetString("companyLoginImage")
	res.CompanyLogo = config.GetString("companyLogo")
	res.CompanyLogoUrl = config.GetString("companyLogoUrl")
	res.CompanyName = config.GetString("companyName")
	res.CompanyWelcome = config.GetString("companyWelcome")
	res.Css = config.GetString("css")
	res.LanguageCodes = cache.GetCaptionLanguageCodes()
	res.ModuleIdMapMeta = cache.GetModuleIdMapMeta()
	res.PresetIdMapRecordId = cache.GetPresetRecordIds()
	res.ProductionMode = config.GetUint64("productionMode")
	res.PwaDomainMap = cache.GetPwaDomainMap()
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
