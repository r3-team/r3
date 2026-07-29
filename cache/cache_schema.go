// Application cache
// Used during regular operation for fast lookups.
// Is NOT used while manipulating the schema.
package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"r3/config/config_moduleMeta"
	"r3/handler"
	"r3/log"
	"r3/schema"
	"r3/schema/api"
	"r3/schema/article"
	"r3/schema/attribute"
	"r3/schema/clientEvent"
	"r3/schema/collection"
	"r3/schema/doc"
	"r3/schema/form"
	"r3/schema/icon"
	"r3/schema/jsFunction"
	"r3/schema/loginForm"
	"r3/schema/menuTab"
	"r3/schema/module"
	"r3/schema/pgFunction"
	"r3/schema/pgIndex"
	"r3/schema/pgTrigger"
	"r3/schema/preset"
	"r3/schema/relation"
	"r3/schema/role"
	"r3/schema/searchBar"
	"r3/schema/tag"
	"r3/schema/variable"
	"r3/schema/widget"
	"r3/tools"
	"r3/types"
	"slices"
	"sync"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
	"golang.org/x/exp/maps"
)

var (
	// schema cache access and state
	schema_mx sync.RWMutex

	// schema cache
	moduleIdMapJson = make(map[uuid.UUID]json.RawMessage)  // ID map of module definition as JSON
	moduleIdMapMeta = make(map[uuid.UUID]types.ModuleMeta) // ID map of module meta data

	// cached entities for regular use during normal operation
	moduleIdMap        = make(map[uuid.UUID]types.Module)      // all modules by ID
	moduleApiNameMapId = make(map[string]map[string]uuid.UUID) // all API IDs by module+API name
	relationIdMap      = make(map[uuid.UUID]types.Relation)    // all relations by ID
	attributeIdMap     = make(map[uuid.UUID]types.Attribute)   // all attributes by ID
	roleIdMap          = make(map[uuid.UUID]types.Role)        // all roles by ID
	pgFunctionIdMap    = make(map[uuid.UUID]types.PgFunction)  // all PG functions by ID
	apiIdMap           = make(map[uuid.UUID]types.Api)         // all APIs by ID
	docIdMap           = make(map[uuid.UUID]types.Doc)         // all documents by ID
	clientEventIdMap   = make(map[uuid.UUID]types.ClientEvent) // all client events by ID
)

// returns names of entities to fully reference module in DB (module)
func GetModuleDbName(moduleId uuid.UUID) (string, error) {
	schema_mx.RLock()
	defer schema_mx.RUnlock()

	if _, exists := moduleIdMap[moduleId]; !exists {
		return "", handler.ErrSchemaUnknownModule(moduleId)
	}
	return moduleIdMap[moduleId].Name, nil
}

// returns name of entity to reference relation in DB (relation)
func GetRelationDbName(relationId uuid.UUID) (string, error) {
	schema_mx.RLock()
	defer schema_mx.RUnlock()

	if _, exists := relationIdMap[relationId]; !exists {
		return "", handler.ErrSchemaUnknownRelation(relationId)
	}
	return relationIdMap[relationId].Name, nil
}

// returns names of entities to fully reference relation in DB (module, relation)
func GetRelationDbNames(relationId uuid.UUID) (string, string, error) {
	schema_mx.RLock()
	defer schema_mx.RUnlock()

	rel, exists := relationIdMap[relationId]
	if !exists {
		return "", "", handler.ErrSchemaUnknownRelation(relationId)
	}
	return moduleIdMap[rel.ModuleId].Name, rel.Name, nil
}

// returns name of entities to reference just attribute in DB (attribute)
func GetAttributeDbName(attributeId uuid.UUID) (string, error) {
	schema_mx.RLock()
	defer schema_mx.RUnlock()

	if _, exists := attributeIdMap[attributeId]; !exists {
		return "", handler.ErrSchemaUnknownAttribute(attributeId)
	}
	return attributeIdMap[attributeId].Name, nil
}

