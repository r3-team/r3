package transfer

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"r3/cache"
	"r3/cluster"
	"r3/config"
	"r3/db"
	"r3/log"
	"r3/module_option"
	"r3/schema"
	"r3/schema/article"
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
	"strings"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgtype"
	"github.com/jackc/pgx/v4"
)

type importMeta struct {
	filePath string       // path of module import file (decompressed JSON file)
	hash     string       // hash of module content
	isNew    bool         // module was already in system (upgrade)
	module   types.Module // module content
}

// imports extracted modules from given file paths
func ImportFromFiles(filePathsImport []string) error {

	log.Info("transfer", fmt.Sprintf("start import for modules from file(s): '%s'",
		strings.Join(filePathsImport, "', '")))

	// extract module packages
	filePathsModules := make([]string, 0)

	for i, zipPath := range filePathsImport {

		// add numbered prefix in case multiple packages are imported with same file names
		prefix := fmt.Sprintf("%d_", i)

		filePaths, err := writeFilesFromZip(zipPath, config.File.Paths.Temp, prefix)
		if err != nil {
			return err
		}
		filePathsModules = append(filePathsModules, filePaths...)
	}

	// parse modules from file paths, only modules that need to be imported are returned
	moduleIdMapMeta := make(map[uuid.UUID]importMeta)
	modules, err := parseModulesFromPaths(filePathsModules, moduleIdMapMeta)
	if err != nil {
		return err
	}

	// import modules
	tx, err := db.Pool.Begin(db.Ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(db.Ctx)

	idMapSkipped := make(map[uuid.UUID]types.Void)
	loopsToRun := 10

	for loopsRan := 0; true; loopsRan++ {

		firstRun := loopsRan == 0
		lastRun := loopsRan == loopsToRun-1

		if !firstRun {
			if len(idMapSkipped) == 0 {
				// finish if no entities were skipped
				break
			}

			if loopsRan == loopsToRun {
				// abort if too many attempts were done
				return errors.New("import loop count exceeded")
			}
		}
		log.Info("transfer", fmt.Sprintf("import loop %d started", loopsRan+1))

		for _, m := range modules {
			log.Info("transfer", fmt.Sprintf("import START, module '%s', %s", m.Name, m.Id))

			if err := import_tx(tx, m, firstRun, lastRun, idMapSkipped); err != nil {
				return err
			}

			if _, exists := idMapSkipped[m.Id]; !exists && !moduleIdMapMeta[m.Id].isNew {
				if err := importDeleteNotExisting_tx(tx, m); err != nil {
					return err
				}
			}
			log.Info("transfer", fmt.Sprintf("import END, module '%s', %s", m.Name, m.Id))
		}
	}

	// after all tasks were successful, final checks and clean ups
	for _, m := range modules {

		// validate dependency between modules
		if err := schema.ValidateDependency_tx(tx, m.Id); err != nil {
			return err
		}

		// set new module hash value in instance
		if err := module_option.SetHashById_tx(tx, m.Id, moduleIdMapMeta[m.Id].hash); err != nil {
			return err
		}

		// move imported module file to transfer path for future exports
		if err := tools.FileMove(moduleIdMapMeta[m.Id].filePath, filepath.Join(
			config.File.Paths.Transfer, getModuleFilename(m.Id)), true); err != nil {

			return err
		}
	}

	log.Info("transfer", "module dependencies were validated successfully")
	log.Info("transfer", "module files were moved to transfer path if imported")

	if err := tx.Commit(db.Ctx); err != nil {
		return err
	}
	log.Info("transfer", "changes were commited successfully")

	if err := cluster.SchemaChangedAll(true, true); err != nil {
		return err
	}
	return nil
}

func import_tx(tx pgx.Tx, mod types.Module, firstRun bool, lastRun bool,
	idMapSkipped map[uuid.UUID]types.Void) error {

	// # Execution order
	// 1) set new/existing entities (module, relations, attributes, presets, ...)
	// 2) execute data migration scripts (old and new data structures exist) (NOT IMPLEMENTED YET)
	// 3) delete entities after import is done
	//    if other entities rely on deleted states (presets), they are applied on next loop

	// we use a sensible import order to avoid conflicts but some cannot be avoided
	// # known cases
	// * pg functions referencing each other
	// * preset values referencing other presets
	// * presets being dependent on deleted attributes (less NOT NULL constraints)
	// import loop allows for repeated attempts

	// module
	run, err := importCheckRunAndSave(tx, firstRun, mod.Id, idMapSkipped)
	if err != nil {
		return err
	}
	if run {
		log.Info("transfer", fmt.Sprintf("set module '%s' v%d, %s",
			mod.Name, mod.ReleaseBuild, mod.Id))

		if err := importCheckResultAndApply(tx, module.Set_tx(tx, mod.Id,
			mod.ParentId, mod.FormId, mod.IconId, mod.Name, mod.Color1,
			mod.Position, mod.LanguageMain, mod.ReleaseBuild,
			mod.ReleaseBuildApp, mod.ReleaseDate, mod.DependsOn, mod.StartForms,
			mod.Languages, mod.ArticleIdsHelp, mod.Captions), mod.Id, idMapSkipped); err != nil {

			return err
		}
	}

	// articles
	for _, e := range mod.Articles {
		run, err := importCheckRunAndSave(tx, firstRun, e.Id, idMapSkipped)
		if err != nil {
			return err
		}
		if !run {
			continue
		}
		log.Info("transfer", fmt.Sprintf("set article %s", e.Id))

		if err := importCheckResultAndApply(tx, article.Set_tx(tx, e.ModuleId,
			e.Id, e.Name, e.Captions), e.Id, idMapSkipped); err != nil {

			return err
		}
	}

	// icons
	for _, e := range mod.Icons {
		run, err := importCheckRunAndSave(tx, firstRun, e.Id, idMapSkipped)
		if err != nil {
			return err
		}
		if !run {
			continue
		}
		log.Info("transfer", fmt.Sprintf("set icon %s", e.Id))

		if err := importCheckResultAndApply(tx, icon.Set_tx(tx, e.ModuleId,
			e.Id, e.Name, e.File, true), e.Id, idMapSkipped); err != nil {

			return err
		}
	}

	// relations
	for _, e := range mod.Relations {
		run, err := importCheckRunAndSave(tx, firstRun, e.Id, idMapSkipped)
		if err != nil {
			return err
		}
		if !run {
			continue
		}
		log.Info("transfer", fmt.Sprintf("set relation %s", e.Id))

		if err := importCheckResultAndApply(tx, relation.Set_tx(tx,
			e.ModuleId, e.Id, e.Name, e.Encryption, e.RetentionCount,
			e.RetentionDays, e.Policies), e.Id, idMapSkipped); err != nil {

			return err
		}
	}

	// attributes, refer to relations
	for _, relation := range mod.Relations {
		for _, e := range relation.Attributes {

			run, err := importCheckRunAndSave(tx, firstRun, e.Id, idMapSkipped)
			if err != nil {
				return err
			}
			if !run {
				continue
			}
			log.Info("transfer", fmt.Sprintf("set attribute %s", e.Id))

			if err := importCheckResultAndApply(tx, attribute.Set_tx(tx,
				e.RelationId, e.Id, e.RelationshipId, e.IconId, e.Name,
				e.Content, e.Length, e.Nullable, e.Encrypted, e.Def, e.OnUpdate, e.OnDelete,
				e.Captions), e.Id, idMapSkipped); err != nil {

				return err
			}
		}
	}

	// collections
	for _, e := range mod.Collections {

		run, err := importCheckRunAndSave(tx, firstRun, e.Id, idMapSkipped)
		if err != nil {
			return err
		}
		if !run {
			continue
		}
		log.Info("transfer", fmt.Sprintf("set collection %s", e.Id))

		if err := importCheckResultAndApply(tx, collection.Set_tx(tx,
			e.ModuleId, e.Id, e.IconId, e.Name, e.Columns, e.Query, e.InHeader),
			e.Id, idMapSkipped); err != nil {

			return err
		}
	}

	// PG functions, refer to relations/attributes/pg_functions (self reference)
	for _, e := range mod.PgFunctions {

		run, err := importCheckRunAndSave(tx, firstRun, e.Id, idMapSkipped)
		if err != nil {
			return err
		}
		if !run {
			continue
		}
		log.Info("transfer", fmt.Sprintf("set PG function %s", e.Id))

		if err := importCheckResultAndApply(tx, pgFunction.Set_tx(tx,
			e.ModuleId, e.Id, e.Name, e.CodeArgs, e.CodeFunction, e.CodeReturns,
			e.IsFrontendExec, e.IsTrigger, e.Schedules, e.Captions),
			e.Id, idMapSkipped); err != nil {

			return err
		}
	}

	// PG triggers, refer to PG functions
	for _, relation := range mod.Relations {
		for _, e := range relation.Triggers {

			run, err := importCheckRunAndSave(tx, firstRun, e.Id, idMapSkipped)
			if err != nil {
				return err
			}
			if !run {
				continue
			}
			log.Info("transfer", fmt.Sprintf("set trigger %s", e.Id))

			if err := importCheckResultAndApply(tx, pgTrigger.Set_tx(tx,
				e.PgFunctionId, e.Id, e.RelationId, e.OnInsert, e.OnUpdate,
				e.OnDelete, e.IsConstraint, e.IsDeferrable, e.IsDeferred,
				e.PerRow, e.Fires, e.CodeCondition), e.Id, idMapSkipped); err != nil {

				return err
			}
		}
	}

	// PG indexes
	for _, relation := range mod.Relations {
		for _, e := range relation.Indexes {

			run, err := importCheckRunAndSave(tx, firstRun, e.Id, idMapSkipped)
			if err != nil {
				return err
			}
			if !run {
				continue
			}
			log.Info("transfer", fmt.Sprintf("set index %s", e.Id))

			if err := importCheckResultAndApply(tx, pgIndex.Set_tx(tx,
				e.RelationId, e.Id, e.NoDuplicates, e.AutoFki, e.Attributes),
				e.Id, idMapSkipped); err != nil {

				return err
			}
		}
	}

	// forms, refer to relations/attributes/collections/JS functions
	for _, e := range mod.Forms {

		run, err := importCheckRunAndSave(tx, firstRun, e.Id, idMapSkipped)
		if err != nil {
			return err
		}
		if !run {
			continue
		}
		log.Info("transfer", fmt.Sprintf("set form %s", e.Id))

		if err := importCheckResultAndApply(tx, form.Set_tx(tx,
			e.ModuleId, e.Id, e.PresetIdOpen, e.IconId, e.Name, e.NoDataActions,
			e.Query, e.Fields, e.Functions, e.States, e.ArticleIdsHelp,
			e.Captions), e.Id, idMapSkipped); err != nil {

			return err
		}
	}

	// login forms, refer to forms/attributes
	for _, e := range mod.LoginForms {
		run, err := importCheckRunAndSave(tx, firstRun, e.Id, idMapSkipped)
		if err != nil {
			return err
		}
		if !run {
			continue
		}
		log.Info("transfer", fmt.Sprintf("set login form %s", e.Id))

		if err := importCheckResultAndApply(tx, loginForm.Set_tx(
			tx, e.ModuleId, e.Id, e.AttributeIdLogin, e.AttributeIdLookup,
			e.FormId, e.Name, e.Captions), e.Id, idMapSkipped); err != nil {

			return err
		}
	}

	// menus, refer to forms/icons
	log.Info("transfer", "set menus")
	if err := menu.Set_tx(tx, pgtype.UUID{Status: pgtype.Null}, mod.Menus); err != nil {
		return err
	}

	// roles, refer to relations/attributes/menu
	for _, e := range mod.Roles {

		run, err := importCheckRunAndSave(tx, firstRun, e.Id, idMapSkipped)
		if err != nil {
			return err
		}
		if !run {
			continue
		}
		log.Info("transfer", fmt.Sprintf("set role %s", e.Id))

		if err := importCheckResultAndApply(tx, role.Set_tx(tx,
			e.ModuleId, e.Id, e.Name, e.Content, e.Assignable, e.ChildrenIds,
			e.AccessAttributes, e.AccessCollections, e.AccessMenus,
			e.AccessRelations, e.Captions), e.Id, idMapSkipped); err != nil {

			return err
		}
	}

	// JS functions, refer to forms/fields/roles/pg_functions/js_functions (self reference)
	for _, e := range mod.JsFunctions {

		run, err := importCheckRunAndSave(tx, firstRun, e.Id, idMapSkipped)
		if err != nil {
			return err
		}
		if !run {
			continue
		}
		log.Info("transfer", fmt.Sprintf("set JS function %s", e.Id))

		if err := importCheckResultAndApply(tx, jsFunction.Set_tx(tx,
			e.ModuleId, e.Id, e.FormId, e.Name, e.CodeArgs, e.CodeFunction,
			e.CodeReturns, e.Captions), e.Id, idMapSkipped); err != nil {

			return err
		}
	}

	// presets, refer to relations/attributes/other presets
	// can fail because deletions happen after import and presets depent on the state of relations/attributes
	//  which might loose constraints (example: attribute with NOT NULL removed)
	// unprotected presets are optional (can be deleted within instance)
	//  because of this some preset referals might not work and are ignored
	for _, relation := range mod.Relations {
		for _, e := range relation.Presets {
			run, err := importCheckRunAndSave(tx, firstRun, e.Id, idMapSkipped)
			if err != nil {
				return err
			}
			if !run {
				continue
			}
			log.Info("transfer", fmt.Sprintf("set preset %s", e.Id))

			// special case
			// presets can fail import because referenced, unprotected presets were deleted or unique constraints are broken
			// if preset itself is unprotected, we try until the last loop and then give up
			if lastRun && !e.Protected {
				log.Info("transfer", "import failed to resolve unprotected preset until last loop, it will be ignored")
				if err := importCheckResultAndApply(tx, nil, e.Id, idMapSkipped); err != nil {
					return err
				}
				continue
			}

			if err := importCheckResultAndApply(tx, preset.Set_tx(tx,
				e.RelationId, e.Id, e.Name, e.Protected, e.Values),
				e.Id, idMapSkipped); err != nil {

				return err
			}
		}
	}
	return nil
}

// checks if this action needs to run and sets savepoint inside DB transaction if so
// returns true if action needs to run
func importCheckRunAndSave(tx pgx.Tx, firstRun bool, entityId uuid.UUID,
	idMapSkipped map[uuid.UUID]types.Void) (bool, error) {

	_, skipped := idMapSkipped[entityId]
	needsToRun := firstRun || skipped

	if !needsToRun {
		return false, nil
	}

	if _, err := tx.Exec(db.Ctx, `SAVEPOINT transfer_import`); err != nil {
		return false, err
	}
	return true, nil
}

// checks if action was successful and releases/rollbacks savepoints accordingly
// stores entity ID in skip map, if unsuccessful
func importCheckResultAndApply(tx pgx.Tx, resultErr error, entityId uuid.UUID,
	idMapSkipped map[uuid.UUID]types.Void) error {

	if resultErr == nil {
		if _, err := tx.Exec(db.Ctx, `RELEASE SAVEPOINT transfer_import`); err != nil {
			return err
		}
		if _, exists := idMapSkipped[entityId]; exists {
			delete(idMapSkipped, entityId)
		}
		return nil
	}

	// error case
	log.Info("transfer", fmt.Sprintf("skipped entity on this run, error: %s", resultErr))

	if _, err := tx.Exec(db.Ctx, `ROLLBACK TO SAVEPOINT transfer_import`); err != nil {
		return err
	}
	idMapSkipped[entityId] = types.Void{}
	return nil
}

func parseModulesFromPaths(filePaths []string, moduleIdMapMeta map[uuid.UUID]importMeta) ([]types.Module, error) {
	cache.Schema_mx.RLock()
	defer cache.Schema_mx.RUnlock()

	modules := make([]types.Module, 0)

	log.Info("transfer", fmt.Sprintf("import is parsing %d module files", len(filePaths)))

	// read all modules from file paths
	for _, filePath := range filePaths {

		jsonFileData, err := os.ReadFile(filePath)
		if err != nil {
			return modules, err
		}

		// verify content, signature & hash
		hashed, err := verifyContent(&jsonFileData)
		hashedStr := base64.URLEncoding.EncodeToString(hashed[:])
		if err != nil {
			return modules, err
		}

		var fileData types.TransferFile
		if err := json.Unmarshal(jsonFileData, &fileData); err != nil {
			return modules, err
		}
		moduleId := fileData.Content.Module.Id

		log.Info("transfer", fmt.Sprintf("import is validating module '%s' v%d",
			fileData.Content.Module.Name, fileData.Content.Module.ReleaseBuild))

		// verify application compatability
		if err := verifyCompatibilityWithApp(moduleId, fileData.Content.Module.ReleaseBuildApp); err != nil {
			return modules, err
		}

		// check whether module is imported anew or updated
		exModule, isModuleUpgrade := cache.ModuleIdMap[moduleId]

		if isModuleUpgrade {

			// check for newer version of installed module
			if exModule.ReleaseBuild >= fileData.Content.Module.ReleaseBuild {

				log.Info("transfer", fmt.Sprintf("import of module '%s' not required, same or newer version (%d -> %d) installed",
					fileData.Content.Module.Name, exModule.ReleaseBuild,
					fileData.Content.Module.ReleaseBuild))

				continue
			}

			// check whether installed module hash changed at all
			hashedStrEx, err := module_option.GetHashById(moduleId)
			if err != nil {
				return modules, err
			}

			if hashedStr == hashedStrEx {
				log.Info("transfer", fmt.Sprintf("import of module '%s' not required, no changes",
					fileData.Content.Module.Name))

				continue
			}
		}

		// check whether module was added previously (multiple import files used with similar modules)
		if _, exists := moduleIdMapMeta[moduleId]; exists {
			if moduleIdMapMeta[moduleId].module.ReleaseBuild >= fileData.Content.Module.ReleaseBuild {
				log.Info("transfer", fmt.Sprintf("import of module '%s' not required, same or newer version (%d -> %d) to be added",
					fileData.Content.Module.Name, moduleIdMapMeta[moduleId].module.ReleaseBuild,
					fileData.Content.Module.ReleaseBuild))

				continue
			}
		}

		log.Info("transfer", fmt.Sprintf("import will install module '%s' v%d",
			fileData.Content.Module.Name, fileData.Content.Module.ReleaseBuild))

		moduleIdMapMeta[moduleId] = importMeta{
			filePath: filePath,
			hash:     hashedStr,
			isNew:    !isModuleUpgrade,
			module:   fileData.Content.Module,
		}
	}

	// add modules following optimized import order
	moduleIdsAdded := make([]uuid.UUID, 0)

	var addModule func(m types.Module)
	addModule = func(m types.Module) {

		if tools.UuidInSlice(m.Id, moduleIdsAdded) {
			return
		}

		// add itself before dependencies (avoids infinite loops from circular dependencies)
		modules = append(modules, m)
		moduleIdsAdded = append(moduleIdsAdded, m.Id)

		// add dependencies
		for _, dependId := range m.DependsOn {

			if _, exists := moduleIdMapMeta[dependId]; !exists {
				// dependency was not included or is not needed
				continue
			}
			addModule(moduleIdMapMeta[dependId].module)
		}
	}

	for _, meta := range moduleIdMapMeta {
		addModule(meta.module)
	}

	// log chosen installation order
	logNames := make([]string, len(modules))
	for i, m := range modules {
		logNames[i] = m.Name
	}
	log.Info("transfer", fmt.Sprintf("import has decided on installation order: %s",
		strings.Join(logNames, ", ")))

	return modules, nil
}
