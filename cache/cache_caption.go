package cache

import (
	"r3/config/captionMap"
	"r3/types"
	"sync"

	"github.com/jackc/pgx/v5/pgtype"
)

var (
	caption_mx       sync.RWMutex
	captionMapCustom types.CaptionMapsAll // custom captions (for local instance)
)

func GetCaptionLanguageCodes() []string {
	return []string{"en_us", "de_de", "fr_fr", "hu_hu", "it_it", "lv_lv", "ro_ro", "zh_cn"}
}

func GetCaptionMapCustom() types.CaptionMapsAll {
	caption_mx.RLock()
	defer caption_mx.RUnlock()
	return captionMapCustom
}

func LoadCaptionMapCustom() error {
	caption_mx.Lock()
	defer caption_mx.Unlock()

	var err error
	captionMapCustom, err = captionMap.Get(pgtype.UUID{}, "instance")
	return err
}
