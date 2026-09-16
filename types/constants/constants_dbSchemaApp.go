package constants

import "r3/types"

const (
	// tables, columns in app schema
	DbApi                   types.DbSchemaApp = "api"
	DbArticle               types.DbSchemaApp = "article"
	DbAttribute             types.DbSchemaApp = "attribute"
	DbClientEvent           types.DbSchemaApp = "client_event"
	DbCollection            types.DbSchemaApp = "collection"
	DbCollectionConsumer    types.DbSchemaApp = "collection_consumer"
	DbColumn                types.DbSchemaApp = "column"
	DbDoc                   types.DbSchemaApp = "doc"
	DbDocColumn             types.DbSchemaApp = "doc_column"
	DbDocContextBody        types.DbSchemaApp = "body"
	DbDocContextDefault     types.DbSchemaApp = "default"
	DbDocContextFooter      types.DbSchemaApp = "footer"
	DbDocContextHeader      types.DbSchemaApp = "header"
	DbDocField              types.DbSchemaApp = "doc_field"
	DbDocPage               types.DbSchemaApp = "doc_page"
	DbDocState              types.DbSchemaApp = "doc_state"
	DbField                 types.DbSchemaApp = "field"
	DbFieldButton           types.DbSchemaApp = "field_button"
	DbFieldCalendar         types.DbSchemaApp = "field_calendar"
	DbFieldChart            types.DbSchemaApp = "field_chart"
	DbFieldContainer        types.DbSchemaApp = "field_container"
	DbFieldData             types.DbSchemaApp = "field_data"
	DbFieldDataRelationship types.DbSchemaApp = "field_data_relationship"
	DbFieldHeader           types.DbSchemaApp = "field_header"
	DbFieldKanban           types.DbSchemaApp = "field_kanban"
	DbFieldList             types.DbSchemaApp = "field_list"
	DbFieldMapLayerData     types.DbSchemaApp = "field_map_layer_data"
	DbFieldVariable         types.DbSchemaApp = "field_variable"
	DbForm                  types.DbSchemaApp = "form"
	DbFormAction            types.DbSchemaApp = "form_action"
	DbFormState             types.DbSchemaApp = "form_state"
	DbIcon                  types.DbSchemaApp = "icon"
	DbJsFunction            types.DbSchemaApp = "js_function"
	DbLoginForm             types.DbSchemaApp = "login_form"
	DbMenu                  types.DbSchemaApp = "menu"
	DbMenuTab               types.DbSchemaApp = "menu_tab"
	DbModule                types.DbSchemaApp = "module"
	DbPgFunction            types.DbSchemaApp = "pg_function"
	DbPgFunctionSchedule    types.DbSchemaApp = "pg_function_schedule"
	DbPgIndex               types.DbSchemaApp = "pg_index"
	DbPgTrigger             types.DbSchemaApp = "pg_trigger"
	DbPreset                types.DbSchemaApp = "preset"
	DbQueryChoice           types.DbSchemaApp = "query_choice"
	DbQueryFilterQuery      types.DbSchemaApp = "query_filter_query"
	DbRelation              types.DbSchemaApp = "relation"
	DbRole                  types.DbSchemaApp = "role"
	DbSearchBar             types.DbSchemaApp = "search_bar"
	DbTab                   types.DbSchemaApp = "tab"
	DbTag                   types.DbSchemaApp = "tag"
	DbVariable              types.DbSchemaApp = "variable"
	DbWidget                types.DbSchemaApp = "widget"

	// ENUM types in app schema
	DbColumnContentAttribute types.DbSchemaAppColumnContent = "attribute"
	DbColumnContentFncPg     types.DbSchemaAppColumnContent = "fnc_pg"
	DbColumnContentFncScalar types.DbSchemaAppColumnContent = "fnc_scalar"
	DbColumnContentQuery     types.DbSchemaAppColumnContent = "query"
)

var (
	// elements assigned to DB entities
	DbAssignedCollectionConsumers = []types.DbSchemaApp{
		DbCollection,
		DbField,
		DbMenu,
		DbWidget,
	}
	DbAssignedColumn = []types.DbSchemaApp{
		DbApi,
		DbCollection,
		DbField,
		DbSearchBar,
	}
	DbAssignedDocSet = []types.DbSchemaApp{
		DbDoc,
		DbDocColumn,
		DbDocField,
		DbDocPage,
	}
	DbAssignedOpenDoc = []types.DbSchemaApp{
		DbFormAction,
		DbField,
	}
	DbAssignedOpenForm = []types.DbSchemaApp{
		DbColumn,
		DbCollectionConsumer,
		DbField,
		DbFieldMapLayerData,
		DbFormAction,
		DbSearchBar,
	}
	DbAssignedQuery = []types.DbSchemaApp{
		DbApi,
		DbCollection,
		DbColumn,
		DbDoc,
		DbDocColumn,
		DbDocField,
		DbField,
		DbFieldMapLayerData,
		DbForm,
		DbQueryFilterQuery,
		DbSearchBar,
	}
	DbAssignedTab = []types.DbSchemaApp{
		DbField,
	}
	DbAssignedTag = []types.DbSchemaApp{
		DbDoc,
		DbForm,
		DbJsFunction,
		DbPgFunction,
		DbRelation,
	}

	// elements optionally bound to DB entities
	DbBoundForm = []types.DbSchemaApp{
		DbJsFunction,
		DbVariable,
	}

	// elements with dependencies to DB entities
	DbDependsJsFunction = []types.DbSchemaApp{
		DbCollection,
		DbField,
		DbForm,
		DbJsFunction,
		DbPgFunction,
		DbRole,
		DbVariable,
	}
	DbDependsPgFunction = []types.DbSchemaApp{
		DbAttribute,
		DbModule,
		DbPgFunction,
		DbRelation,
	}

	// elements valid as document context
	DbDocContextsValid = []types.DbSchemaApp{
		DbDocContextBody,
		DbDocContextDefault,
		DbDocContextFooter,
		DbDocContextHeader,
	}

	// element transfer delete check
	DbTransferDeleteField = []types.DbSchemaApp{
		DbColumn,
		DbTab,
	}
	DbTransferDeleteForm = []types.DbSchemaApp{
		DbField,
	}
	DbTransferDeleteModule = []types.DbSchemaApp{
		DbApi,
		DbArticle,
		DbClientEvent,
		DbCollection,
		DbDoc,
		DbForm,
		DbIcon,
		DbJsFunction,
		DbLoginForm,
		DbMenu,
		DbMenuTab,
		DbPgFunction,
		DbPgTrigger,
		DbRelation,
		DbRole,
		DbSearchBar,
		DbTag,
		DbVariable,
		DbWidget,
	}
	DbTransferDeleteRelation = []types.DbSchemaApp{
		DbAttribute,
		DbPgIndex,
		DbPreset,
	}
)
