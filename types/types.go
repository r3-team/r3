package types

type Void struct{}

type SystemMsg struct {
	Date0       uint64 `json:"date0"`
	Date1       uint64 `json:"date1"`
	Maintenance bool   `json:"maintenance"`
	Text        string `json:"text"`
}
