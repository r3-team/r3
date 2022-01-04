// Application cache
// Used during regular operation for fast lookups during regular operation.
// Is NOT used while manipulating the schema.
package cache

import (
	"encoding/json"
	"fmt"
	"r3/config"
	"r3/db"
	"r3/log"
	"r3/module_option"
	"r3/schema/attribute"
	"r3/schema/form"
	"r3/schema/icon"
	"r3/schema/jsFunction"
	"r3/schema/loginForm"
	"r3/schema/menu"
	"r3/schema/module"
	"r3/schema/pgFunction"
	"r3/schema/pgIndex"
	"r3/schema/pgTrigger"
	"r3/schema/preset"
	"r3/schema/relation"
	"r3/schema/role"
	"r3/tools"
	"r3/types"
	"sync"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgtype"
)

type schemaCacheType struct {
	Modules         []types.Module       `json:"modules"`
	ModuleOptions   []types.ModuleOption `json:"moduleOptions"`
	PresetRecordIds map[uuid.UUID]int64  `json:"presetRecordIds"`
}

var (
	// schema cache access and state
	schema_mx sync.Mutex

	// references to specific entities
	ModuleIdMap     map[uuid.UUID]types.Module
	RelationIdMap   map[uuid.UUID]types.Relation
	AttributeIdMap  map[uuid.UUID]types.Attribute
	RoleIdMap       map[uuid.UUID]types.Role
	PgFunctionIdMap map[uuid.UUID]types.PgFunction

	// schema cache
	schemaCache     schemaCacheType // full cache
	schemaJson      json.RawMessage // full cache, marshalled to JSON
	schemaTimestamp int64           // timestamp of last update to schema cache
)

func GetSchemaTimestamp() int64 {
	schema_mx.Lock()
	defer schema_mx.Unlock()

	return schemaTimestamp
}
func GetSchemaCacheJson() json.RawMessage {
	schema_mx.Lock()
	defer schema_mx.Unlock()

	return schemaJson
}
func UpdateSchemaAll(newVersion bool) error {
	return UpdateSchema(pgtype.UUID{Status: pgtype.Null}, newVersion)
}