// returns names of entities to fully reference attribute in DB (module, relation, attribute)
func GetAttributeDbNames(attributeId uuid.UUID) (string, string, string, error) {
	schema_mx.RLock()
	defer schema_mx.RUnlock()

	atr, exists := attributeIdMap[attributeId]
	if !exists {
		return "", "", "", handler.ErrSchemaUnknownAttribute(attributeId)
	}
	rel := relationIdMap[atr.RelationId]

	return moduleIdMap[rel.ModuleId].Name,
		relationIdMap[atr.RelationId].Name,
		atr.Name,
		nil
}

// returns names of entities to fully reference PG function in DB (module, PG function)
// can enforce frontend call PG functions if desired
// returns error if requested function is a trigger function
func GetPgFunctionDbNames(pgFunctionId uuid.UUID, frontendCall bool) (string, string, error) {
	schema_mx.RLock()
	defer schema_mx.RUnlock()

	fnc, exists := pgFunctionIdMap[pgFunctionId]
	if !exists {
		return "", "", handler.ErrSchemaUnknownPgFunction(pgFunctionId)
	}
	if fnc.IsTrigger {
		return "", "", handler.ErrSchemaTriggerPgFunctionCall(pgFunctionId)
	}
	if frontendCall && !fnc.IsFrontendExec {
		return "", "", handler.ErrSchemaBadFrontendExecPgFunctionCall(pgFunctionId)
	}
	return moduleIdMap[fnc.ModuleId].Name, fnc.Name, nil
}

func GetAttributeIsEncryptedById(attributeId uuid.UUID) (bool, error) {
	schema_mx.RLock()
	defer schema_mx.RUnlock()

	if _, exists := attributeIdMap[attributeId]; !exists {
		return false, handler.ErrSchemaUnknownAttribute(attributeId)
	}
	return attributeIdMap[attributeId].Encrypted, nil
}
func GetAttributeIsFilesById(attributeId uuid.UUID) (bool, error) {
	schema_mx.RLock()
	defer schema_mx.RUnlock()

	if _, exists := attributeIdMap[attributeId]; !exists {
		return false, handler.ErrSchemaUnknownAttribute(attributeId)
	}
	return schema.IsContentFiles(attributeIdMap[attributeId].Content), nil
}
func GetAttributeById(id uuid.UUID) (types.Attribute, error) {
	schema_mx.RLock()
	defer schema_mx.RUnlock()
	atr, exists := attributeIdMap[id]
	if !exists {
		return atr, handler.ErrSchemaUnknownAttribute(id)
	}
	return atr, nil
}
func GetClientEventById(id uuid.UUID) (types.ClientEvent, error) {
	schema_mx.RLock()
	defer schema_mx.RUnlock()
	ce, exists := clientEventIdMap[id]
	if !exists {
		return ce, handler.ErrSchemaUnknownClientEvent(id)
	}
	return ce, nil
}
func GetDocById(id uuid.UUID) (types.Doc, error) {
	schema_mx.RLock()
	defer schema_mx.RUnlock()
	doc, exists := docIdMap[id]
	if !exists {
		return doc, handler.ErrSchemaUnknownDoc(id)
	}
	return doc, nil
}
func GetPgFunctionById(id uuid.UUID) (types.PgFunction, error) {
	schema_mx.RLock()
	defer schema_mx.RUnlock()
	fnc, exists := pgFunctionIdMap[id]
	if !exists {
		return fnc, handler.ErrSchemaUnknownPgFunction(id)
	}
	return fnc, nil
}
func GetModuleById(id uuid.UUID) (types.Module, error) {
	schema_mx.RLock()
	defer schema_mx.RUnlock()
	mod, exists := moduleIdMap[id]
	if !exists {
		return mod, handler.ErrSchemaUnknownModule(id)
	}
	return mod, nil
}
func GetRelationAndAttributeByAttributeId(id uuid.UUID) (types.Relation, types.Attribute, error) {
	schema_mx.RLock()
	defer schema_mx.RUnlock()

	atr, exists := attributeIdMap[id]
	if !exists {
		return types.Relation{}, atr, handler.ErrSchemaUnknownAttribute(id)
	}
	rel, exists := relationIdMap[atr.RelationId]
	if !exists {
		return rel, atr, handler.ErrSchemaUnknownRelation(atr.RelationId)
	}
	return rel, atr, nil
}
func GetRelationById(id uuid.UUID) (types.Relation, error) {
	schema_mx.RLock()
	defer schema_mx.RUnlock()
	rel, exists := relationIdMap[id]
	if !exists {
		return rel, handler.ErrSchemaUnknownRelation(id)
	}
	return rel, nil
}

