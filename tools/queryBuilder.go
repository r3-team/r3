package tools

import (
	"fmt"
	"regexp"
	"strings"
)

// QueryBuilder helper type
// helps by building a single large but valid query through many alterations
type QueryBuilder struct {

	// query components
	cSelect []string
	cFrom   string
	cJoin   []string
	cWhere  []string
	cGroup  []string
	cOrder  []string
	cLimit  int
	cOffset int
	cParas  map[string]interface{} // named parameters, used as WHERE = {NAME}

	// options
	dollarSigns     bool
	dollarSignCount int

	// ordered parameters, important for SQL statement with ? placeholders
	cParasOrdered []interface{}
}

func (qb *QueryBuilder) Add(component string, value string) {
	switch component {
	case "SELECT":
		qb.cSelect = append(qb.cSelect, value)
	case "JOIN":
		qb.cJoin = append(qb.cJoin, value)
	case "WHERE":
		qb.cWhere = append(qb.cWhere, value)
	case "GROUP":
		qb.cGroup = append(qb.cGroup, value)
	case "ORDER":
		qb.cOrder = append(qb.cOrder, value)
	}
}
func (qb *QueryBuilder) AddList(component string, values []string) {
	for _, value := range values {
		qb.Add(component, value)
	}
}
func (qb *QueryBuilder) AddPara(name string, value interface{}) {
	if qb.cParas == nil {
		qb.cParas = make(map[string]interface{})
	}

	qb.cParas[name] = value
}
func (qb *QueryBuilder) SetFrom(value string) {
	qb.cFrom = value
}
func (qb *QueryBuilder) SetOffset(value int) {
	qb.cOffset = value
}
func (qb *QueryBuilder) SetLimit(value int) {
	qb.cLimit = value
}
func (qb *QueryBuilder) Reset(component string) {
	switch component {
	case "SELECT":
		qb.cSelect = nil
	case "JOIN":
		qb.cJoin = nil
	case "WHERE":
		qb.cWhere = nil
		qb.cParas = make(map[string]interface{})
	case "GROUP":
		qb.cGroup = nil
	case "ORDER":
		qb.cOrder = nil
	case "LIMIT":
		qb.cLimit = 0
	case "OFFSET":
		qb.cOffset = 0
	}
}

func (qb *QueryBuilder) GetQuery() (string, error) {

	qb.cParasOrdered = make([]interface{}, 0)

	// build query, start with SELECT, FROM, JOIN
	query := fmt.Sprintf("SELECT %s\n", strings.Join(qb.cSelect, ", "))
	query += fmt.Sprintf("FROM %s\n", qb.cFrom)

	// JOIN
	if len(qb.cJoin) != 0 {
		for _, join := range qb.cJoin {
			query += join + "\n"
		}
	}

	// WHERE
	if len(qb.cWhere) != 0 {
		for i, where := range qb.cWhere {

			// placeholders can be put inside WHERE statements, as in 'name = {NAME}'
			// these are replaced with ? for prepared statements, as in 'name = ?'
			// there must be a parameter with an identical name available to assign to placeholder
			regex := regexp.MustCompile(`(\{.*?\})`)
			matches := regex.FindAllStringSubmatch(where, -1)

			for _, match := range matches {

				if _, ok := qb.cParas[match[1]]; !ok {
					return "", fmt.Errorf("placeholder %s not properly registered for query helper", match[1])
				}

				if !qb.dollarSigns {
					where = strings.Replace(where, match[1], "?", 1)
				} else {
					where = strings.Replace(where, match[1], fmt.Sprintf("$%d", qb.dollarSignCount), 1)
					qb.dollarSignCount++
				}
				qb.cParasOrdered = append(qb.cParasOrdered, qb.cParas[match[1]])
			}

			if i == 0 {
				query += fmt.Sprintf("WHERE %s\n", where)
			} else {
				query += fmt.Sprintf("AND %s\n", where)
			}
		}
	}

	// GROUP BY
	if len(qb.cGroup) != 0 {
		for i, group := range qb.cGroup {
			if i == 0 {
				query += "GROUP BY " + group
			} else {
				query += ", " + group
			}
		}
		query += "\n"
	}

	// ORDER
	if len(qb.cOrder) != 0 {
		for i, order := range qb.cOrder {
			if i == 0 {
				query += "ORDER BY " + order
			} else {
				query += ", " + order
			}
		}
		query += "\n"
	}

	// LIMIT and OFFSET
	if qb.cLimit != 0 || qb.cOffset != 0 {
		query += fmt.Sprintf("LIMIT %d OFFSET %d\n", qb.cLimit, qb.cOffset)
	}

	return query, nil
}
func (qb *QueryBuilder) GetParaValues() []interface{} {
	return qb.cParasOrdered
}

func (qb *QueryBuilder) UseDollarSigns() {
	qb.dollarSigns = true
	qb.dollarSignCount = 1
}
