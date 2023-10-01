package repo

import (
	"errors"
	"r3/tools"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func getModuleMetas(token string, url string, skipVerify bool,
	repoModuleMap map[uuid.UUID]types.RepoModule) error {

	var req struct {
		Token   string        `json:"token"`
		Action  string        `json:"action"`
		Request types.DataGet `json:"request"`
	}
	req.Token = token
	req.Action = "get"

	req.Request = types.DataGet{
		RelationId: uuid.FromStringOrNil("08dfb28b-dbb4-4b70-8231-142235516385"), // module
		Expressions: []types.DataGetExpression{
			types.DataGetExpression{ // module UUID
				AttributeId:   tools.PgxUuidFromStringOrNil("98bc635b-097e-4cf0-92c9-2bb97a7c2a5e"),
				AttributeIdNm: pgtype.UUID{},
				Aggregator:    pgtype.Text{},
				Index:         0,
			},
			types.DataGetExpression{ // module meta description
				AttributeId:   tools.PgxUuidFromStringOrNil("3cd8b8b1-3d3f-41b0-ba6c-d7ef567a686f"),
				AttributeIdNm: pgtype.UUID{},
				Aggregator:    pgtype.Text{},
				Index:         1,
			},
			types.DataGetExpression{ // module meta support page
				AttributeId:   tools.PgxUuidFromStringOrNil("4793cd87-0bc9-4797-9538-ca733007a1d1"),
				AttributeIdNm: pgtype.UUID{},
				Aggregator:    pgtype.Text{},
				Index:         1,
			},
			types.DataGetExpression{ // module meta title
				AttributeId:   tools.PgxUuidFromStringOrNil("6f66272a-7713-45a8-9565-b0157939399b"),
				AttributeIdNm: pgtype.UUID{},
				Aggregator:    pgtype.Text{},
				Index:         1,
			},
			types.DataGetExpression{ // language code
				AttributeId:   tools.PgxUuidFromStringOrNil("19bd7a3b-9b3d-45da-9c07-4d8f62874b35"),
				AttributeIdNm: pgtype.UUID{},
				Aggregator:    pgtype.Text{},
				Index:         2,
			},
		},
		IndexSource: 0,
		Joins: []types.DataGetJoin{
			types.DataGetJoin{ // module translation meta via module
				AttributeId: uuid.FromStringOrNil("1091d013-988c-442b-beff-c853e8df20a8"),
				Index:       1,
				IndexFrom:   0,
				Connector:   "INNER",
			},
			types.DataGetJoin{ // language via module translation meta language
				AttributeId: uuid.FromStringOrNil("8aa84747-8224-4f8d-baf1-2d87df374fe6"),
				Index:       2,
				IndexFrom:   1,
				Connector:   "INNER",
			},
		},
	}

	var res struct {
		Count int                   `json:"count"`
		Rows  []types.DataGetResult `json:"rows"`
	}
	if err := post(url, req, &res, skipVerify); err != nil {
		return err
	}

	for _, row := range res.Rows {
		if len(row.Values) != 5 {
			return errors.New("invalid value count for store module release")
		}

		languageCode := ""
		moduleId := uuid.UUID{}
		meta := types.RepoModuleMeta{}

		for i, value := range row.Values {
			switch i {
			case 0:
				moduleId = uuid.FromStringOrNil(value.(string))

				if _, exists := repoModuleMap[moduleId]; !exists {
					return errors.New("meta for non-existing module")
				}
			case 1:
				meta.Description = value.(string)
			case 2:
				meta.SupportPage = value.(string)
			case 3:
				meta.Title = value.(string)
			case 4:
				languageCode = value.(string)
			}
		}
		repoModuleMap[moduleId].LanguageCodeMeta[languageCode] = meta
	}
	return nil
}
