package schema

import (
	"errors"
	"r3/types"

	"github.com/gofrs/uuid"
)

// replace given UUID with a new one while storing the state change in a given map (oldstate -> newstate)
func ReplaceUuid(id uuid.UUID, idMapReplaced map[uuid.UUID]uuid.UUID) (uuid.UUID, error) {
	newId, err := uuid.NewV4()
	if err != nil {
		return uuid.Nil, err
	}
	idMapReplaced[id] = newId
	return newId, nil
}

// entity duplication
func ReplaceColumnIds(columns []types.Column, idMapReplaced map[uuid.UUID]uuid.UUID) ([]types.Column, error) {
	var err error
	for i, _ := range columns {
		columns[i].Id, err = ReplaceUuid(columns[i].Id, idMapReplaced)
		if err != nil {
			return columns, err
		}

		if columns[i].SubQuery {
			columns[i].Query, err = ReplaceQueryIds(columns[i].Query, idMapReplaced)
			if err != nil {
				return columns, err
			}
		}
	}
	return columns, nil
}

func replaceQueryFilterIds(filterIn types.QueryFilter, idMapReplaced map[uuid.UUID]uuid.UUID) (types.QueryFilter, error) {
	var err error

	// replace IDs in sub query
	if filterIn.Side0.Content == "subQuery" {
		filterIn.Side0.Query, err = ReplaceQueryIds(filterIn.Side0.Query, idMapReplaced)
		if err != nil {
			return filterIn, err
		}
	}
	if filterIn.Side1.Content == "subQuery" {
		filterIn.Side1.Query, err = ReplaceQueryIds(filterIn.Side1.Query, idMapReplaced)
		if err != nil {
			return filterIn, err
		}
	}

	// assign newly created field IDs to existing field filters
	if filterIn.Side0.FieldId.Valid {
		if _, exists := idMapReplaced[filterIn.Side0.FieldId.Bytes]; !exists {
			return filterIn, errors.New("unknown field filter ID")
		}
		filterIn.Side0.FieldId.Bytes = idMapReplaced[filterIn.Side0.FieldId.Bytes]
	}
	if filterIn.Side1.FieldId.Valid {
		if _, exists := idMapReplaced[filterIn.Side1.FieldId.Bytes]; !exists {
			return filterIn, errors.New("unknown field filter ID")
		}
		filterIn.Side1.FieldId.Bytes = idMapReplaced[filterIn.Side1.FieldId.Bytes]
	}
	return filterIn, nil
}

func ReplaceQueryIds(queryIn types.Query, idMapReplaced map[uuid.UUID]uuid.UUID) (types.Query, error) {
	var err error

	queryIn.Id, err = ReplaceUuid(queryIn.Id, idMapReplaced)
	if err != nil {
		return queryIn, err
	}

	// replace IDs in filters
	for i, _ := range queryIn.Filters {
		queryIn.Filters[i], err = replaceQueryFilterIds(queryIn.Filters[i], idMapReplaced)
		if err != nil {
			return queryIn, err
		}
	}

	// replace IDs in choices
	for i, _ := range queryIn.Choices {
		queryIn.Choices[i].Id, err = ReplaceUuid(queryIn.Choices[i].Id, idMapReplaced)
		if err != nil {
			return queryIn, err
		}

		for x, _ := range queryIn.Choices[i].Filters {
			queryIn.Choices[i].Filters[x], err = replaceQueryFilterIds(
				queryIn.Choices[i].Filters[x], idMapReplaced)

			if err != nil {
				return queryIn, err
			}
		}
	}
	return queryIn, nil
}
