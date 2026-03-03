package repo

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"r3/config"
	"r3/handler"
)

func httpCallGet(token string, url string, skipVerify bool, reqIf any, resIf any) error {
	return httpCall(http.MethodGet, token, url, skipVerify, reqIf, resIf)
}
func httpCallPost(token string, url string, skipVerify bool, reqIf any, resIf any) error {
	return httpCall(http.MethodPost, token, url, skipVerify, reqIf, resIf)
}
func httpCall(method string, token string, url string, skipVerify bool, reqIf any, resIf any) error {

	if method != http.MethodGet && method != http.MethodPost {
		return fmt.Errorf("invalid HTTP method '%s'", method)
	}

	reqJson, err := json.Marshal(reqIf)
	if err != nil {
		return err
	}

	httpReq, err := http.NewRequest(method, url, bytes.NewBuffer(reqJson))
	if err != nil {
		return err
	}

	httpReq.Header.Set("User-Agent", "r3-application")

	if token != "" {
		httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
	}

	httpClient, err := config.GetHttpClient(skipVerify, 30)
	if err != nil {
		return err
	}

	httpRes, err := httpClient.Do(httpReq)
	if err != nil {
		return err
	}
	defer httpRes.Body.Close()

	if httpRes.StatusCode != http.StatusOK {
		return httpErrorGetMsg(httpRes)
	}

	bodyRaw, err := io.ReadAll(httpRes.Body)
	if err != nil {
		return err
	}
	return json.Unmarshal(bodyRaw, resIf)
}

func httpGetAuthToken(urlBase, credUser, credPass string, skipVerify bool) (string, error) {

	var req = struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}{
		Username: credUser,
		Password: credPass,
	}

	var res struct {
		Token string `json:"token"`
	}
	if err := httpCallPost("", fmt.Sprintf("%s/api/auth", urlBase), skipVerify, req, &res); err != nil {
		return "", err
	}
	return res.Token, nil
}

// attempts to parse REI3 error message from response if given (REI3 APIs & generic handlers provide { "error":"MESSAGE" } )
func httpErrorGetMsg(res *http.Response) error {
	errMsg := handler.ErrGeneral
	bodyRaw, err := io.ReadAll(res.Body)
	if err == nil {
		var resErr struct {
			Error string `json:"error"`
		}
		if err := json.Unmarshal(bodyRaw, &resErr); err == nil {
			errMsg = resErr.Error
		}
	}
	return fmt.Errorf("HTTP error code (%d), %s", res.StatusCode, errMsg)

}