func GetClientEventIdMap() map[uuid.UUID]types.ClientEvent {
	schema_mx.RLock()
	defer schema_mx.RUnlock()
	return clientEventIdMap
}
func GetModuleIdMapMeta() map[uuid.UUID]types.ModuleMeta {
	schema_mx.RLock()
	defer schema_mx.RUnlock()
	return moduleIdMapMeta
}
func GetModuleCacheJson(moduleId uuid.UUID) (json.RawMessage, error) {
	schema_mx.RLock()
	defer schema_mx.RUnlock()

	json, exists := moduleIdMapJson[moduleId]
	if !exists {
		return []byte{}, fmt.Errorf("module %s does not exist in schema cache", moduleId)
	}
	return json, nil
}
func GetPgFunctionIdsLoginSyncAllModules() []uuid.UUID {
	schema_mx.RLock()
	defer schema_mx.RUnlock()

	ids := make([]uuid.UUID, 0)
	for _, mod := range moduleIdMap {
		if mod.PgFunctionIdLoginSync.Valid {
			ids = append(ids, mod.PgFunctionIdLoginSync.Bytes)
		}
	}
	return ids
}
func GetRelationIdsEncryptedAllModules() []uuid.UUID {
	schema_mx.RLock()
	defer schema_mx.RUnlock()

	ids := make([]uuid.UUID, 0)
	for _, rel := range relationIdMap {
		if rel.Encryption {
			ids = append(ids, rel.Id)
		}
	}
	return ids
}
func GetRelationIdMap() map[uuid.UUID]types.Relation {
	schema_mx.RLock()
	defer schema_mx.RUnlock()
	return relationIdMap
}

// overwrites language code with primary language of module if it´s not supported by module
func GetModuleLanguageCodeValid(moduleId uuid.UUID, languageCode string) (string, error) {
	schema_mx.RLock()
	defer schema_mx.RUnlock()

	if _, exists := moduleIdMap[moduleId]; !exists {
		return "", handler.ErrSchemaUnknownModule(moduleId)
	}

	if !slices.Contains(moduleIdMap[moduleId].Languages, languageCode) {
		languageCode = moduleIdMap[moduleId].LanguageMain
	}
	return languageCode, nil
}

func GetApiByNames(modName, apiName string, apiVersion int) (types.Api, error) {
	schema_mx.RLock()
	defer schema_mx.RUnlock()

	apiId, exists := moduleApiNameMapId[modName][fmt.Sprintf("%s.v%d", apiName, apiVersion)]
	if !exists {
		return types.Api{}, fmt.Errorf("API '%s.%s' (v%d) does not exist", modName, apiName, apiVersion)
	}
	api, exists := apiIdMap[apiId]
	if !exists {
		return types.Api{}, handler.ErrSchemaUnknownApi(apiId)
	}
	return api, nil
}

func LoadModuleIdMapMeta_tx(ctx context.Context, tx pgx.Tx) error {
	moduleIdMapMetaNew, err := config_moduleMeta.GetIdMap_tx(ctx, tx)
	if err != nil {
		return err
	}
	schema_mx.Lock()
	defer schema_mx.Unlock()

	// apply deletions if relevant
	for id := range moduleIdMapMeta {
		if _, exists := moduleIdMapMetaNew[id]; !exists {
			delete(moduleIdMap, id)
			delete(moduleIdMapJson, id)
		}
	}

	// set new meta data
	moduleIdMapMeta = moduleIdMapMetaNew
	return nil
}

// load all modules into the schema cache
func LoadSchema_tx(ctx context.Context, tx pgx.Tx) error {
	return UpdateSchema_tx(ctx, tx, maps.Keys(moduleIdMapMeta), true)
}

