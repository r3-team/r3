package repo

import (
	"errors"
	"fmt"
	"r3/cache"
	"r3/config"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func SendFeedback(isAdmin bool, moduleRelated bool, moduleId pgtype.UUID,
	formId pgtype.UUID, mood int, code int, text string) error {

	cache.Schema_mx.RLock()
	defer cache.Schema_mx.RUnlock()

	baseUrl := config.GetString("repoUrl")

	dataAuthUrl := fmt.Sprintf("%s/data/auth", baseUrl)
	dataAccessUrl := fmt.Sprintf("%s/data/access", baseUrl)

	skipVerify := config.GetUint64("repoSkipVerify") == 1

	releaseBuild := 0
	if moduleId.Valid {
		module, exists := cache.ModuleIdMap[moduleId.Bytes]
		if !exists {
			return errors.New("unknown module")
		}
		releaseBuild = module.ReleaseBuild
	}

	// get authentication token
	token, err := getToken(dataAuthUrl, skipVerify)
	if err != nil {
		return err
	}

	// send feedback
	var req struct {
		Token   string                `json:"token"`
		Action  string                `json:"action"`
		Request map[int]types.DataSet `json:"request"`
	}
	req.Token = token
	req.Action = "set"

	req.Request = map[int]types.DataSet{
		0: types.DataSet{
			IndexFrom:   -1,                                                           // original relation
			RecordId:    0,                                                            // new record
			RelationId:  uuid.FromStringOrNil("8664771d-cfee-44d7-bb8b-14ddf555a157"), // feedback
			AttributeId: uuid.Nil,
			Attributes: []types.DataSetAttribute{
				types.DataSetAttribute{
					AttributeId:   uuid.FromStringOrNil("8a4a37e3-9952-4cbc-8c90-2aea780bb977"), // is_admin
					AttributeIdNm: pgtype.UUID{},
					Value:         isAdmin,
				},
				types.DataSetAttribute{
					AttributeId:   uuid.FromStringOrNil("256b6705-33c4-43b7-92cf-12f55190d2e2"), // module_related
					AttributeIdNm: pgtype.UUID{},
					Value:         moduleRelated,
				},
				types.DataSetAttribute{
					AttributeId:   uuid.FromStringOrNil("a668177b-81f1-4cad-bdc8-8ec97b8d5004"), // module_uuid
					AttributeIdNm: pgtype.UUID{},
					Value:         moduleId,
				},
				types.DataSetAttribute{
					AttributeId:   uuid.FromStringOrNil("88c6ceac-cdc7-4a7d-aed7-6e8ca7568b43"), // form_uuid
					AttributeIdNm: pgtype.UUID{},
					Value:         formId,
				},
				types.DataSetAttribute{
					AttributeId:   uuid.FromStringOrNil("7d8fa36e-c4d7-4b79-96d6-8271e17be586"), // mood
					AttributeIdNm: pgtype.UUID{},
					Value:         mood,
				},
				types.DataSetAttribute{
					AttributeId:   uuid.FromStringOrNil("e8a6badc-a423-433e-980f-991c2a4d9399"), // code
					AttributeIdNm: pgtype.UUID{},
					Value:         code,
				},
				types.DataSetAttribute{
					AttributeId:   uuid.FromStringOrNil("01490477-18c1-4aa2-85f1-ef90f173d22f"), // release_build
					AttributeIdNm: pgtype.UUID{},
					Value:         releaseBuild,
				},
				types.DataSetAttribute{
					AttributeId:   uuid.FromStringOrNil("e5e0fe54-38c7-4c00-8c48-2bdca0febc2b"), // release_build_app
					AttributeIdNm: pgtype.UUID{},
					Value:         config.GetAppVersion().Build,
				},
				types.DataSetAttribute{
					AttributeId:   uuid.FromStringOrNil("22e93eba-bbc1-4a63-9f36-deca6b74e78d"), // text
					AttributeIdNm: pgtype.UUID{},
					Value:         text,
				},
				types.DataSetAttribute{
					AttributeId:   uuid.FromStringOrNil("4639719a-52dc-4809-97dd-9b5c142f7203"), // instance_uuid
					AttributeIdNm: pgtype.UUID{},
					Value:         config.GetString("instanceId"),
				},
			},
		},
	}

	var res types.DataSetResult
	return post(dataAccessUrl, req, &res, skipVerify)
}
