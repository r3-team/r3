package request

import (
	"context"
	"encoding/json"
	"fmt"
	"r3/data"
	"r3/data/data_enc"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func DataGet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage, loginId int64) (any, error) {

	var (
		err   error
		query string
		req   types.DataGet
		res   struct {
			Count int64                 `json:"count"`
			Rows  []types.DataGetResult `json:"rows"`
		}
	)

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	res.Rows, res.Count, err = data.Get_tx(ctx, tx, req, loginId, &query)
	if err != nil {
		if query != "" {
			return nil, fmt.Errorf("%s, SQL: %s", err, query)
		} else {
			return nil, fmt.Errorf("%s", err)
		}
	}
	return res, nil
}

func DataSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage, loginId int64) (any, error) {

	var (
		err error
		req map[int]types.DataSet
		res types.DataSetResult
	)

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	res.IndexRecordIds, err = data.Set_tx(ctx, tx, req, loginId)
	if err != nil {
		return nil, err
	}
	return res, nil
}

func DataDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage, loginId int64) (any, error) {

	var req struct {
		RelationId uuid.UUID `json:"relationId"`
		RecordId   int64     `json:"recordId"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, data.Del_tx(ctx, tx, req.RelationId, req.RecordId, loginId)
}

func DataLogGet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage, loginId int64) (any, error) {

	var req struct {
		RelationId   uuid.UUID   `json:"relationId"`
		AttributeIds []uuid.UUID `json:"attributeIds"`
		RecordIds    []int64     `json:"recordIds"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return data.GetLogs_tx(ctx, tx, req.RelationId, req.AttributeIds, req.RecordIds, loginId)
}

func DataSqlGet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage, loginId int64) (any, error) {

	var req types.DataGet
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	var query string
	if _, _, err := data.Get_tx(ctx, tx, req, loginId, &query); err != nil {
		return nil, err
	}
	return query, nil
}

func DataGetKeys_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage, loginId int64) (any, error) {

	var req struct {
		RelationId uuid.UUID `json:"relationId"`
		RecordIds  []int64   `json:"recordIds"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return data_enc.GetKeys_tx(ctx, tx, req.RelationId, req.RecordIds, loginId)
}
func DataSetKeys_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {

	var req struct {
		RelationId uuid.UUID              `json:"relationId"`
		RecordId   int64                  `json:"recordId"`
		EncKeys    []types.DataSetEncKeys `json:"encKeys"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, data_enc.SetKeys_tx(ctx, tx, req.RelationId, req.RecordId, req.EncKeys)
}

func DataGetRecordTitles_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage, loginId int64) (any, error) {
	var relationIdMapRecordIds map[uuid.UUID][]int64
	if err := json.Unmarshal(reqJson, &relationIdMapRecordIds); err != nil {
		return nil, err
	}
	return data.GetRecordTitles_tx(ctx, tx, relationIdMapRecordIds, loginId)
}