// update module schema cache in memory
// takes either single module ID for specific update or NULL for updating all modules
// can just load schema or create a new version timestamp
func UpdateSchema(moduleId pgtype.UUID, newVersion bool) error {
	schema_mx.Lock()
	defer schema_mx.Unlock()

	// inform all clients about schema reloading
	ClientEvent_handlerChan <- types.ClientEvent{LoginId: 0, SchemaLoading: true}

	defer func() {
		// inform in error case as well
		ClientEvent_handlerChan <- types.ClientEvent{LoginId: 0, SchemaTimestamp: schemaTimestamp}
	}()

	moduleIdsReload := make([]uuid.UUID, 0)

	if moduleId.Status != pgtype.Present {
		log.Info("cache", "starting schema processing for all modules")

		// clear entire schema cache if all modules are updated
		schemaCache = schemaCacheType{
			Modules: make([]types.Module, 0),
		}
		ModuleIdMap = make(map[uuid.UUID]types.Module)
		RelationIdMap = make(map[uuid.UUID]types.Relation)
		AttributeIdMap = make(map[uuid.UUID]types.Attribute)
		RoleIdMap = make(map[uuid.UUID]types.Role)
		PgFunctionIdMap = make(map[uuid.UUID]types.PgFunction)
	} else {
		log.Info("cache", "starting schema processing for one module")
		moduleIdsReload = append(moduleIdsReload, moduleId.Bytes)
	}

	// reload either one or all modules
	mods, err := module.Get(moduleIdsReload)
	if err != nil {
		return err
	}

	for _, mod := range mods {
		ModuleIdMap[mod.Id] = mod

		if err := reloadModule(mod.Id); err != nil {
			return err
		}
	}

	// renew caches, affected by potentially changed modules (preset records, login access)
	renewIcsFields()
	if err := renewPresetRecordIds(); err != nil {
		return err
	}
	if err := RenewAccessAll(); err != nil {
		return err
	}

	// reload module options & presets after caches have been renewed
	schemaCache.ModuleOptions, err = module_option.Get()
	if err != nil {
		return err
	}
	schemaCache.PresetRecordIds = GetPresetRecordIds()

	// marshal final schema cache for fast retrieval
	schemaJson, err = json.Marshal(schemaCache)
	if err != nil {
		return err
	}

	if !newVersion {
		// use last schema timestamp (schema cache can be reused)
		schemaTimestamp = int64(config.GetUint64("schemaTimestamp"))
		return nil
	}

	// use new schema timestamp (schema cache must be refreshed)
	schemaTimestamp = tools.GetTimeUnix()

	tx, err := db.Pool.Begin(db.Ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(db.Ctx)

	if err := config.SetUint64_tx(tx, "schemaTimestamp", uint64(schemaTimestamp)); err != nil {
		return err
	}
	return tx.Commit(db.Ctx)
}

// (re)load details for a module into schema cache (maps and ordered module array)
func reloadModule(id uuid.UUID) error {

	mod, exists := ModuleIdMap[id]
	if !exists {
		return fmt.Errorf("module '%s' does not exist in schema cache", id)
	}

	log.Info("cache", fmt.Sprintf("parsing module '%s'", mod.Name))

	mod.Relations = make([]types.Relation, 0)
	mod.Forms = make([]types.Form, 0)
	mod.Menus = make([]types.Menu, 0)
	mod.Icons = make([]types.Icon, 0)
	mod.Roles = make([]types.Role, 0)
	mod.LoginForms = make([]types.LoginForm, 0)
	mod.PgFunctions = make([]types.PgFunction, 0)
	mod.JsFunctions = make([]types.JsFunction, 0)

	// get relations
	log.Info("cache", "load relations")

	rels, err := relation.Get(mod.Id)
	if err != nil {
		return err
	}

	for _, rel := range rels {

		// get attributes
		atrs, err := attribute.Get(rel.Id)
		if err != nil {
			return err
		}

		for _, atr := range atrs {

			// store & backfill attribute to relation
			AttributeIdMap[atr.Id] = atr
			rel.Attributes = append(rel.Attributes, atr)
		}

		// get indexes
		rel.Indexes, err = pgIndex.Get(rel.Id)
		if err != nil {
			return err
		}

		// get presets
		rel.Presets, err = preset.Get(rel.Id)
		if err != nil {
			return err
		}

		// get triggers
		rel.Triggers, err = pgTrigger.Get(rel.Id)
		if err != nil {
			return err
		}

		// store & backfill relation to module
		RelationIdMap[rel.Id] = rel
		mod.Relations = append(mod.Relations, rel)
	}

	// get forms
	log.Info("cache", "load forms")

	mod.Forms, err = form.Get(mod.Id, []uuid.UUID{})
	if err != nil {
		return err
	}

	// get menus
	log.Info("cache", "load menus")

	mod.Menus, err = menu.Get(mod.Id, pgtype.UUID{Status: pgtype.Null})
	if err != nil {
		return err
	}

	// get icons
	log.Info("cache", "load icons")

	mod.Icons, err = icon.Get(mod.Id)
	if err != nil {
		return err
	}

	// get roles
	log.Info("cache", "load roles")

	mod.Roles, err = role.Get(mod.Id)
	if err != nil {
		return err
	}

	for _, rol := range mod.Roles {
		// store role
		RoleIdMap[rol.Id] = rol
	}

	// get login forms
	log.Info("cache", "load login forms")

	mod.LoginForms, err = loginForm.Get(mod.Id)
	if err != nil {
		return err
	}

	// store & backfill PG functions
	log.Info("cache", "load PG functions")

	mod.PgFunctions, err = pgFunction.Get(mod.Id)
	if err != nil {
		return err
	}
	for _, fnc := range mod.PgFunctions {
		PgFunctionIdMap[fnc.Id] = fnc
	}

	// get JS functions
	log.Info("cache", "load JS functions")

	mod.JsFunctions, err = jsFunction.Get(mod.Id)
	if err != nil {
		return err
	}

	// update cache map with parsed module
	ModuleIdMap[mod.Id] = mod

	// add to or replace parsed module in ordered array
	exists = false
	for i, m := range schemaCache.Modules {
		if m.Id == mod.Id {
			schemaCache.Modules[i] = mod
			exists = true
			break
		}
	}
	if !exists {
		schemaCache.Modules = append(schemaCache.Modules, mod)
	}
	return nil
}
