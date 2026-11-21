package cache_mail

import (
	"context"
	"fmt"
	"r3/types"
	"sync"

	"github.com/jackc/pgx/v5"
)

var (
	templates_mx  sync.RWMutex
	templateIdMap map[int64]types.MailTemplate
)

func GetTemplateMap() map[int64]types.MailTemplate {
	templates_mx.RLock()
	defer templates_mx.RUnlock()

	return templateIdMap
}
func GetTemplate(id int64, content types.MailTemplateContent) (types.MailTemplate, error) {
	templates_mx.RLock()
	defer templates_mx.RUnlock()

	mt, exists := templateIdMap[id]
	if !exists || content != mt.Content {
		return mt, fmt.Errorf("mail template with ID %d does not exist for content '%s'", id, content)
	}
	return mt, nil
}
func LoadTemplateMap_tx(ctx context.Context, tx pgx.Tx) error {

	rows, err := tx.Query(ctx, `
		SELECT id, content, name, body, subject
		FROM instance_mail.template
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	templates_mx.Lock()
	defer templates_mx.Unlock()

	templateIdMap = make(map[int64]types.MailTemplate)
	for rows.Next() {
		var mt types.MailTemplate
		if err := rows.Scan(&mt.Id, &mt.Content, &mt.Name, &mt.Body, &mt.Subject); err != nil {
			return err
		}
		templateIdMap[mt.Id] = mt
	}
	return nil
}
