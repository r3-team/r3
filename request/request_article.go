package request

import (
	"encoding/json"
	"r3/schema/article"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v4"
)

func ArticleAssign_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req struct {
		Target     string      `json:"target`
		TargetId   uuid.UUID   `json:"targetId"`
		ArticleIds []uuid.UUID `json:"articleIds"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, article.Assign_tx(tx, req.Target, req.TargetId, req.ArticleIds)
}

func ArticleDel_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req struct {
		Id uuid.UUID `json:"id"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, article.Del_tx(tx, req.Id)
}

func ArticleSet_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req types.Article
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, article.Set_tx(tx, req.ModuleId, req.Id, req.Name, req.Captions)
}
