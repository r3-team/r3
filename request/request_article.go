package request

import (
	"context"
	"encoding/json"
	"r3/schema"
	"r3/schema/article"
	"r3/types"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func ArticleAssign_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {
	var req struct {
		Target     schema.DbEntity `json:"target`
		TargetId   uuid.UUID       `json:"targetId"`
		ArticleIds []uuid.UUID     `json:"articleIds"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}
	return article.Assign_tx(ctx, tx, req.Target, req.TargetId, req.ArticleIds)
}

func ArticleDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {
	var req uuid.UUID
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}
	return article.Del_tx(ctx, tx, req)
}

func ArticleSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {
	var req types.Article
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}
	return article.Set_tx(ctx, tx, req.ModuleId, req.Id, req.Name, req.Captions)
}
