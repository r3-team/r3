package types

import "github.com/gofrs/uuid"

type CaptionMapsAll struct {
	ArticleIdMap     map[uuid.UUID]CaptionMap `json:"articleIdMap"`
	AttributeIdMap   map[uuid.UUID]CaptionMap `json:"attributeIdMap"`
	ClientEventIdMap map[uuid.UUID]CaptionMap `json:"clientEventIdMap"`
	ColumnIdMap      map[uuid.UUID]CaptionMap `json:"columnIdMap"`
	FieldIdMap       map[uuid.UUID]CaptionMap `json:"fieldIdMap"`
	FormIdMap        map[uuid.UUID]CaptionMap `json:"formIdMap"`
	FormActionIdMap  map[uuid.UUID]CaptionMap `json:"formActionIdMap"`
	JsFunctionIdMap  map[uuid.UUID]CaptionMap `json:"jsFunctionIdMap"`
	LoginFormIdMap   map[uuid.UUID]CaptionMap `json:"loginFormIdMap"`
	MenuIdMap        map[uuid.UUID]CaptionMap `json:"menuIdMap"`
	MenuTabIdMap     map[uuid.UUID]CaptionMap `json:"menuTabIdMap"`
	ModuleIdMap      map[uuid.UUID]CaptionMap `json:"moduleIdMap"`
	PgFunctionIdMap  map[uuid.UUID]CaptionMap `json:"pgFunctionIdMap"`
	QueryChoiceIdMap map[uuid.UUID]CaptionMap `json:"queryChoiceIdMap"`
	RoleIdMap        map[uuid.UUID]CaptionMap `json:"roleIdMap"`
	TabIdMap         map[uuid.UUID]CaptionMap `json:"tabIdMap"`
	WidgetIdMap      map[uuid.UUID]CaptionMap `json:"widgetIdMap"`
}
