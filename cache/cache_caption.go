package cache

import (
	"encoding/json"

	_ "embed"
)

var (
	//go:embed captions/de_de
	caption_de_de json.RawMessage

	//go:embed captions/en_us
	caption_en_us json.RawMessage

	//go:embed captions/it_it
	caption_it_it json.RawMessage

	//go:embed captions/ro_ro
	caption_ro_ro json.RawMessage
)

func GetCaptions(code string) json.RawMessage {
	switch code {
	case "de_de":
		return caption_de_de
	case "en_us":
		return caption_en_us
	case "it_it":
		return caption_it_it
	case "ro_ro":
		return caption_ro_ro
	}

	// default to english, if language code was not valid
	return caption_en_us
}

func GetCaptionLanguageCodes() []string {
	return []string{"en_us", "de_de", "it_it", "ro_ro"}
}
