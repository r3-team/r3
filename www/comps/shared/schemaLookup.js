import {getDependentOnModules} from './builder.js';
//import MyStore               from '../../stores/store.js';

const entities = ['attribute','jsFunction','pgFunction','relation'];

export function getHasAnyReferences(moduleSource,entity,entityId) {
	const o = getReferences(moduleSource,entity,entityId);
	return Object.keys(o).length !== 0;
};

// goes through the given module and its dependencies
// finds all references for chosen entity
// returns object with lookup results
export function getReferences(moduleSource,entity,entityId) {
	if(!entities.includes(entity)) {
		console.warn(`invalid entity for schema lookup: '${entity}'`);
		return [];
	}

	let moduleIdMapLookups = {};
	for(const mod of getDependentOnModules(moduleSource)) {

		let lookups = {
			anyResults:false,

			// module definitions
			moduleClientEvents:false,
			moduleFncLoginSync:false,
			moduleFncOnLogin:false,

			// main elements
			apiIds:[],
			collectionIds:[],
			docIds:[],
			jsFunctionIds:[],
			pgFunctionIds:[],
			pgIndexIds:[],
			pgTriggerIds:[],
			searchBarIds:[],

			// relations matched in relationships
			relationIdsShips:[],

			// forms if any sub elements match
			formIdsActions:[],
			formIdsFunctions:[],
			formIdsQuery:[],

			// sub elements in forms
			formIdMapFieldIds:{}
		};

		switch(entity) {
			case 'attribute':  getReferencesAttribut(mod,entityId,lookups);   break;
			case 'jsFunction': getReferencesJsFunction(mod,entityId,lookups); break;
			case 'pgFunction': getReferencesPgFunction(mod,entityId,lookups); break;
			case 'relation':   getReferencesRelation(mod,entityId,lookups);   break;
		}

		if(lookups.anyResults) {
			delete(lookups.anyResults);
			moduleIdMapLookups[mod.id] = lookups;
		}
	}
	return moduleIdMapLookups;
};

function getReferencesRelation(mod,relId,lookups) {
	const isInQuery = query =>
		query !== null && (
			query.relationId === relId ||
			isInFilters(query.filters) ||
			query.joins.some(v => v.relationId === relId) ||
			query.choices.some(v => isInFilters(v.filters))
		);
	const isInColumns = columns => columns.some(v => v.content === 'query' && isInQuery(v.query));
	const isInFilters = filters => filters.some(v => isInQuery(v.side0.query) || isInQuery(v.side1.query));
	
	const lookupInFields = (formId,fields) => {
		const add = fieldId => {
			if(lookups.formIdMapFieldIds[formId] === undefined)
				lookups.formIdMapFieldIds[formId] = [];
	
			lookups.formIdMapFieldIds[formId].push(fieldId);
			lookups.anyResults = true;
		};

		for(const f of fields) {
			switch(f.content) {
				case 'calendar': // fallthrough
				case 'chart':    // fallthrough
				case 'kanban':   // fallthrough
				case 'list':     // fallthrough 
				case 'variable':
					if(isInQuery(f.query) || isInColumns(f.columns))
						add(f.id);
				break;
				case 'data':
					if(f.outsideIn !== undefined && (isInQuery(f.query) || isInColumns(f.columns)))
						add(f.id);
				break;
				case 'container':
					lookupInFields(formId,f.fields);
				break;
				case 'tabs':
					for(const t of f.tabs) {
						lookupInFields(formId,t.fields);
					}
				break;
			}
		}
	};
	
	// triggers, indexes & presets cascade with relation deletion
	// checking for these references is as easy as clicking on the trigger/index/preset tab

	for(const a of mod.apis) {
		if(isInQuery(a.query) || isInColumns(a.columns)) {
			lookups.apiIds.push(a.id);
			lookups.anyResults = true;
		}
	}
	for(const r of mod.relations) {
		if(r.attributes.some(v => v.relationshipId === relId && v.relationId !== relId)) {
			lookups.relationIdsShips.push(r.id);
			lookups.anyResults = true;
		}
	}
	for(const c of mod.collections) {
		if(isInQuery(c.query) || isInColumns(c.columns)) {
			lookups.collectionIds.push(c.id);
			lookups.anyResults = true;
		}
	}
	for(const f of mod.forms) {
		if(isInQuery(f.query)) {
			lookups.formIdsQuery.push(f.id);
			lookups.anyResults = true;
		}
		lookupInFields(f.id,f.fields);
	}
	for(const f of mod.pgFunctions) {
		if(f.codeFunction.includes(`}.[${relId}]`)) {
			lookups.pgFunctionIds.push(f.id);
			lookups.anyResults = true;
		}
	}
	for(const s of mod.searchBars) {
		if(isInQuery(s.query) || isInColumns(s.columns)) {
			lookups.searchBarIds.push(s.id);
			lookups.anyResults = true;
		}
	}
};

