package repo

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"r3/config"
	"r3/types"
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

	if httpRes.StatusCode != http.StatusOK {
		return fmt.Errorf("non-OK HTTP status code (%d)", httpRes.StatusCode)
	}

	defer httpRes.Body.Close()
	bodyRaw, err := io.ReadAll(httpRes.Body)
	if err != nil {
		return err
	}
	return json.Unmarshal(bodyRaw, resIf)
}

func httpGetAuthToken(r types.Repo) (string, error) {

	var req = struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}{
		Username: r.FetchUserName,
		Password: r.FetchUserPass,
	}

	var res struct {
		Token string `json:"token"`
	}
	if err := httpCallPost("", fmt.Sprintf("%s/api/auth", r.Url), r.SkipVerify, req, &res); err != nil {
		return "", err
	}
	return res.Token, nil
}
