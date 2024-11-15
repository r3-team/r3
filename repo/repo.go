package repo

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"r3/config"
)

func getToken(baseUrl string) (string, error) {

	var req = struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}{
		Username: config.GetString("repoUser"),
		Password: config.GetString("repoPass"),
	}

	var res struct {
		Token string `json:"token"`
	}
	if err := httpCallPost("", fmt.Sprintf("%s/api/auth", baseUrl), req, &res); err != nil {
		return "", err
	}
	return res.Token, nil
}

func httpCallGet(token string, url string, reqIf interface{}, resIf interface{}) error {
	return httpCall(http.MethodGet, token, url, reqIf, resIf)
}
func httpCallPost(token string, url string, reqIf interface{}, resIf interface{}) error {
	return httpCall(http.MethodPost, token, url, reqIf, resIf)
}
func httpCall(method string, token string, url string, reqIf interface{}, resIf interface{}) error {

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

	skipVerify := config.GetUint64("repoSkipVerify") == 1
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