// update module schema cache
func UpdateSchema_tx(ctx context.Context, tx pgx.Tx, moduleIds []uuid.UUID, initialLoad bool) error {
	var err error

	if err := updateSchemaCache_tx(ctx, tx, moduleIds); err != nil {
		return err
	}

	// renew caches, affected by potentially changed modules (preset records, login access)
	renewIcsFields()
	if err := renewPresetRecordIds_tx(ctx, tx); err != nil {
		return err
	}

	// create JSON copy of schema cache for fast retrieval
	for _, id := range moduleIds {
		schema_mx.Lock()
		moduleIdMapJson[id], err = json.Marshal(moduleIdMap[id])
		schema_mx.Unlock()
		if err != nil {
			return err
		}
	}

	if initialLoad {
		return nil
	}

	// update change date for updated modules
	now := tools.GetTimeUnix()
	if err := config_moduleMeta.SetDateChange_tx(ctx, tx, moduleIds, now); err != nil {
		return err
	}

	// update module meta cache
	for _, id := range moduleIds {
		schema_mx.RLock()
		meta, exists := moduleIdMapMeta[id]
		schema_mx.RUnlock()

		if !exists {
			meta, err = config_moduleMeta.Get_tx(ctx, tx, id)
			if err != nil {
				return err
			}
		}
		meta.DateChange = now

		schema_mx.Lock()
		moduleIdMapMeta[id] = meta
		schema_mx.Unlock()
	}
	return nil
}

