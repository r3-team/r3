package cache

import (
	"context"
	"slices"
	"sync"

	"github.com/jackc/pgx/v5"
)

var (
	dict    []string // list of dictionaries for full text search, read from DB
	dict_mx sync.RWMutex
)

func GetSearchDictionaries() []string {
	dict_mx.RLock()
	defer dict_mx.RUnlock()
	return dict
}

func GetSearchDictionaryIsValid(entry string) bool {
	dict_mx.RLock()
	defer dict_mx.RUnlock()
	return slices.Contains(dict, entry)
}

func LoadSearchDictionaries_tx(ctx context.Context, tx pgx.Tx) error {
	dict_mx.Lock()
	defer dict_mx.Unlock()

	return tx.QueryRow(ctx, `
		SELECT ARRAY_AGG(cfgname::TEXT)
		FROM pg_catalog.pg_ts_config
	`).Scan(&dict)
}
