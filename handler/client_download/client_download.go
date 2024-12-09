package client_download

import (
	"context"
	"net/http"
	"r3/bruteforce"
	"r3/cache"
	"r3/config"
	"r3/handler"
	"r3/login/login_auth"
	"time"
)

var logContext = "client_download"

func Handler(w http.ResponseWriter, r *http.Request) {

	if blocked := bruteforce.Check(r); blocked {
		handler.AbortRequestNoLog(w, handler.ErrBruteforceBlock)
		return
	}

	// get authentication token
	token, err := handler.ReadGetterFromUrl(r, "token")
	if err != nil {
		handler.AbortRequest(w, logContext, err, handler.ErrGeneral)
		return
	}

	ctx, ctxCanc := context.WithTimeout(context.Background(),
		time.Duration(int64(config.GetUint64("dbTimeoutDataWs")))*time.Second)

	defer ctxCanc()

	// check token
	var loginId int64
	var admin bool
	var noAuth bool
	if _, err := login_auth.Token(ctx, token, &loginId, &admin, &noAuth); err != nil {
		handler.AbortRequest(w, logContext, err, handler.ErrAuthFailed)
		bruteforce.BadAttempt(r)
		return
	}

	// parse getters
	requestedOs, err := handler.ReadGetterFromUrl(r, "os")
	if err != nil {
		handler.AbortRequest(w, logContext, err, handler.ErrGeneral)
		return
	}

	w.Header().Set("Content-Type", r.Header.Get("Content-Type"))

	switch requestedOs {
	case "amd64_windows":
		w.Header().Set("Content-Disposition", "attachment; filename=r3_client.exe")
		_, err = w.Write(cache.Client_amd64_win)
	case "amd64_linux":
		w.Header().Set("Content-Disposition", "attachment; filename=r3_client.bin")
		_, err = w.Write(cache.Client_amd64_linux)
	case "arm64_linux":
		w.Header().Set("Content-Disposition", "attachment; filename=r3_client.bin")
		_, err = w.Write(cache.Client_arm64_linux)
	case "amd64_mac":
		w.Header().Set("Content-Disposition", "attachment; filename=r3_client.dmg")
		_, err = w.Write(cache.Client_amd64_mac)
	default:
		handler.AbortRequest(w, logContext, err, handler.ErrGeneral)
		return
	}

	if err != nil {
		handler.AbortRequest(w, logContext, err, handler.ErrGeneral)
		return
	}
}