function getReferencesJsFunction(mod,fncId,lookups) {

	const lookupInFields = (formId,fields) => {
		const add = fieldId => {
			if(lookups.formIdMapFieldIds[formId] === undefined)
				lookups.formIdMapFieldIds[formId] = [];
	
			lookups.formIdMapFieldIds[formId].push(fieldId);
			lookups.anyResults = true;
		};

		for(const f of fields) {
			switch(f.content) {
				case 'button': // fallthrough
				case 'data':   // fallthrough
				case 'variable':
					if(f.jsFunctionId === fncId)
						add(f.id);
				break;
				case 'container':
					lookupInFields(formId,f.fields);
				break;
				case 'tabs':
					for(const t of f.tabs) {
						lookupInFields(formId,t.fields);
					}
				break;
			}
		}
	};

	for(const f of mod.jsFunctions) {
		if(f.codeFunction.includes(`.call_frontend('${fncId}'`)) {
			lookups.jsFunctionIds.push(f.id);
			lookups.anyResults = true;
		}
	}
	for(const e of mod.clientEvents) {
		if(e.jsFunctionId === fncId) {
			lookups.moduleClientEvents = true;
			lookups.anyResults = true;
			break;
		}
	}
	for(const f of mod.forms) {
		if(f.actions.some(v => v.jsFunctionId === fncId)) {
			lookups.formIdsActions.push(f.id);
			lookups.anyResults = true;
		}
		if(f.functions.some(v => v.jsFunctionId === fncId)) {
			lookups.formIdsFunctions.push(f.id);
			lookups.anyResults = true;
		}
		lookupInFields(f.id,f.fields);
	}
	if(mod.jsFunctionIdOnLogin === fncId) {
		lookups.moduleFncOnLogin = true;
		lookups.anyResults = true;
	}
};

function getReferencesPgFunction(mod,fncId,lookups) {
	const isInColumns = columns => columns.some(v => v.pgFunctionId === fncId);
	const lookupInFields = (formId,fields) => {
		const add = fieldId => {
			if(lookups.formIdMapFieldIds[formId] === undefined)
				lookups.formIdMapFieldIds[formId] = [];
	
			lookups.formIdMapFieldIds[formId].push(fieldId);
			lookups.anyResults = true;
		};

		for(const f of fields) {
			switch(f.content) {
				case 'calendar':
					if(isInColumns(f.columns))
						add(f.id);
				break;
				case 'chart':
					if(isInColumns(f.columns))
						add(f.id);
				break;
				case 'container':
					lookupInFields(formId,f.fields);
				break;
				case 'data':
					if(f.columns !== undefined && isInColumns(f.columns))
						add(f.id);
				break;
				case 'kanban': 
					if(isInColumns(f.columns))
						add(f.id);
				break;
				case 'list':
					if(isInColumns(f.columns))
						add(f.id);
				break;
				case 'tabs':
					for(const t of f.tabs) {
						lookupInFields(formId,t.fields);
					}
				break;
			}
		}
	};

	for(const f of mod.pgFunctions) {
		if(f.codeFunction.includes(`.[${fncId}](`)) {
			lookups.pgFunctionIds.push(f.id);
			lookups.anyResults = true;
		}
	}
	for(const f of mod.jsFunctions) {
		if(f.codeFunction.includes(`.call_backend('${fncId}'`)) {
			lookups.jsFunctionIds.push(f.id);
			lookups.anyResults = true;
		}
	}
	for(const t of mod.pgTriggers) {
		if(t.pgFunctionId === fncId) {
			lookups.pgTriggerIds.push(t.id);
			lookups.anyResults = true;
		}
	}
	for(const e of mod.clientEvents) {
		if(e.pgFunctionId === fncId) {
			lookups.moduleClientEvents = true;
			lookups.anyResults = true;
			break;
		}
	}
	if(mod.pgFunctionIdLoginSync === fncId) {
		lookups.moduleFncLoginSync = true;
		lookups.anyResults = true;
	}
	for(const f of mod.forms) {
		lookupInFields(f.id,f.fields);
	}
};

