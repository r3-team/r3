package login

import (
	"context"
	"fmt"
	"r3/cache"
	"r3/schema"
	"r3/tools"
	"r3/types"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

// get relation records as login associate
// returns slice of up to 10 records
func GetRecords_tx(ctx context.Context, tx pgx.Tx, attributeIdLookup uuid.UUID, idsExclude []int64,
	byId int64, byString string) ([]types.LoginRecord, error) {

	modName, relName, atrName, err := cache.GetAttributeDbNames(attributeIdLookup)
	if err != nil {
		return nil, err
	}

	var qb tools.QueryBuilder
	qb.UseDollarSigns()
	qb.AddList("SELECT", []string{fmt.Sprintf(`"%s"`, schema.PkName),
		fmt.Sprintf(`"%s"`, atrName)})

	qb.SetFrom(fmt.Sprintf(`"%s"."%s"`, modName, relName))

	if len(idsExclude) != 0 {
		qb.Add("WHERE", fmt.Sprintf(`"%s" <> ALL({IDS_EXCLUDE})`, schema.PkName))
		qb.AddPara("{IDS_EXCLUDE}", idsExclude)
	}

	if byString != "" {
		qb.Add("WHERE", fmt.Sprintf(`"%s" ILIKE {FILTER}`, atrName))
		qb.AddPara("{FILTER}", fmt.Sprintf("%%%s%%", byString))
	} else if byId != 0 {
		qb.Add("WHERE", fmt.Sprintf(`"%s" = {FILTER}`, schema.PkName))
		qb.AddPara("{FILTER}", byId)
	}

	qb.Add("ORDER", fmt.Sprintf(`"%s" ASC`, atrName))
	qb.SetLimit(10)

	query, err := qb.GetQuery()
	if err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, query, qb.GetParaValues()...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := make([]types.LoginRecord, 0)
	for rows.Next() {
		var r types.LoginRecord
		if err := rows.Scan(&r.Id, &r.Name); err != nil {
			return nil, err
		}
		records = append(records, r)
	}
	return records, nil
}
