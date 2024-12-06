package request

import (
	"encoding/json"
	"r3/repo"

	"github.com/jackc/pgx/v5/pgtype"
)

func FeedbackSend(reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Code          int         `json:"code"`
		FormId        pgtype.UUID `json:"formId"`
		IsAdmin       bool        `json:"isAdmin"`
		ModuleId      pgtype.UUID `json:"moduleId"`
		ModuleRelated bool        `json:"moduleRelated"`
		Mood          int         `json:"mood"`
		Text          string      `json:"text"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, repo.SendFeedback(req.IsAdmin, req.ModuleRelated, req.ModuleId,
		req.FormId, req.Mood, req.Code, req.Text)
}
