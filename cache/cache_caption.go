package cache

import (
	"context"
	"r3/config/captionMap"
	"r3/db"
	"r3/types"
	"sync"

	"github.com/jackc/pgx/v5/pgtype"
)

var (
	caption_mx       sync.RWMutex
	captionMapCustom types.CaptionMapsAll // custom captions (for local instance)
)

func GetCaptionLanguageCodes() []string {
	return []string{"en_us", "de_de", "ar_eg", "fr_fr", "hu_hu", "it_it", "lv_lv", "ro_ro", "zh_cn"}
}

func GetCaptionMapCustom() types.CaptionMapsAll {
	caption_mx.RLock()
	defer caption_mx.RUnlock()
	return captionMapCustom
}

func LoadCaptionMapCustom() error {
	ctx, ctxCanc := context.WithTimeout(context.Background(), db.CtxDefTimeoutSysTask)
	defer ctxCanc()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	cus, err := captionMap.Get_tx(ctx, tx, pgtype.UUID{}, "instance")
	if err != nil {
		return err
	}

	caption_mx.Lock()
	captionMapCustom = cus
	caption_mx.Unlock()

	return tx.Commit(ctx)
}
