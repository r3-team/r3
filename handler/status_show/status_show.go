package status_show

import (
	"bytes"
	"encoding/json"
	"net/http"
	"r3/config"
	"r3/handler"
	"r3/tools"
	"time"
)

func Handler(w http.ResponseWriter, r *http.Request) {

	var status struct {
		BuilderMode              bool   `json:"builderMode"`
		LicenseActive            bool   `json:"licenseActive"`
		LicenseLoginCount        int64  `json:"licenseLoginCount"`
		LicenseLoginCountLimited int64  `json:"licenseLoginCountLimited"`
		LicenseUsed              bool   `json:"licenseUsed"`
		LicenseValidUntil        int64  `json:"licenseValidUntil"`
		MaintenanceMode          bool   `json:"maintenanceMode"`
		Version                  string `json:"version"`
		VersionBuild             int    `json:"versionBuild"`
	}
	status.BuilderMode = config.GetUint64("builderMode") == 1
	status.LicenseActive = config.GetLicenseActive()
	status.LicenseLoginCount = config.GetLicenseLoginCount(false)
	status.LicenseLoginCountLimited = config.GetLicenseLoginCount(true)
	status.LicenseUsed = config.GetLicenseUsed()
	status.LicenseValidUntil = config.GetLicenseValidUntil()
	status.MaintenanceMode = config.GetUint64("productionMode") == 0
	status.Version = config.GetAppVersion().Full
	status.VersionBuild = config.GetAppVersion().Build

	j, err := json.Marshal(status)
	if err != nil {
		handler.AbortRequest(w, handler.ContextStatusShow, err, handler.ErrGeneral)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	http.ServeContent(
		w, r,
		"response.json",
		time.Unix(tools.GetTimeUnix(), 0),
		bytes.NewReader(j))
}
