package article

import (
	"context"
	"errors"
	"r3/schema"
	"r3/schema/caption"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func Assign_tx(ctx context.Context, tx pgx.Tx, target schema.DbEntity, targetId uuid.UUID, articleIds []uuid.UUID) error {
	switch target {
	case schema.DbForm:
		if _, err := tx.Exec(ctx, `
			DELETE FROM app.article_form
			WHERE form_id = $1
		`, targetId); err != nil {
			return err
		}
		for i, articleId := range articleIds {
			if _, err := tx.Exec(ctx, `
				INSERT INTO app.article_form (article_id, form_id, position)
				VALUES ($1, $2, $3)
			`, articleId, targetId, i); err != nil {
				return err
			}
		}
	case schema.DbModule:
		if _, err := tx.Exec(ctx, `
			DELETE FROM app.article_help
			WHERE module_id = $1
		`, targetId); err != nil {
			return err
		}
		for i, articleId := range articleIds {
			if _, err := tx.Exec(ctx, `
				INSERT INTO app.article_help (article_id, module_id, position)
				VALUES ($1, $2, $3)
			`, articleId, targetId, i); err != nil {
				return err
			}
		}
	default:
		return errors.New("invalid article assign target")
	}
	return nil
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
		articles[i].Captions, err = caption.Get_tx(ctx, tx, schema.DbArticle, a.Id, []string{"articleBody", "articleTitle"})
		if err != nil {
			return nil, err
		}
	}
	return articles, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, moduleId uuid.UUID, id uuid.UUID, name string, captions types.CaptionMap) error {
	if name == "" {
		return errors.New("missing name")
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO app.article (id, module_id, name)
		VALUES ($1,$2,$3)
		ON CONFLICT (id)
		DO UPDATE SET name = $3
	`, id, moduleId, name); err != nil {
		return err
	}
	return caption.Set_tx(ctx, tx, id, captions)
}
