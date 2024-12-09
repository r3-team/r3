import {getQueryTemplateIfNull} from '../comps/shared/query.js';
export {MyStoreSchema as default};

const MyStoreSchema = {
	namespaced:true,
	state:{
		languageCodes:[],       // language codes available, both official & community
		presetIdMapRecordId:{}, // record IDs by preset, key: preset ID
		
		// references to specific module entities
		apiIdMap:{},
		articleIdMap:{},
		attributeIdMap:{},
		clientEventIdMap:{},
		collectionIdMap:{},
		formIdMap:{},
		iconIdMap:{},
		indexIdMap:{},
		jsFunctionIdMap:{},
		loginFormIdMap:{},
		moduleIdMap:{},
		moduleNameMap:{},
		pgFunctionIdMap:{},
		pgTriggerIdMap:{},
		relationIdMap:{},
		roleIdMap:{},
		variableIdMap:{},
		widgetIdMap:{},
		
		// computed
		formIdMapMenu:{}
	},
	mutations:{
		delModule(state,payload) {
			// just delete module reference
			// lingering module entity references (forms, roles, etc.) do not hurt and are gone on next app start
			delete(state.moduleIdMap[payload]);
		},
		setModules(state,payload) {
			const getFormIdsFromMenus = (menus) => {
				for(const menu of menus) {
					state.formIdMapMenu[menu.formId] = menu;
					getFormIdsFromMenus(menu.menus);
				}
			};
			const processFields = (fields) => {
				for(let i = 0, j = fields.length; i < j; i++) {
					if(typeof fields[i].query !== 'undefined')
						fields[i].query = getQueryTemplateIfNull(fields[i].query);
					
					switch(fields[i].content) {
						case 'container': fields[i].fields = processFields(fields[i].fields); break;
						case 'tabs':
							for(let x = 0, y = fields[i].tabs.length; x < y; x++) {
								fields[i].tabs[x].fields = processFields(fields[i].tabs[x].fields);
							}
						break;
					}
				}
				return fields;
			};
			
			for(let mod of payload) {
				mod.formNameMap = {};
				
				state.moduleIdMap[mod.id]     = mod;
				state.moduleNameMap[mod.name] = mod;
				
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
				
				// process PG triggers
				for(const trg of mod.pgTriggers) {
					state.pgTriggerIdMap[trg.id] = trg;
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
				
				// process APIs
				for(let api of mod.apis) {
					api.query = getQueryTemplateIfNull(api.query);
					
					state.apiIdMap[api.id] = api;
				}
				
				// process client events
				for(const clientEvent of mod.clientEvents) {
					state.clientEventIdMap[clientEvent.id] = clientEvent;
				}

				// process variables
				for(const variable of mod.variables) {
					state.variableIdMap[variable.id] = variable;
				}
				
				// process widgets
				for(const widget of mod.widgets) {
					state.widgetIdMap[widget.id] = widget;
				}
				
				// process PG functions
				for(const pgFunc of mod.pgFunctions) {
					state.pgFunctionIdMap[pgFunc.id] = pgFunc;
				}
				
				// process JS functions
				for(const jsFunc of mod.jsFunctions) {
					state.jsFunctionIdMap[jsFunc.id] = jsFunc;
				}
				
				// process login forms
				for(const loginForm of mod.loginForms) {
					state.loginFormIdMap[loginForm.id] = loginForm;
				}
			}
		},
		languageCodes:      (state,payload) => state.languageCodes       = payload,
		presetIdMapRecordId:(state,payload) => state.presetIdMapRecordId = payload
	},
	getters:{
		apiIdMap:           (state) => state.apiIdMap,
		articleIdMap:       (state) => state.articleIdMap,
		attributeIdMap:     (state) => state.attributeIdMap,
		clientEventIdMap:   (state) => state.clientEventIdMap,
		collectionIdMap:    (state) => state.collectionIdMap,
		formIdMap:          (state) => state.formIdMap,
		formIdMapMenu:      (state) => state.formIdMapMenu,
		iconIdMap:          (state) => state.iconIdMap,
		indexIdMap:         (state) => state.indexIdMap,
		jsFunctionIdMap:    (state) => state.jsFunctionIdMap,
		languageCodes:      (state) => state.languageCodes,
		loginFormIdMap:     (state) => state.loginFormIdMap,
		moduleIdMap:        (state) => state.moduleIdMap,
		moduleNameMap:      (state) => state.moduleNameMap,
		pgFunctionIdMap:    (state) => state.pgFunctionIdMap,
		pgTriggerIdMap:     (state) => state.pgTriggerIdMap,
		presetIdMapRecordId:(state) => state.presetIdMapRecordId,
		relationIdMap:      (state) => state.relationIdMap,
		roleIdMap:          (state) => state.roleIdMap,
		variableIdMap:      (state) => state.variableIdMap,
		widgetIdMap:        (state) => state.widgetIdMap,
		
		languageCodesModules:(state) => {
			let out = [];
			for(const k in state.moduleIdMap) {
				for(const lang of state.moduleIdMap[k].languages) {
					if(!state.languageCodes.includes(lang))
						out.push(lang);
				}
			}
			return out;
		},
		modules:(state) => {
			const getCombinedName = (m) => m.parentId === null ? m.name : `${state.moduleIdMap[m.parentId].name}_${m.name}`;
			return Object.values(state.moduleIdMap).sort((a,b) => getCombinedName(a) < getCombinedName(b) ? -1 : 1);
		}
	}
};