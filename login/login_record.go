package login

import (
	"fmt"
	"r3/cache"
	"r3/db"
	"r3/schema"
	"r3/tools"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5"
)

// get relation records as login associate
// returns slice of up to 10 records
func GetRecords(attributeIdLookup uuid.UUID, idsExclude []int64, byString string) ([]types.LoginRecord, error) {
	cache.Schema_mx.RLock()
	defer cache.Schema_mx.RUnlock()

	records := make([]types.LoginRecord, 0)

	atr, exists := cache.AttributeIdMap[attributeIdLookup]
	if !exists {
		return records, fmt.Errorf("cannot find attribute for ID %s", attributeIdLookup)
	}
	rel := cache.RelationIdMap[atr.RelationId]
	mod := cache.ModuleIdMap[rel.ModuleId]

	var qb tools.QueryBuilder
	qb.UseDollarSigns()
	qb.AddList("SELECT", []string{fmt.Sprintf(`"%s"`, schema.PkName),
		fmt.Sprintf(`"%s"`, atr.Name)})

	qb.Set("FROM", fmt.Sprintf(`"%s"."%s"`, mod.Name, rel.Name))

	if len(idsExclude) != 0 {
		qb.Add("WHERE", fmt.Sprintf(`"%s" <> ALL({IDS_EXCLUDE})`, schema.PkName))
		qb.AddPara("{IDS_EXCLUDE}", idsExclude)
	}

	if byString != "" {
		qb.Add("WHERE", fmt.Sprintf(`"%s" ILIKE {FILTER}`, atr.Name))
		qb.AddPara("{FILTER}", fmt.Sprintf("%%%s%%", byString))
	}

	qb.Add("ORDER", fmt.Sprintf(`"%s" ASC`, atr.Name))
	qb.Set("LIMIT", 10)

	query, err := qb.GetQuery()
	if err != nil {
		return records, err
	}

	rows, err := db.Pool.Query(db.Ctx, query, qb.GetParaValues()...)
	if err != nil {
		return records, err
	}
	defer rows.Close()

	for rows.Next() {
		var r types.LoginRecord
		if err := rows.Scan(&r.Id, &r.Name); err != nil {
			return records, err
		}
		records = append(records, r)
	}
	return records, nil
}

// set login attribute value for specified record ID
func SetRecord_tx(tx pgx.Tx, attributeIdLogin uuid.UUID, loginId pgtype.Int4, recordId int64) error {

	atr, exists := cache.AttributeIdMap[attributeIdLogin]
	if !exists {
		return fmt.Errorf("cannot find attribute for ID %s", attributeIdLogin)
	}
	rel := cache.RelationIdMap[atr.RelationId]
	mod := cache.ModuleIdMap[rel.ModuleId]

	_, err := tx.Exec(db.Ctx, fmt.Sprintf(`
		UPDATE "%s"."%s"
		SET "%s" = $1
		WHERE "%s" = $2
	`, mod.Name, rel.Name, atr.Name, schema.PkName), loginId, recordId)
	return err
}
