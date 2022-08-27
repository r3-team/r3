package client_download

import (
	"encoding/json"
	"net/http"
	"r3/bruteforce"
	"r3/handler"
	"r3/login/login_auth"
)

func HandlerConfig(w http.ResponseWriter, r *http.Request) {

	if blocked := bruteforce.Check(r); blocked {
		handler.AbortRequestNoLog(w, handler.ErrBruteforceBlock)
		return
	}

	// get authentication token
	token, err := handler.ReadGetterFromUrl(r, "token")
	if err != nil {
		handler.AbortRequest(w, context, err, handler.ErrGeneral)
		return
	}

	// check token
	var loginId int64
	var admin bool
	var noAuth bool
	if _, err := login_auth.Token(token, &loginId, &admin, &noAuth); err != nil {
		handler.AbortRequest(w, context, err, handler.ErrAuthFailed)
		bruteforce.BadAttempt(r)
		return
	}

	// parse getters
	tokenFixed, err := handler.ReadGetterFromUrl(r, "tokenFixed")
	if err != nil {
		handler.AbortRequest(w, context, err, handler.ErrGeneral)
		return
	}
	hostName, err := handler.ReadGetterFromUrl(r, "hostName")
	if err != nil {
		handler.AbortRequest(w, context, err, handler.ErrGeneral)
		return
	}
	hostPort, err := handler.ReadInt64GetterFromUrl(r, "hostPort")
	if err != nil {
		handler.AbortRequest(w, context, err, handler.ErrGeneral)
		return
	}
	languageCode, err := handler.ReadGetterFromUrl(r, "languageCode")
	if err != nil {
		handler.AbortRequest(w, context, err, handler.ErrGeneral)
		return
	}
	deviceName, err := handler.ReadGetterFromUrl(r, "deviceName")
	if err != nil {
		handler.AbortRequest(w, context, err, handler.ErrGeneral)
		return
	}
	ssl, err := handler.ReadInt64GetterFromUrl(r, "ssl")
	if err != nil {
		handler.AbortRequest(w, context, err, handler.ErrGeneral)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", "attachment; filename=r3_client.conf")

	type configFile struct {
		AutoStart    bool   `json:"autoStart"`
		Debug        bool   `json:"debug"`
		DeviceName   string `json:"deviceName"`
		HostName     string `json:"hostName"`
		HostPort     int    `json:"hostPort"`
		KeepFilesSec int64  `json:"keepFilesSec`
		LanguageCode string `json:"languageCode"`
		LoginId      int64  `json:"loginId"`
		Ssl          bool   `json:"ssl"`
		SslVerify    bool   `json:"sslVerify"`
		TokenFixed   string `json:"tokenFixed"`
	}
	f := configFile{
		AutoStart:    true,
		Debug:        false,
		DeviceName:   deviceName,
		HostName:     hostName,
		HostPort:     int(hostPort),
		KeepFilesSec: 86400,
		LanguageCode: languageCode,
		LoginId:      loginId,
		Ssl:          ssl == 1,
		SslVerify:    true,
		TokenFixed:   tokenFixed,
	}

	fJson, err := json.MarshalIndent(f, "", "\t")
	if err != nil {
		handler.AbortRequest(w, context, err, handler.ErrGeneral)
		return
	}

	if _, err := w.Write(fJson); err != nil {
		handler.AbortRequest(w, context, err, handler.ErrGeneral)
		return
	}
}
