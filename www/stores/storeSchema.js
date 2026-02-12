export default {
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
		docIdMap:{},
		formIdMap:{},
		iconIdMap:{},
		indexIdMap:{},
		jsFunctionIdMap:{},
		loginFormIdMap:{},
		moduleIdMap:{},
		moduleNameMap:{},
		pgFunctionIdMap:{},
		pgTriggerIdMap:{},
		presetIdMap:{},
		relationIdMap:{},
		roleIdMap:{},
		searchBarIdMap:{},
		variableIdMap:{},
		widgetIdMap:{},
		
		// computed
		formIdMapMenu:{}
	},
	mutations:{
		delModule(s,p) {
			// just delete module reference
			// lingering module entity references (forms, roles, etc.) do not hurt and are gone on next app start
			delete(s.moduleIdMap[p]);
		},
		setModules(s,p) {
			const getFormIdsFromMenus = menus => {
				for(const menu of menus) {
					s.formIdMapMenu[menu.formId] = menu;
					getFormIdsFromMenus(menu.menus);
				}
			};
			
			for(let mod of p) {
				mod.formNameMap = {};
				
				s.moduleIdMap[mod.id]     = mod;
				s.moduleNameMap[mod.name] = mod;
				
				// process articles
				for(const art of mod.articles) {
					s.articleIdMap[art.id] = art;
				}
				
				// process relations
				for(const rel of mod.relations) {
					s.relationIdMap[rel.id] = rel;
					
					// process attributes
					for(const atr of rel.attributes) {
						s.attributeIdMap[atr.id] = atr;
					}
					
					// process indexes
					for(const ind of rel.indexes) {
						s.indexIdMap[ind.id] = ind;
					}

					// process presets
					for(const pre of rel.presets) {
						s.presetIdMap[pre.id] = pre;
					}
				}
				
				// process PG triggers
				for(const trg of mod.pgTriggers) {
					s.pgTriggerIdMap[trg.id] = trg;
				}
				
				// process icons
				for(const icon of mod.icons) {
					s.iconIdMap[icon.id] = icon;
				}
				
				// process forms
				for(let form of mod.forms) {
					s.formIdMap[form.id]   = form;
					mod.formNameMap[form.name] = form;
				}
				for(const mt of mod.menuTabs) {
					getFormIdsFromMenus(mt.menus);
				}
				
				// process roles
				for(const role of mod.roles) {
					s.roleIdMap[role.id] = role;
				}
				
				// process search bars
				for(const bar of mod.searchBars) {
					s.searchBarIdMap[bar.id] = bar;
				}
				
				// process collections
				for(let collection of mod.collections) {
					s.collectionIdMap[collection.id] = collection;
				}
				
				// process APIs
				for(let api of mod.apis) {
					s.apiIdMap[api.id] = api;
				}
				
				// process documents
				for(let doc of mod.docs) {
					s.docIdMap[doc.id] = doc;
				}
				
				// process client events
				for(const clientEvent of mod.clientEvents) {
					s.clientEventIdMap[clientEvent.id] = clientEvent;
				}

				// process variables
				for(const variable of mod.variables) {
					s.variableIdMap[variable.id] = variable;
				}
				
				// process widgets
				for(const widget of mod.widgets) {
					s.widgetIdMap[widget.id] = widget;
				}
				
				// process PG functions
				for(const pgFunc of mod.pgFunctions) {
					s.pgFunctionIdMap[pgFunc.id] = pgFunc;
				}
				
				// process JS functions
				for(const jsFunc of mod.jsFunctions) {
					s.jsFunctionIdMap[jsFunc.id] = jsFunc;
				}
				
				// process login forms
				for(const loginForm of mod.loginForms) {
					s.loginFormIdMap[loginForm.id] = loginForm;
				}
			}
		},
		languageCodes:      (s,p) => s.languageCodes       = p,
		presetIdMapRecordId:(s,p) => s.presetIdMapRecordId = p
	},
	getters:{
		apiIdMap:           s => s.apiIdMap,
		articleIdMap:       s => s.articleIdMap,
		attributeIdMap:     s => s.attributeIdMap,
		clientEventIdMap:   s => s.clientEventIdMap,
		collectionIdMap:    s => s.collectionIdMap,
		docIdMap:           s => s.docIdMap,
		formIdMap:          s => s.formIdMap,
		formIdMapMenu:      s => s.formIdMapMenu,
		iconIdMap:          s => s.iconIdMap,
		indexIdMap:         s => s.indexIdMap,
		jsFunctionIdMap:    s => s.jsFunctionIdMap,
		languageCodes:      s => s.languageCodes,
		loginFormIdMap:     s => s.loginFormIdMap,
		moduleIdMap:        s => s.moduleIdMap,
		moduleNameMap:      s => s.moduleNameMap,
		pgFunctionIdMap:    s => s.pgFunctionIdMap,
		pgTriggerIdMap:     s => s.pgTriggerIdMap,
		presetIdMap:        s => s.presetIdMap,
		presetIdMapRecordId:s => s.presetIdMapRecordId,
		relationIdMap:      s => s.relationIdMap,
		roleIdMap:          s => s.roleIdMap,
		searchBarIdMap:     s => s.searchBarIdMap,
		variableIdMap:      s => s.variableIdMap,
		widgetIdMap:        s => s.widgetIdMap,
		
		languageCodesModules:s => {
			let out = [];
			for(const k in s.moduleIdMap) {
				for(const lang of s.moduleIdMap[k].languages) {
					if(!s.languageCodes.includes(lang))
						out.push(lang);
				}
			}
			return out;
		},
		modules:s => {
			const getCombinedName = m => m.parentId === null ? m.name : `${s.moduleIdMap[m.parentId].name}_${m.name}`;
			return Object.values(s.moduleIdMap).sort((a,b) => getCombinedName(a) < getCombinedName(b) ? -1 : 1);
		}
	}
};