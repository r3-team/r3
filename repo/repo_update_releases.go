package repo

import (
	"encoding/json"
	"errors"
	"fmt"
	"r3/tools"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgtype"
)

func getModuleReleases(token string, url string, skipVerify bool,
	repoModuleMap map[uuid.UUID]types.RepoModule, lastRun uint64) error {

	var err error
	var req struct {
		Token   string        `json:"token"`
		Action  string        `json:"action"`
		Request types.DataGet `json:"request"`
	}
	req.Token = token
	req.Action = "get"

	req.Request = types.DataGet{
		RelationId: uuid.FromStringOrNil("a300afae-a8c5-4cfc-9375-d85f45c6347c"), // module release
		Expressions: []types.DataGetExpression{
			types.DataGetExpression{ // module UUID
				AttributeId:   tools.UuidStringToNullUuid("98bc635b-097e-4cf0-92c9-2bb97a7c2a5e"),
				AttributeIdNm: pgtype.UUID{Status: pgtype.Null},
				Aggregator:    pgtype.Varchar{Status: pgtype.Null},
				Index:         1,
			},
			types.DataGetExpression{ // module release build
				AttributeId:   tools.UuidStringToNullUuid("d0766fcc-7a68-490c-9c81-f542ad37109b"),
				AttributeIdNm: pgtype.UUID{Status: pgtype.Null},
				Aggregator:    pgtype.Varchar{Status: pgtype.Null},
				Index:         0,
			},
			types.DataGetExpression{ // module release application build
				AttributeId:   tools.UuidStringToNullUuid("ce998cfd-a66f-423c-b82b-d2b48a21c288"),
				AttributeIdNm: pgtype.UUID{Status: pgtype.Null},
				Aggregator:    pgtype.Varchar{Status: pgtype.Null},
				Index:         0,
			},
			types.DataGetExpression{ // module release date
				AttributeId:   tools.UuidStringToNullUuid("9f9b6cda-069d-405b-bbb8-c0d12bbce910"),
				AttributeIdNm: pgtype.UUID{Status: pgtype.Null},
				Aggregator:    pgtype.Varchar{Status: pgtype.Null},
				Index:         0,
			},
			types.DataGetExpression{ // module release file
				AttributeId:   tools.UuidStringToNullUuid("b28e8f5c-ebeb-4565-941b-4d942eedc588"),
				AttributeIdNm: pgtype.UUID{Status: pgtype.Null},
				Aggregator:    pgtype.Varchar{Status: pgtype.Null},
				Index:         0,
			},
		},
		IndexSource: 0,
		Joins: []types.DataGetJoin{
			types.DataGetJoin{ // module
				AttributeId: uuid.FromStringOrNil("922dc949-873f-4a21-9699-8740c0491b3a"),
				Index:       1,
				IndexFrom:   0,
				Connector:   "INNER",
			},
		},
		Filters: []types.DataGetFilter{
			types.DataGetFilter{
				Connector: "AND",
				Operator:  ">",
				Side0: types.DataGetFilterSide{
					AttributeId: pgtype.UUID{ // module release date
						Bytes:  uuid.FromStringOrNil("9f9b6cda-069d-405b-bbb8-c0d12bbce910"),
						Status: pgtype.Present,
					},
					QueryAggregator: pgtype.Varchar{Status: pgtype.Null},
				},
				Side1: types.DataGetFilterSide{
					AttributeId:     pgtype.UUID{Status: pgtype.Null},
					QueryAggregator: pgtype.Varchar{Status: pgtype.Null},
					Value:           lastRun,
				},
			},
		},
		Orders: []types.DataGetOrder{
			types.DataGetOrder{
				AttributeId: pgtype.UUID{ // module release build
					Bytes:  uuid.FromStringOrNil("d0766fcc-7a68-490c-9c81-f542ad37109b"),
					Status: pgtype.Present,
				},
				Index: pgtype.Int4{
					Int:    0,
					Status: pgtype.Present,
				},
				ExpressionPos: pgtype.Int4{Status: pgtype.Null},
				Ascending:     false,
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

	moduleIdsAdded := make([]uuid.UUID, 0)

	for _, row := range res.Rows {
		if len(row.Values) != 5 {
			return errors.New("invalid value count for store module release")
		}

		repoModule := types.RepoModule{}

		for i, value := range row.Values {
			switch i {
			case 0:
				moduleId := uuid.FromStringOrNil(value.(string))

				// add only first release per module (are sorted descending by build)
				if tools.UuidInSlice(moduleId, moduleIdsAdded) {
					break
				}

				if _, exists := repoModuleMap[moduleId]; !exists {
					return errors.New("release for non-existing module")
				}
				repoModule = repoModuleMap[moduleId]
			case 1:
				repoModule.ReleaseBuild = int(value.(float64))
			case 2:
				repoModule.ReleaseBuildApp = int(value.(float64))
			case 3:
				repoModule.ReleaseDate = int(value.(float64))
			case 4:
				var filesJson []byte

				switch v := value.(type) {
				case string: // 2.3 and older (before pgx), files attributes were encoded as JSON string
					filesJson = []byte(v)

				case map[string]interface{}: // 2.4 and newer
					filesJson, err = json.Marshal(v)
					if err != nil {
						return err
					}

				default:
					return errors.New("invalid value type for files attribute")
				}

				files := types.DataSetFiles{}
				if err := json.Unmarshal(filesJson, &files); err != nil {
					return err
				}

				if len(files.Files) != 1 {
					return fmt.Errorf("module release must have exactly 1 file, count: %d",
						len(files.Files))
				}
				repoModule.FileId = files.Files[0].Id
				moduleIdsAdded = append(moduleIdsAdded, repoModule.ModuleId)
			}
		}

		// only the latest release is used, module ID is not set for subsequent ones
		if repoModule.ModuleId != uuid.Nil {
			repoModuleMap[repoModule.ModuleId] = repoModule
		}
	}
	return nil
}
