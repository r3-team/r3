package repo

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"r3/config"
)

func getToken(url string) (string, error) {

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
	if err := post("", url, req, &res); err != nil {
		return "", err
	}
	return res.Token, nil
}

func post(token string, url string, reqIf interface{}, resIf interface{}) error {

	reqJson, err := json.Marshal(reqIf)
	if err != nil {
		return err
	}

	httpReq, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(reqJson))
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
