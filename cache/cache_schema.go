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
	"r3/schema/collection"
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
	Schema_mx sync.RWMutex

	// cached entities for regular use during normal operation
	ModuleIdMap     map[uuid.UUID]types.Module     // all modules by ID
	RelationIdMap   map[uuid.UUID]types.Relation   // all relations by ID
	AttributeIdMap  map[uuid.UUID]types.Attribute  // all attributes by ID
	RoleIdMap       map[uuid.UUID]types.Role       // all roles by ID
	PgFunctionIdMap map[uuid.UUID]types.PgFunction // all PG functions by ID

	// schema cache
	moduleIdsOrdered []uuid.UUID     // all module IDs in desired order
	schemaCacheJson  json.RawMessage // full schema cache as JSON
	schemaTimestamp  int64           // timestamp of last update to schema cache
)

func GetSchemaTimestamp() int64 {
	Schema_mx.RLock()
	defer Schema_mx.RUnlock()
	return schemaTimestamp
}
func GetSchemaCacheJson() json.RawMessage {
	Schema_mx.RLock()
	defer Schema_mx.RUnlock()
	return schemaCacheJson
}

// update module schema cache in memory
// takes either single module ID for specific update or NULL for updating all modules
// can just load schema or create a new version timestamp, which forces reload on clients
func UpdateSchema(newVersion bool, moduleIdsUpdateOnly []uuid.UUID) error {
	var err error

	// inform all clients about schema reloading
	ClientEvent_handlerChan <- types.ClientEvent{LoginId: 0, SchemaLoading: true}

	defer func() {
		// inform regardless of success or error
		ClientEvent_handlerChan <- types.ClientEvent{LoginId: 0, SchemaTimestamp: schemaTimestamp}
	}()

	// update schema cache
	if err := updateSchemaCache(moduleIdsUpdateOnly); err != nil {
		return err
	}

	// renew caches, affected by potentially changed modules (preset records, login access)
	renewIcsFields()
	if err := renewPresetRecordIds(); err != nil {
		return err
	}
	if err := RenewAccessAll(); err != nil {
		return err
	}

	// create JSON copy of schema cache for fast retrieval
	schemaCache := schemaCacheType{
		Modules:         make([]types.Module, 0),
		PresetRecordIds: GetPresetRecordIds(),
	}
	schemaCache.ModuleOptions, err = module_option.Get()
	if err != nil {
		return err
	}
	for _, id := range moduleIdsOrdered {
		schemaCache.Modules = append(schemaCache.Modules, ModuleIdMap[id])
	}

	schemaCacheJson, err = json.Marshal(schemaCache)
	if err != nil {
		return err
	}

	// set schema timestamp
	// keep timestamp if nothing changed (cache reuse) or renew it (cache refresh)
	if !newVersion {
		schemaTimestamp = int64(config.GetUint64("schemaTimestamp"))
		return nil
	}
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

func updateSchemaCache(moduleIdsUpdateOnly []uuid.UUID) error {
	Schema_mx.Lock()
	defer Schema_mx.Unlock()

	allModules := len(moduleIdsUpdateOnly) == 0

	if allModules {
		log.Info("cache", "starting schema processing for all modules")
		moduleIdsOrdered = make([]uuid.UUID, 0)
		ModuleIdMap = make(map[uuid.UUID]types.Module)
		RelationIdMap = make(map[uuid.UUID]types.Relation)
		AttributeIdMap = make(map[uuid.UUID]types.Attribute)
		RoleIdMap = make(map[uuid.UUID]types.Role)
		PgFunctionIdMap = make(map[uuid.UUID]types.PgFunction)
	} else {
		log.Info("cache", "starting schema processing for one module")
	}

	mods, err := module.Get(moduleIdsUpdateOnly)
	if err != nil {
		return err
	}
	for _, mod := range mods {

		if allModules {
			// store returned module order to create ordered cache
			moduleIdsOrdered = append(moduleIdsOrdered, mod.Id)
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
		mod.Collections = make([]types.Collection, 0)

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

			// store & backfill attribute to relation
			for _, atr := range atrs {
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

		// get collections
		log.Info("cache", "load collections")

		mod.Collections, err = collection.Get(mod.Id)
		if err != nil {
			return err
		}

		// update cache map with parsed module
		ModuleIdMap[mod.Id] = mod
	}
	return nil
}
