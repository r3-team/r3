package scheduler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"r3/config"
	"r3/db"
	"r3/log"
)

func updateCheck() error {

	var check struct {
		Version string `json:"version"`
	}
	url := fmt.Sprintf("%s?old=%s", config.GetString("updateCheckUrl"), config.GetAppVersion().Full)

	log.Info("server", fmt.Sprintf("starting update check at '%s'", url))

	httpClient, err := config.GetHttpClient(false, 10)
	if err != nil {
		return err
	}

	httpReq, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	httpReq.Header.Set("User-Agent", "r3-application")

	httpRes, err := httpClient.Do(httpReq)
	if err != nil {
		return err
	}

	body, err := io.ReadAll(httpRes.Body)
	if err != nil {
		return err
	}

	if err := json.Unmarshal(body, &check); err != nil {
		return err
	}

	ctx := db.GetCtxTimeoutSysTask()
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := config.SetString_tx(tx, "updateCheckVersion", check.Version); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return err
	}

	log.Info("server", fmt.Sprintf("update check returned version '%s'", check.Version))
	return nil
}
