package log

import (
	"fmt"
	"r3/db"
	"r3/tools"
	"r3/types"
	"sync"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

var (
	access_mx = sync.Mutex{}
	nodeId    = pgtype.UUID{} // ID of the current node

	outputCli bool // write logs also to command line

	// log levels
	contextLevel = map[string]int{
		"backup":    1,
		"cache":     1,
		"cluster":   1,
		"csv":       1,
		"imager":    1,
		"mail":      1,
		"module":    1,
		"ldap":      1,
		"scheduler": 1,
		"server":    1,
		"transfer":  1,
		"websocket": 1,
	}
)

func Get(dateFrom pgtype.Int8, dateTo pgtype.Int8, limit int, offset int,
	context string, byString string) ([]types.Log, int, error) {

	logs := make([]types.Log, 0)
	total := 0

	var qb tools.QueryBuilder
	qb.UseDollarSigns()
	qb.AddList("SELECT", []string{"l.level", "l.context", "l.message", "l.date_milli", "COALESCE(m.name,'-')", "n.name"})
	qb.Set("FROM", "instance.log AS l")
	qb.Add("JOIN", "LEFT JOIN app.module AS m ON m.id = l.module_id")
	qb.Add("JOIN", "LEFT JOIN instance_cluster.node AS n ON n.id = l.node_id")

	if context != "" {
		qb.Add("WHERE", `l.context::TEXT = {CONTEXT}`)
		qb.AddPara("{CONTEXT}", context)
	}

	if byString != "" {
		qb.Add("WHERE", `(
			l.message ILIKE {NAME} OR
			m.name    ILIKE {NAME}
		)`)
		qb.AddPara("{NAME}", fmt.Sprintf("%%%s%%", byString))
	}

	if dateFrom.Valid {
		qb.Add("WHERE", "l.date_milli >= {DATEFROM}")
		qb.AddPara("{DATEFROM}", dateFrom.Int64*1000)
	}

	if dateTo.Valid {
		qb.Add("WHERE", "l.date_milli <= {DATETO}")
		qb.AddPara("{DATETO}", dateTo.Int64*1000)
	}

	qb.Add("ORDER", "l.date_milli DESC")
	qb.Set("OFFSET", offset)
	qb.Set("LIMIT", limit)

	query, err := qb.GetQuery()
	if err != nil {
		return nil, 0, err
	}

	rows, err := db.Pool.Query(db.Ctx, query, qb.GetParaValues()...)
	if err != nil {
		return nil, 0, err
	}

	for rows.Next() {
		var l types.Log
		var dateMilli int64

		if err := rows.Scan(&l.Level, &l.Context, &l.Message,
			&dateMilli, &l.ModuleName, &l.NodeName); err != nil {

			return nil, 0, err
		}

		l.Date = int64(dateMilli / 1000)
		logs = append(logs, l)
	}
	rows.Close()

	// get total count
	qb.UseDollarSigns()
	qb.Reset("SELECT")
	qb.Reset("ORDER")
	qb.Reset("LIMIT")
	qb.Reset("OFFSET")
	qb.Add("SELECT", "COUNT(*)")

	query, err = qb.GetQuery()
	if err != nil {
		return nil, 0, err
	}

	if err := db.Pool.QueryRow(db.Ctx, query, qb.GetParaValues()...).Scan(&total); err != nil {
		return nil, 0, err
	}
	return logs, total, nil
}

func SetOutputCli(state bool) {
	access_mx.Lock()
	defer access_mx.Unlock()

	outputCli = state
}
func SetLogLevel(context string, level int) {
	access_mx.Lock()
	defer access_mx.Unlock()

	if _, exists := contextLevel[context]; !exists {
		return
	}
	contextLevel[context] = level
}
func SetNodeId(id uuid.UUID) {
	access_mx.Lock()
	defer access_mx.Unlock()

	nodeId.Bytes = id
	nodeId.Valid = true
}

func Info(context string, message string) {
	write(3, context, message, nil)
}
func Warning(context string, message string, err error) {
	write(2, context, message, err)
}
func Error(context string, message string, err error) {
	write(1, context, message, err)
}

func write(level int, context string, message string, err error) {

	levelActive, exists := contextLevel[context]
	if !exists {
		return
	}

	if level > levelActive {
		return
	}

	// append error message, if available
	if err != nil {
		if message != "" {
			message = fmt.Sprintf("%s, %s", message, err.Error())
		} else {
			message = err.Error()
		}
	}

	// log to CLI if available
	if outputCli {
		fmt.Printf("%s %s %s\n", tools.GetTimeSql(), context, message)
	}

	// log to database if available
	if db.Pool != nil {

		// reduce message size stored in DB to at most 10k chars
		// if access to larger messages is required, use CLI
		if len(message) > 10000 {
			message = message[:10000]
		}

		if _, err := db.Pool.Exec(db.Ctx, `
			INSERT INTO instance.log (level, context, message, date_milli, node_id)
			VALUES ($1,$2,$3,$4,$5)
		`, level, context, message, tools.GetTimeUnixMilli(), nodeId); err != nil {

			// if database logging fails, output error to CLI if available
			if outputCli {
				fmt.Printf("failed to write log to DB, error: %v\n", err)
			}
		}
	}
}
