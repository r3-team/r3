package request

import (
	"context"
	"encoding/json"
	"r3/schema/article"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func ArticleAssign_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req struct {
		Target     string      `json:"target`
		TargetId   uuid.UUID   `json:"targetId"`
		ArticleIds []uuid.UUID `json:"articleIds"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, article.Assign_tx(ctx, tx, req.Target, req.TargetId, req.ArticleIds)
}

func ArticleDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req struct {
		Id uuid.UUID `json:"id"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, article.Del_tx(ctx, tx, req.Id)
}

func ArticleSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req types.Article
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, article.Set_tx(ctx, tx, req.ModuleId, req.Id, req.Name, req.Captions)
}
