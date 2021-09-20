package relation

import (
	"fmt"
	"r3/db"
	"reflect"
	"strings"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgtype"
)

func GetPreview(id uuid.UUID, limit int, offset int) (interface{}, error) {

	var modName, relName string
	atrNames := make([]string, 0)
	res := make([]interface{}, 0)

	if err := db.Pool.QueryRow(db.Ctx, `
		SELECT r.name, m.name, ARRAY(
			SELECT name
			FROM app.attribute
			WHERE relation_id = r.id
			ORDER BY CASE WHEN name = 'id' THEN 0 END, name ASC
		) AS atrs
		FROM app.relation AS r
		INNER JOIN app.module AS m ON m.id = r.module_id
		WHERE r.id = $1
	`, id).Scan(&relName, &modName, &atrNames); err != nil {
		return nil, err
	}

	rows, err := db.Pool.Query(db.Ctx, fmt.Sprintf(`
		SELECT "%s"
		FROM "%s"."%s"
		ORDER BY "id" ASC
		LIMIT $1
		OFFSET $2
	`, strings.Join(atrNames, `", "`), modName, relName), limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		valuePointers := make([]interface{}, len(atrNames))
		valuesAll := make([]interface{}, len(atrNames))
		for i := 0; i < len(atrNames); i++ {
			valuePointers[i] = &valuesAll[i]
		}

		if err := rows.Scan(valuePointers...); err != nil {
			return nil, err
		}

		for i := 0; i < len(atrNames); i++ {
			if fmt.Sprintf("%s", reflect.TypeOf(valuesAll[i])) == "pgtype.Numeric" {
				valuesAll[i] = db.PgxNumericToString(valuesAll[i].(pgtype.Numeric))
			}
		}
		res = append(res, valuesAll)
	}
	return res, nil
}
