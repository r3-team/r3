package request_dbSync

import (
	"context"
	"encoding/json"
	"r3/tools"
	"r3/types"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func JobLogGet(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {

	var (
		req struct {
			ByHostId uuid.UUID `json:"byHostId"`
			Limit    int       `json:"limit"`
			Offset   int       `json:"offset"`
		}
		res struct {
			Logs  []types.DbSyncJobLog `json:"logs"`
			Total int                  `json:"total"`
		}
	)
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	var qb tools.QueryBuilder
	qb.UseDollarSigns()
	qb.AddList("SELECT", []string{"job_id", "records_count", "date_ran"})
	qb.SetFrom("instance_db_sync.job_log")

	qb.Add("WHERE", "job_id IN (SELECT id FROM instance_db_sync.job WHERE host_id = {HOST_ID})")
	qb.AddPara("{HOST_ID}", req.ByHostId)

	qb.Add("ORDER", "date_ran DESC")
	qb.SetOffset(req.Offset)
	qb.SetLimit(req.Limit)

	query, err := qb.GetQuery()
	if err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, query, qb.GetParaValues()...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res.Logs = make([]types.DbSyncJobLog, 0)
	for rows.Next() {
		var l types.DbSyncJobLog
		if err := rows.Scan(&l.JobId, &l.RecordsCount, &l.DateRan); err != nil {
			return nil, err
		}
		res.Logs = append(res.Logs, l)
	}

	// get total count
	qb.UseDollarSigns()
	qb.Reset("SELECT")
	qb.Reset("ORDER")
	qb.Reset("LIMIT")
	qb.Reset("OFFSET")
	qb.Add("SELECT", "COUNT(*)")

	query, err = qb.GetQuery()
	if err != nil {
		return nil, err
	}
	if err := tx.QueryRow(ctx, query, qb.GetParaValues()...).Scan(&res.Total); err != nil {
		return nil, err
	}
	return res, nil

}
