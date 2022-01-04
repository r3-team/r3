export {MyStoreSchema as default};

const MyStoreSchema = {
	namespaced:true,
	state:{
		// unix timestamp of loaded schema
		timestamp:-1,
		
		// cache content
		modules:[],             // all modules with everything beneath them
		moduleIdMapOptions:{},  // instance options for all modules, key: module ID
		presetIdMapRecordId:{}, // preset map (key=preset ID, value = record ID)
		
		// references to specific entities
		attributeIdMap:{},
		formIdMap:{},
		iconIdMap:{},
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
				for(let i = 0, j = menus.length; i < j; i++) {
					
					state.formIdMapMenu[menus[i].formId] = menus[i];
					getFormIdsFromMenus(menus[i].menus);
				}
			};
			
			// reset state
			state.modules         = payload.modules;
			state.attributeIdMap  = {};
			state.moduleIdMap     = {};
			state.moduleNameMap   = {};
			state.formIdMap       = {};
			state.formIdMapMenu   = {};
			state.iconIdMap       = {};
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
			for(let i = 0, j = state.modules.length; i < j; i++) {
				let mod = state.modules[i];
				mod.formNameMap = {};
				
				state.moduleIdMap[mod.id]     = mod;
				state.moduleNameMap[mod.name] = mod;
				
				// process languages
				for(let x = 0, y = mod.languages.length; x < y; x++) {
					
					if(state.languageCodes.indexOf(mod.languages[x]) === -1)
						state.languageCodes.push(mod.languages[x]);
				}
				
				// process relations
				for(let x = 0, y = mod.relations.length; x < y; x++) {
					let rel = mod.relations[x];
					
					state.relationIdMap[rel.id] = rel;
					
					// process attributes
					for(let a = 0, b = rel.attributes.length; a < b; a++) {
						state.attributeIdMap[rel.attributes[a].id] = rel.attributes[a];
					}
				}
				
				// process icons
				for(let x = 0, y = mod.icons.length; x < y; x++) {
					state.iconIdMap[mod.icons[x].id] = mod.icons[x];
				}
				
				// process forms
				for(let x = 0, y = mod.forms.length; x < y; x++) {
					state.formIdMap[mod.forms[x].id]   = mod.forms[x];
					mod.formNameMap[mod.forms[x].name] = mod.forms[x];
				}
				getFormIdsFromMenus(mod.menus);
				
				// process roles
				for(let x = 0, y = mod.roles.length; x < y; x++) {
					state.roleIdMap[mod.roles[x].id] = mod.roles[x];
				}
				
				// process PG functions
				for(let x = 0, y = mod.pgFunctions.length; x < y; x++) {
					state.pgFunctionIdMap[mod.pgFunctions[x].id] = mod.pgFunctions[x];
				}
				
				// process JS functions
				for(let x = 0, y = mod.jsFunctions.length; x < y; x++) {
					state.jsFunctionIdMap[mod.jsFunctions[x].id] = mod.jsFunctions[x];
				}
			}
		},
		languageCodes(state,payload) { state.languageCodes = payload; },
		timestamp    (state,payload) { state.timestamp     = payload; }
	},
	getters:{
		attributeIdMap:     (state) => state.attributeIdMap,
		formIdMap:          (state) => state.formIdMap,
		formIdMapMenu:      (state) => state.formIdMapMenu,
		iconIdMap:          (state) => state.iconIdMap,
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