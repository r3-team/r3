package article

import (
	"context"
	"errors"
	"fmt"
	"r3/log"
	"r3/schema/caption"
	"r3/types"
	"r3/types/constants"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func Assign_bt(bt *pgx.Batch, target types.DbSchemaApp, targetId uuid.UUID, onlyCreate bool, articleIds []uuid.UUID) {
	switch target {
	case constants.DbForm:
		if !onlyCreate {
			bt.Queue(`DELETE FROM app.article_form WHERE form_id = $1`, targetId)
		}
		for i, articleId := range articleIds {
			bt.Queue(`
				INSERT INTO app.article_form (article_id, form_id, position)
				VALUES ($1, $2, $3)
			`, articleId, targetId, i)
		}
	case constants.DbModule:
		if !onlyCreate {
			bt.Queue(`DELETE FROM app.article_help WHERE module_id = $1`, targetId)
		}
		for i, articleId := range articleIds {
			bt.Queue(`
				INSERT INTO app.article_help (article_id, module_id, position)
				VALUES ($1, $2, $3)
			`, articleId, targetId, i)
		}
	default:
		log.Error(log.ContextTransfer, "cannot assign article", errors.New(fmt.Sprintf("invalid target '%s'", target)))
	}
}

func Del_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID) error {
	_, err := tx.Exec(ctx, `
		DELETE FROM app.article
		WHERE id = $1
	`, id)
	return err
}

func Get_tx(ctx context.Context, tx pgx.Tx, moduleId uuid.UUID) ([]types.Article, error) {

	rows, err := tx.Query(ctx, `
		SELECT id, name
		FROM app.article
		WHERE module_id = $1
		ORDER BY name ASC
	`, moduleId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	articles := make([]types.Article, 0)
	for rows.Next() {
		var a types.Article
		if err := rows.Scan(&a.Id, &a.Name); err != nil {
			return nil, err
		}
		a.ModuleId = moduleId
		articles = append(articles, a)
	}
	rows.Close()

	for i, a := range articles {
		articles[i].Captions, err = caption.Get_tx(ctx, tx, constants.DbArticle, a.Id, []string{"articleBody", "articleTitle"})
		if err != nil {
			return nil, err
		}
	}
	return articles, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, moduleId uuid.UUID, onlyCreate bool, id uuid.UUID, name string, captions types.CaptionMap) error {
	if name == "" {
		return errors.New("missing name")
	}

	bt := &pgx.Batch{}
	bt.Queue(`
		INSERT INTO app.article (id, module_id, name)
		VALUES ($1,$2,$3)
		ON CONFLICT (id)
		DO UPDATE SET name = $3
	`, id, moduleId, name)

	caption.Set_bt(bt, id, onlyCreate, captions)
	return tx.SendBatch(ctx, bt).Close()
}
