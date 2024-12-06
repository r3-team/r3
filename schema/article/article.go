package article

import (
	"context"
	"errors"
	"r3/db"
	"r3/schema"
	"r3/schema/caption"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func Assign_tx(ctx context.Context, tx pgx.Tx, target string, targetId uuid.UUID, articleIds []uuid.UUID) error {
	switch target {
	case "form":
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
	case "module":
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

func Get(moduleId uuid.UUID) ([]types.Article, error) {

	articles := make([]types.Article, 0)

	rows, err := db.Pool.Query(context.Background(), `
		SELECT id, name
		FROM app.article
		WHERE module_id = $1
		ORDER BY name ASC
	`, moduleId)
	if err != nil {
		return articles, err
	}

	for rows.Next() {
		var a types.Article
		if err := rows.Scan(&a.Id, &a.Name); err != nil {
			rows.Close()
			return articles, err
		}
		a.ModuleId = moduleId
		articles = append(articles, a)
	}
	rows.Close()

	// get title/body captions
	for i, a := range articles {
		a.Captions, err = caption.Get("article", a.Id, []string{"articleBody", "articleTitle"})
		if err != nil {
			return articles, err
		}
		articles[i] = a
	}
	return articles, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, moduleId uuid.UUID, id uuid.UUID, name string, captions types.CaptionMap) error {

	if name == "" {
		return errors.New("missing name")
	}

	known, err := schema.CheckCreateId_tx(ctx, tx, &id, "article", "id")
	if err != nil {
		return err
	}

	if known {
		if _, err := tx.Exec(ctx, `
			UPDATE app.article
			SET name = $1
			WHERE id = $2
		`, name, id); err != nil {
			return err
		}
	} else {
		if _, err := tx.Exec(ctx, `
			INSERT INTO app.article (id, module_id, name)
			VALUES ($1,$2,$3)
		`, id, moduleId, name); err != nil {
			return err
		}
	}

	// set captions
	return caption.Set_tx(ctx, tx, id, captions)
}
