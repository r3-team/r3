package request

import (
	"math/rand"
	"r3/cache"
	"r3/config"
	"r3/types"

	"github.com/gofrs/uuid"
)

func PublicGet() (interface{}, error) {

	// random background from available list
	var loginBackgrounds = config.GetUint64Slice("loginBackgrounds")
	var loginBackground uint64
	if len(loginBackgrounds) == 0 {
		loginBackground = 0
	} else {
		loginBackground = loginBackgrounds[rand.Intn(len(loginBackgrounds))]
	}

	return struct {
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
		SystemMsg           types.SystemMsg                `json:"systemMsg"`
		TokenKeepEnable     bool                           `json:"tokenKeepEnable"`
	}{
		Activated:           config.GetLicenseActive(),
		AppName:             config.GetString("appName"),
		AppNameShort:        config.GetString("appNameShort"),
		AppVersion:          config.GetAppVersion().Full,
		CaptionMapCustom:    cache.GetCaptionMapCustom(),
		ClusterNodeName:     cache.GetNodeName(),
		CompanyColorHeader:  config.GetString("companyColorHeader"),
		CompanyColorLogin:   config.GetString("companyColorLogin"),
		CompanyLoginImage:   config.GetString("companyLoginImage"),
		CompanyLogo:         config.GetString("companyLogo"),
		CompanyLogoUrl:      config.GetString("companyLogoUrl"),
		CompanyName:         config.GetString("companyName"),
		CompanyWelcome:      config.GetString("companyWelcome"),
		Css:                 config.GetString("css"),
		LanguageCodes:       cache.GetCaptionLanguageCodes(),
		LoginBackground:     loginBackground,
		ModuleIdMapMeta:     cache.GetModuleIdMapMeta(),
		PresetIdMapRecordId: cache.GetPresetRecordIds(),
		ProductionMode:      config.GetUint64("productionMode"),
		PwaDomainMap:        cache.GetPwaDomainMap(),
		SearchDictionaries:  cache.GetSearchDictionaries(),
		SystemMsg: types.SystemMsg{
			Date0:       config.GetUint64("systemMsgDate0"),
			Date1:       config.GetUint64("systemMsgDate1"),
			Maintenance: config.GetUint64("systemMsgMaintenance") == 1,
			Text:        config.GetString("systemMsgText"),
		},
		TokenKeepEnable: config.GetUint64("tokenKeepEnable") == 1,
	}, nil
}
