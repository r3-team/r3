package query

import (
	"context"
	"errors"
	"fmt"
	"r3/log"
	"r3/schema/caption"
	"r3/types"
	"r3/types/constants"
	"slices"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func Get_tx(ctx context.Context, tx pgx.Tx, entity types.DbSchemaApp, id uuid.UUID, filterIndex int, filterPosition int, filterSide int) (types.Query, error) {

	var q types.Query
	q.Joins = make([]types.QueryJoin, 0)
	q.Filters = make([]types.QueryFilter, 0)
	q.Orders = make([]types.QueryOrder, 0)
	q.Lookups = make([]types.QueryLookup, 0)
	q.Choices = make([]types.QueryChoice, 0)

	if !slices.Contains(constants.DbAssignedQuery, entity) {
		return q, fmt.Errorf("unknown query parent entity '%s'", entity)
	}

	// sub query (via query filter) requires composite key
	filterClause := ""
	if entity == "query_filter_query" {
		filterClause = fmt.Sprintf(`
			AND query_filter_index    = %d
			AND query_filter_position = %d
			AND query_filter_side     = %d
		`, filterIndex, filterPosition, filterSide)
	}

	err := tx.QueryRow(ctx, fmt.Sprintf(`
		SELECT id, relation_id, fixed_limit
		FROM app.query
		WHERE %s_id = $1
		%s
	`, entity, filterClause), id).Scan(&q.Id, &q.RelationId, &q.FixedLimit)

	if err != nil && err != pgx.ErrNoRows {
		return q, err
	}

	// query does not exist for this entity, return empty query
	if err == pgx.ErrNoRows {
		return q, nil
	}

	// retrieve joins
	rows, err := tx.Query(ctx, `
		SELECT relation_id, attribute_id, index_from, index, connector,
			apply_create, apply_update, apply_delete
		FROM app.query_join
		WHERE query_id = $1
		ORDER BY position ASC
	`, q.Id)
	if err != nil {
		return q, err
	}
	defer rows.Close()

	for rows.Next() {
		var j types.QueryJoin
		if err := rows.Scan(&j.RelationId, &j.AttributeId, &j.IndexFrom, &j.Index,
			&j.Connector, &j.ApplyCreate, &j.ApplyUpdate, &j.ApplyDelete); err != nil {

			return q, err
		}
		q.Joins = append(q.Joins, j)
	}
	rows.Close()

	// retrieve filters
	q.Filters, err = getFilters_tx(ctx, tx, q.Id, pgtype.UUID{})
	if err != nil {
		return q, err
	}

	// retrieve order criteria
	rows, err = tx.Query(ctx, `
		SELECT attribute_id, index, ascending
		FROM app.query_order
		WHERE query_id = $1
		ORDER BY position ASC
	`, q.Id)
	if err != nil {
		return q, err
	}
	defer rows.Close()

	for rows.Next() {
		var o types.QueryOrder
		if err := rows.Scan(&o.AttributeId, &o.Index, &o.Ascending); err != nil {
			return q, err
		}
		q.Orders = append(q.Orders, o)
	}
	rows.Close()

	// retrieve lookups
	rows, err = tx.Query(ctx, `
		SELECT pg_index_id, index
		FROM app.query_lookup
		WHERE query_id = $1
		ORDER BY index ASC
	`, q.Id)
	if err != nil {
		return q, err
	}
	defer rows.Close()

	for rows.Next() {
		var l types.QueryLookup
		if err := rows.Scan(&l.PgIndexId, &l.Index); err != nil {
			return q, err
		}
		q.Lookups = append(q.Lookups, l)
	}
	rows.Close()

	// retrieve choices
	rows, err = tx.Query(ctx, `
		SELECT id, name
		FROM app.query_choice
		WHERE query_id = $1
		ORDER BY position ASC
	`, q.Id)
	if err != nil {
		return q, err
	}
	defer rows.Close()

	for rows.Next() {
		var c types.QueryChoice
		if err := rows.Scan(&c.Id, &c.Name); err != nil {
			return q, err
		}
		q.Choices = append(q.Choices, c)
	}
	rows.Close()

	for i, c := range q.Choices {
		c.Filters, err = getFilters_tx(ctx, tx, q.Id, pgtype.UUID{Bytes: c.Id, Valid: true})
		if err != nil {
			return q, err
		}
		c.Captions, err = caption.Get_tx(ctx, tx, "query_choice", c.Id, []string{"queryChoiceTitle"})
		if err != nil {
			return q, err
		}
		q.Choices[i] = c
	}
	return q, nil
}

func Set_bt(bt *pgx.Batch, entity types.DbSchemaApp, entityId uuid.UUID, onlyCreate bool,
	filterIndex, filterPosition, filterSide int, query types.Query) {

	if !slices.Contains(constants.DbAssignedQuery, entity) {
		log.Error(log.ContextTransfer, "cannot store query", errors.New(fmt.Sprintf("invalid parent entity '%s'", entity)))
		return
	}

	noBaseRelation := !query.RelationId.Valid
	subQuery := entity == "query_filter_query"

	if !onlyCreate {
		// query ID can change, if query was removed and then re-added to parent entity
		// we check for identity always by its assigned parent entity
		if !subQuery {
			bt.Queue(fmt.Sprintf(`
				DELETE FROM app.query
				WHERE %s_id = $1
			`, entity), entityId)
		} else {
			bt.Queue(`
				DELETE FROM app.query
				WHERE query_filter_query_id = $1
				AND   query_filter_index    = $2
				AND   query_filter_position = $3
				AND   query_filter_side     = $4
			`, entityId, filterIndex, filterPosition, filterSide)
		}
	}

	if noBaseRelation {
		// no query needed
		return
	}

	if !subQuery {
		bt.Queue(fmt.Sprintf(`
			INSERT INTO app.query (id, relation_id, fixed_limit, %s_id)
			VALUES ($1,$2,$3,$4)
		`, entity), query.Id, query.RelationId, query.FixedLimit, entityId)
	} else {
		bt.Queue(`
			INSERT INTO app.query (id, relation_id, fixed_limit, query_filter_query_id,
				query_filter_index, query_filter_position, query_filter_side)
			VALUES ($1,$2,$3,$4,$5,$6,$7)
		`, query.Id, query.RelationId, query.FixedLimit, entityId, filterIndex, filterPosition, filterSide)
	}

	// joins
	for position, j := range query.Joins {
		if !slices.Contains(constants.QueryJoinConnectors, j.Connector) {
			log.Error(log.ContextTransfer, "cannot store query join", errors.New(fmt.Sprintf("invalid connector '%s'", j.Connector)))
			return
		}
		bt.Queue(`
			INSERT INTO app.query_join (
				query_id, relation_id, attribute_id, position, index_from,
				index, connector, apply_create, apply_update, apply_delete
			)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		`, query.Id, j.RelationId, j.AttributeId, position, j.IndexFrom,
			j.Index, j.Connector, j.ApplyCreate, j.ApplyUpdate,
			j.ApplyDelete)
	}

	// filters
	setFilters_bt(bt, query.Id, pgtype.UUID{}, onlyCreate, query.Filters, 0)

	// ordering
	for position, o := range query.Orders {
		bt.Queue(`
			INSERT INTO app.query_order (query_id, attribute_id, position, index, ascending)
			VALUES ($1,$2,$3,$4,$5)
		`, query.Id, o.AttributeId, position, o.Index, o.Ascending)
	}

	// lookups
	for _, l := range query.Lookups {
		bt.Queue(`
			INSERT INTO app.query_lookup (query_id, pg_index_id, index)
			VALUES ($1,$2,$3)
		`, query.Id, l.PgIndexId, l.Index)
	}

	// choices
	for position, c := range query.Choices {

		bt.Queue(`
			INSERT INTO app.query_choice (id, query_id, name, position)
			VALUES ($1,$2,$3,$4)
		`, c.Id, query.Id, c.Name, position)

		// set choice filters
		// use position offset to separate filters from optional choice filters
		//  (necessary as query ID + position is used as PK
		positionOffset := (position + 1) * 100

		setFilters_bt(bt, query.Id, pgtype.UUID{Bytes: c.Id, Valid: true}, onlyCreate, c.Filters, positionOffset)
		caption.Set_bt(bt, c.Id, onlyCreate, c.Captions)
	}
}

func getFilters_tx(ctx context.Context, tx pgx.Tx, queryId uuid.UUID, queryChoiceId pgtype.UUID) ([]types.QueryFilter, error) {

	params := make([]any, 0)
	params = append(params, queryId)

	nullCheck := "AND query_choice_id IS NULL"
	if queryChoiceId.Valid {
		nullCheck = "AND query_choice_id = $2"
		params = append(params, queryChoiceId.Bytes)
	}

	// get filters
	type typeFilterPos struct {
		filter   types.QueryFilter
		position int
	}
	filterPos := make([]typeFilterPos, 0)

	rows, err := tx.Query(ctx, fmt.Sprintf(`
		SELECT connector, operator, index, position
		FROM app.query_filter
		WHERE query_id = $1
		%s
		ORDER BY position ASC
	`, nullCheck), params...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var fp typeFilterPos
		if err := rows.Scan(&fp.filter.Connector, &fp.filter.Operator, &fp.filter.Index, &fp.position); err != nil {
			return nil, err
		}
		filterPos = append(filterPos, fp)
	}
	rows.Close()

	var filters = make([]types.QueryFilter, 0)
	for _, fp := range filterPos {
		fp.filter.Side0, err = getFilterSide_tx(ctx, tx, queryId, fp.filter.Index, fp.position, 0)
		if err != nil {
			return nil, err
		}
		fp.filter.Side1, err = getFilterSide_tx(ctx, tx, queryId, fp.filter.Index, fp.position, 1)
		if err != nil {
			return nil, err
		}
		filters = append(filters, fp.filter)
	}
	return filters, nil
}
func getFilterSide_tx(ctx context.Context, tx pgx.Tx, queryId uuid.UUID, filterIndex int, filterPosition int, side int) (types.QueryFilterSide, error) {
	var s types.QueryFilterSide
	var err error

	if err := tx.QueryRow(ctx, `
		SELECT attribute_id, attribute_index, attribute_nested, brackets,
			collection_id, column_id, content, field_id, now_offset, preset_id,
			role_id, variable_id, query_aggregator, value
		FROM app.query_filter_side
		WHERE query_id              = $1
		AND   query_filter_index    = $2
		AND   query_filter_position = $3
		AND   side                  = $4
	`, queryId, filterIndex, filterPosition, side).Scan(&s.AttributeId, &s.AttributeIndex,
		&s.AttributeNested, &s.Brackets, &s.CollectionId, &s.ColumnId, &s.Content,
		&s.FieldId, &s.NowOffset, &s.PresetId, &s.RoleId, &s.VariableId,
		&s.QueryAggregator, &s.Value); err != nil {

		return s, err
	}

	if s.Content == "subQuery" {
		s.Query, err = Get_tx(ctx, tx, "query_filter_query", queryId, filterIndex, filterPosition, side)
		if err != nil {
			return s, err
		}
	} else {
		s.Query.RelationId = pgtype.UUID{}
	}
	return s, nil
}

func setFilters_bt(bt *pgx.Batch, queryId uuid.UUID, queryChoiceId pgtype.UUID, onlyCreate bool, filters []types.QueryFilter, positionOffset int) {
	for position, f := range filters {
		if !slices.Contains(constants.QueryFilterConnectors, f.Connector) {
			log.Error(log.ContextTransfer, "cannot store filter", errors.New(fmt.Sprintf("invalid connector '%s'", f.Connector)))
			return
		}
		if !slices.Contains(constants.QueryFilterOperators, f.Operator) {
			log.Error(log.ContextTransfer, "cannot store filter", errors.New(fmt.Sprintf("invalid operator '%s'", f.Operator)))
			return
		}
		position += positionOffset

		bt.Queue(`
			INSERT INTO app.query_filter (query_id, query_choice_id,index, position, connector, operator)
			VALUES ($1,$2,$3,$4,$5,$6)
		`, queryId, queryChoiceId, f.Index, position, f.Connector, f.Operator)

		setFilterSide_bt(bt, queryId, onlyCreate, f.Index, position, 0, f.Side0)
		setFilterSide_bt(bt, queryId, onlyCreate, f.Index, position, 1, f.Side1)
	}
}
func setFilterSide_bt(bt *pgx.Batch, queryId uuid.UUID, onlyCreate bool, filterIndex int, filterPosition int, side int, s types.QueryFilterSide) {

	bt.Queue(`
		INSERT INTO app.query_filter_side (
			query_id, query_filter_index, query_filter_position, side, attribute_id,
			attribute_index, attribute_nested, brackets, collection_id, column_id,
			content, field_id, now_offset, preset_id, role_id, variable_id,
			query_aggregator, value
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
	`, queryId, filterIndex, filterPosition, side, s.AttributeId, s.AttributeIndex,
		s.AttributeNested, s.Brackets, s.CollectionId, s.ColumnId, s.Content,
		s.FieldId, s.NowOffset, s.PresetId, s.RoleId, s.VariableId,
		s.QueryAggregator, s.Value)

	if s.Content == "subQuery" {
		Set_bt(bt, constants.DbQueryFilterQuery, queryId, onlyCreate, filterIndex, filterPosition, side, s.Query)
	}
}
