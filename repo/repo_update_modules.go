package repo

import (
	"errors"
	"r3/tools"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func getModules(token string, url string, repoModuleMap map[uuid.UUID]types.RepoModule) error {

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
			types.DataGetExpression{ // module name
				AttributeId:   tools.PgxUuidFromStringOrNil("fbab278a-4898-4f46-a1d7-35d1a80ee3dc"),
				AttributeIdNm: pgtype.UUID{},
				Aggregator:    pgtype.Text{},
				Index:         0,
			},
			types.DataGetExpression{ // module is visible in store?
				AttributeId:   tools.PgxUuidFromStringOrNil("0ba7005c-834b-4d2b-a967-d748f91c2bed"),
				AttributeIdNm: pgtype.UUID{},
				Aggregator:    pgtype.Text{},
				Index:         0,
			},
			types.DataGetExpression{ // module change log
				AttributeId:   tools.PgxUuidFromStringOrNil("f36130a9-bfed-42dc-920f-036ffd0d35b0"),
				AttributeIdNm: pgtype.UUID{},
				Aggregator:    pgtype.Text{},
				Index:         0,
			},
			types.DataGetExpression{ // author name
				AttributeId:   tools.PgxUuidFromStringOrNil("295f5bd9-772a-41f0-aa81-530a0678e441"),
				AttributeIdNm: pgtype.UUID{},
				Aggregator:    pgtype.Text{},
				Index:         1,
			},
		},
		IndexSource: 0,
		Joins: []types.DataGetJoin{
			types.DataGetJoin{ // author via module author
				AttributeId: uuid.FromStringOrNil("a72f2de6-e1ee-4432-804b-b57f44013f4c"),
				Index:       1,
				IndexFrom:   0,
				Connector:   "INNER",
			},
		},
	}

	var res struct {
		Count int                   `json:"count"`
		Rows  []types.DataGetResult `json:"rows"`
	}
	if err := post(token, url, req, &res); err != nil {
		return err
	}

	for _, row := range res.Rows {
		if len(row.Values) != 5 {
			return errors.New("invalid value count for store module")
		}

		repo := types.RepoModule{}

		for i, value := range row.Values {
			switch i {
			case 0:
				repo.ModuleId = uuid.FromStringOrNil(value.(string))
			case 1:
				repo.Name = value.(string)
			case 2:
				repo.InStore = value.(bool)
			case 3:
				repo.ChangeLog = pgtype.Text{}
				if value != nil {
					repo.ChangeLog = pgtype.Text{
						String: value.(string),
						Valid:  true,
					}
				}
			case 4:
				repo.Author = value.(string)
			}
		}
		repo.LanguageCodeMeta = make(map[string]types.RepoModuleMeta)
		repoModuleMap[repo.ModuleId] = repo
	}
	return nil
}