func updateSchemaCache_tx(ctx context.Context, tx pgx.Tx, moduleIds []uuid.UUID) error {
	schema_mx.Lock()
	defer schema_mx.Unlock()

	log.Info(log.ContextCache, fmt.Sprintf("starting schema processing for %d module(s)", len(moduleIds)))

	mods, err := module.Get_tx(ctx, tx, moduleIds)
	if err != nil {
		return err
	}
	for _, mod := range mods {
		log.Info(log.ContextCache, fmt.Sprintf("parsing module '%s'", mod.Name))
		mod.Relations = make([]types.Relation, 0)
		mod.Forms = make([]types.Form, 0)
		mod.MenuTabs = make([]types.MenuTab, 0)
		mod.Icons = make([]types.Icon, 0)
		mod.Roles = make([]types.Role, 0)
		mod.Articles = make([]types.Article, 0)
		mod.LoginForms = make([]types.LoginForm, 0)
		mod.PgFunctions = make([]types.PgFunction, 0)
		mod.JsFunctions = make([]types.JsFunction, 0)
		mod.Collections = make([]types.Collection, 0)
		mod.Apis = make([]types.Api, 0)
		mod.Docs = make([]types.Doc, 0)
		mod.ClientEvents = make([]types.ClientEvent, 0)
		mod.SearchBars = make([]types.SearchBar, 0)
		mod.Tags = make([]types.Tag, 0)
		mod.Variables = make([]types.Variable, 0)
		mod.Widgets = make([]types.Widget, 0)
		moduleApiNameMapId[mod.Name] = make(map[string]uuid.UUID)

		// get articles
		log.Info(log.ContextCache, "load articles")

		mod.Articles, err = article.Get_tx(ctx, tx, mod.Id)
		if err != nil {
			return err
		}

		// get relations
		log.Info(log.ContextCache, "load relations")

		rels, err := relation.Get_tx(ctx, tx, mod.Id)
		if err != nil {
			return err
		}

		for _, rel := range rels {

			// get attributes
			atrs, err := attribute.Get_tx(ctx, tx, rel.Id)
			if err != nil {
				return err
			}

			// store & backfill attribute to relation
			for _, atr := range atrs {
				attributeIdMap[atr.Id] = atr
				rel.Attributes = append(rel.Attributes, atr)
			}

			// get indexes
			rel.Indexes, err = pgIndex.Get_tx(ctx, tx, rel.Id)
			if err != nil {
				return err
			}

			// get presets
			rel.Presets, err = preset.Get_tx(ctx, tx, rel.Id)
			if err != nil {
				return err
			}

			// store & backfill relation to module
			relationIdMap[rel.Id] = rel
			mod.Relations = append(mod.Relations, rel)
		}

		// get forms
		log.Info(log.ContextCache, "load forms")

		mod.Forms, err = form.Get_tx(ctx, tx, mod.Id, []uuid.UUID{})
		if err != nil {
			return err
		}

		// get menu tabs
		log.Info(log.ContextCache, "load menu tabs")

		mod.MenuTabs, err = menuTab.Get_tx(ctx, tx, mod.Id)
		if err != nil {
			return err
		}

		// get icons
		log.Info(log.ContextCache, "load icons")

		mod.Icons, err = icon.Get_tx(ctx, tx, mod.Id)
		if err != nil {
			return err
		}

		// get roles
		log.Info(log.ContextCache, "load roles")

		mod.Roles, err = role.Get_tx(ctx, tx, mod.Id)
		if err != nil {
			return err
		}

		for _, rol := range mod.Roles {
			// store role
			roleIdMap[rol.Id] = rol
		}

		// get login forms
		log.Info(log.ContextCache, "load login forms")

		mod.LoginForms, err = loginForm.Get_tx(ctx, tx, mod.Id)
		if err != nil {
			return err
		}

		// get triggers
		mod.PgTriggers, err = pgTrigger.Get_tx(ctx, tx, mod.Id)
		if err != nil {
			return err
		}

		// store & backfill PG functions
		log.Info(log.ContextCache, "load PG functions")

		mod.PgFunctions, err = pgFunction.Get_tx(ctx, tx, mod.Id)
		if err != nil {
			return err
		}
		for _, fnc := range mod.PgFunctions {
			pgFunctionIdMap[fnc.Id] = fnc
		}

		// get JS functions
		log.Info(log.ContextCache, "load JS functions")

		mod.JsFunctions, err = jsFunction.Get_tx(ctx, tx, mod.Id)
		if err != nil {
			return err
		}

		// get collections
		log.Info(log.ContextCache, "load collections")

		mod.Collections, err = collection.Get_tx(ctx, tx, mod.Id)
		if err != nil {
			return err
		}

		// get APIs
		log.Info(log.ContextCache, "load APIs")

		mod.Apis, err = api.Get_tx(ctx, tx, mod.Id, uuid.Nil)
		if err != nil {
			return err
		}
		for _, a := range mod.Apis {
			apiIdMap[a.Id] = a
			moduleApiNameMapId[mod.Name][fmt.Sprintf("%s.v%d", a.Name, a.Version)] = a.Id
		}

		// get documents
		log.Info(log.ContextCache, "load documents")

		mod.Docs, err = doc.Get_tx(ctx, tx, mod.Id, []uuid.UUID{})
		if err != nil {
			return err
		}
		for _, d := range mod.Docs {
			docIdMap[d.Id] = d
		}

		// get client events
		log.Info(log.ContextCache, "load client events")

		mod.ClientEvents, err = clientEvent.Get_tx(ctx, tx, mod.Id)
		if err != nil {
			return err
		}
		for _, ce := range mod.ClientEvents {
			clientEventIdMap[ce.Id] = ce
		}

		// get search bars
		log.Info(log.ContextCache, "load search bars")
		mod.SearchBars, err = searchBar.Get_tx(ctx, tx, mod.Id)
		if err != nil {
			return err
		}

		// get tags
		log.Info(log.ContextCache, "load tags")
		mod.Tags, err = tag.Get_tx(ctx, tx, mod.Id)
		if err != nil {
			return err
		}

		// get variables
		log.Info(log.ContextCache, "load variables")

		mod.Variables, err = variable.Get_tx(ctx, tx, mod.Id)
		if err != nil {
			return err
		}

		// get widgets
		log.Info(log.ContextCache, "load widgets")

		mod.Widgets, err = widget.Get_tx(ctx, tx, mod.Id)
		if err != nil {
			return err
		}

		// update cache map with parsed module
		moduleIdMap[mod.Id] = mod
	}
	return nil
}