function getReferencesAttribut(mod,atrId,lookups) {
	const isInColumns = columns => columns.some(v => v.attributeId === atrId
		|| (v.content === 'query'      && isInQuery(v.query))
		|| (v.content === 'fnc_pg'     && v.arguments.some(a => a.attributeId === atrId))
		|| (v.content === 'fnc_scalar' && v.arguments.some(a => a.attributeId === atrId))
	);
	const isInFilters = filters =>
		filters.some(v =>
			v.side0.attributeId === atrId ||
			v.side1.attributeId === atrId ||
			isInQuery(v.side0.query) ||
			isInQuery(v.side1.query)
		);
	
	const isInQuery = query =>
		query !== null && (
			isInFilters(query.filters) ||
			query.choices.some(v => isInFilters(v.filters)) ||
			query.joins.some(v => v.attributeId === atrId) ||
			query.orders.some(v => v.attributeId === atrId)
		);
	
	const lookupInFields = (formId,fields) => {
		const add = fieldId => {
			if(lookups.formIdMapFieldIds[formId] === undefined)
				lookups.formIdMapFieldIds[formId] = [];
	
			lookups.formIdMapFieldIds[formId].push(fieldId);
			lookups.anyResults = true;
		};

		for(const f of fields) {
			switch(f.content) {
				case 'calendar':
					if(f.attributeIdDate0 === atrId || f.attributeIdDate1 === atrId || f.attributeIdColor === atrId || isInQuery(f.query) || isInColumns(f.columns))
						add(f.id);
				break;
				case 'chart':
					if(isInQuery(f.query) || isInColumns(f.columns))
						add(f.id);
				break;
				case 'container':
					lookupInFields(formId,f.fields);
				break;
				case 'data':
					if(f.attributeId === atrId || f.attributeIdAlt === atrId)
						add(f.id);

					if(f.outsideIn !== undefined && (f.attributeIdNm === atrId || isInQuery(f.query) || isInColumns(f.columns)))
						add(f.id);
				break;
				case 'kanban': 
					if(f.attributeIdSort === atrId || isInQuery(f.query) || isInColumns(f.columns))
						add(f.id);
				break;
				case 'list':
					if(isInQuery(f.query) || isInColumns(f.columns))
						add(f.id);
				break;
				case 'tabs':
					for(const t of f.tabs) {
						lookupInFields(formId,t.fields);
					}
				break;
			}
		}
	};

	const isInDocColumns = columns => columns.some(v => v.attributeId === atrId
		|| (v.subQuery && isInQuery(v.query))
		|| v.setsBody.some(s => s.attributeId === atrId)
		|| v.setsFooter.some(s => s.attributeId === atrId)
		|| v.setsHeader.some(s => s.attributeId === atrId));
	
	const isInDocField = field => {
		if(field.sets.some(v => v.attributeId === atrId))
			return true;

		switch(field.content) {
			case 'data': return field.attributeId === atrId; break;
			case 'list': return isInDocColumns(field.columns) || isInQuery(field.query); break;
			case 'grid':       // fallthrough
			case 'gridFooter': // fallthrough
			case 'gridHeader': // fallthrough
			case 'flowBody':   // fallthrough
			case 'flow':
				for(const f of field.fields) {
					if(isInDocField(f))
						return true;
				}
			break;
		}
		return false;
	};

	// go through main entities
	for(const a of mod.apis) {
		if(isInQuery(a.query) || isInColumns(a.columns)) {
			lookups.apiIds.push(a.id);
			lookups.anyResults = true;
		}
	}
	for(const c of mod.collections) {
		if(isInQuery(c.query) || isInColumns(c.columns)) {
			lookups.collectionIds.push(c.id);
			lookups.anyResults = true;
		}
	}
	for(const f of mod.pgFunctions) {
		if(f.codeFunction.includes(`(${atrId})`)) {
			lookups.pgFunctionIds.push(f.id);
			lookups.anyResults = true;
		}
	}
	for(const s of mod.searchBars) {
		if(isInQuery(s.query) || isInColumns(s.columns)) {
			lookups.searchBarIds.push(s.id);
			lookups.anyResults = true;
		}
	}
	for(const r of mod.relations) {
		for(const pgi of r.indexes) {
			if(!pgi.autoFki && !pgi.primaryKey && pgi.attributes.some(v => v.attributeId === atrId)) {
				lookups.pgIndexIds.push(pgi.id);
				lookups.anyResults = true;
			}
		}
	}
	for(const f of mod.forms) {
		if(isInQuery(f.query)) {
			lookups.formIdsQuery.push(f.id);
			lookups.anyResults = true;
		}
		lookupInFields(f.id,f.fields);
	}
	for(const d of mod.docs) {
		if
			(isInQuery(d.query) ||
			d.sets.some(v => v.attributeId === atrId) ||
			d.states.some(v => v.conditions.some(c => c.side0.attributeId === atrId || c.side1.attributeId === atrId)) ||
			d.pages.some(v =>
				v.sets.some(s => s.attributeId === atrId) ||
				isInDocField(v.fieldFlow) ||
				(v.header.active && isInDocField(v.header.fieldGrid)) ||
				(v.footer.active && isInDocField(v.footer.fieldGrid))
			)
		) {
			lookups.docIds.push(d.id);
			lookups.anyResults = true;
		}
	}
};