import {getQueryTemplateIfNull} from '../comps/shared/query.js';
export {MyStoreSchema as default};

const MyStoreSchema = {
	namespaced:true,
	state:{
		// unix timestamp of loaded schema
		timestamp:-1,
		
		// cache content
		modules:[],             // all modules with everything beneath them
		moduleIdMapOptions:{},  // instance options for all modules, key: module ID
		presetIdMapRecordId:{}, // record IDs by preset, key: preset ID
		
		// references to specific entities
		articleIdMap:{},
		attributeIdMap:{},
		collectionIdMap:{},
		formIdMap:{},
		iconIdMap:{},
		indexIdMap:{},
		jsFunctionIdMap:{},
		moduleIdMap:{},
		moduleNameMap:{},
		pgFunctionIdMap:{},
		relationIdMap:{},
		roleIdMap:{},
		
		// computed
		formIdMapMenu:{},
		languageCodes:[]
	},
	mutations:{
		set(state,payload) {
			let getFormIdsFromMenus = function(menus) {
				for(const menu of menus) {
					state.formIdMapMenu[menu.formId] = menu;
					getFormIdsFromMenus(menu.menus);
				}
			};
			let processFields = function(fields) {
				for(let i = 0, j = fields.length; i < j; i++) {
					let f = fields[i];
					
					if(typeof f.query !== 'undefined')
						fields[i].query = getQueryTemplateIfNull(f.query);
					
					if(f.content === 'container')
						fields[i].fields = processFields(f.fields);
				}
				return fields;
			};
			
			// reset state
			state.modules         = payload.modules;
			state.articleIdMap    = {};
			state.attributeIdMap  = {};
			state.collectionIdMap = {};
			state.moduleIdMap     = {};
			state.moduleNameMap   = {};
			state.formIdMap       = {};
			state.formIdMapMenu   = {};
			state.iconIdMap       = {};
			state.indexIdMap      = {};
			state.jsFunctionIdMap = {};
			state.pgFunctionIdMap = {};
			state.relationIdMap   = {};
			state.roleIdMap       = {};
			
			// reset module options & preset records
			state.moduleIdMapOptions = {};
			for(let i = 0, j = payload.moduleOptions.length; i < j; i++) {
				state.moduleIdMapOptions[payload.moduleOptions[i].id] = payload.moduleOptions[i];
			}
			state.presetIdMapRecordId = payload.presetRecordIds;
			
			// process modules
			for(let mod of state.modules) {
				mod.formNameMap = {};
				
				state.moduleIdMap[mod.id]     = mod;
				state.moduleNameMap[mod.name] = mod;
				
				// process languages
				for(const lang of mod.languages) {
					
					if(state.languageCodes.indexOf(lang) === -1)
						state.languageCodes.push(lang);
				}
				
				// process articles
				for(const art of mod.articles) {
					state.articleIdMap[art.id] = art;
				}
				
				// process relations
				for(const rel of mod.relations) {
					state.relationIdMap[rel.id] = rel;
					
					// process attributes
					for(const atr of rel.attributes) {
						state.attributeIdMap[atr.id] = atr;
					}
					
					// process indexes
					for(const ind of rel.indexes) {
						state.indexIdMap[ind.id] = ind;
					}
				}
				
				// process icons
				for(const icon of mod.icons) {
					state.iconIdMap[icon.id] = icon;
				}
				
				// process forms
				for(let form of mod.forms) {
					form.query  = getQueryTemplateIfNull(form.query);
					form.fields = processFields(form.fields);
					
					state.formIdMap[form.id]   = form;
					mod.formNameMap[form.name] = form;
				}
				getFormIdsFromMenus(mod.menus);
				
				// process roles
				for(const role of mod.roles) {
					state.roleIdMap[role.id] = role;
				}
				
				// process collections
				for(let collection of mod.collections) {
					collection.query = getQueryTemplateIfNull(collection.query);
					
					state.collectionIdMap[collection.id] = collection;
				}
				
				// process PG functions
				for(const pgFunc of mod.pgFunctions) {
					state.pgFunctionIdMap[pgFunc.id] = pgFunc;
				}
				
				// process JS functions
				for(const jsFunc of mod.jsFunctions) {
					state.jsFunctionIdMap[jsFunc.id] = jsFunc;
				}
			}
		},
		languageCodes(state,payload) { state.languageCodes = payload; },
		timestamp    (state,payload) { state.timestamp     = payload; }
	},
	getters:{
		articleIdMap:       (state) => state.articleIdMap,
		attributeIdMap:     (state) => state.attributeIdMap,
		collectionIdMap:    (state) => state.collectionIdMap,
		formIdMap:          (state) => state.formIdMap,
		formIdMapMenu:      (state) => state.formIdMapMenu,
		iconIdMap:          (state) => state.iconIdMap,
		indexIdMap:         (state) => state.indexIdMap,
		jsFunctionIdMap:    (state) => state.jsFunctionIdMap,
		languageCodes:      (state) => state.languageCodes,
		modules:            (state) => state.modules,
		moduleIdMap:        (state) => state.moduleIdMap,
		moduleIdMapOptions: (state) => state.moduleIdMapOptions,
		moduleNameMap:      (state) => state.moduleNameMap,
		pgFunctionIdMap:    (state) => state.pgFunctionIdMap,
		presetIdMapRecordId:(state) => state.presetIdMapRecordId,
		relationIdMap:      (state) => state.relationIdMap,
		roleIdMap:          (state) => state.roleIdMap,
		timestamp:          (state) => state.timestamp
	}
};