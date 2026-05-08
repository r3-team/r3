import {getDependentOnModules} from './builder.js';
//import MyStore               from '../../stores/store.js';

const entities = ['attribute'];

// goes through the given module and its dependencies
export function lookupReferences(moduleSource,entity,entityId) {
	if(!entities.includes(entity)) {
		console.warn(`invalid entity for schema lookup: '${entity}'`);
		return [];
	}

	let moduleIdMapLookups = {};
	for(const mod of getDependentOnModules(moduleSource)) {

		let lookups = {
			anyResults:false,

			// main elements
			docIds:[],
			formIds:[],
			//jsFunctionIds:[],
			pgFunctionIds:[],
			pgIndexIds:[],
			searchBarIds:[],

			// sub elements in docs
			docIdMapStateIds:{},

			// sub elements in forms
			//formIdMapActionIds:{},
			//formIdMapStateIds:{},
			formIdMapFieldIds:{}
		};

		switch(entity) {
			case 'attribute': lookupReferencesAttribut(mod,entityId,lookups); break;
		}

		if(lookups.anyResults) {
			delete(lookups.anyResults);
			moduleIdMapLookups[mod.id] = lookups;
		}
	}
	return moduleIdMapLookups;
};

export function lookupReferencesAttribut(mod,atrId,lookups) {
	const isInColumns = columns => columns.some(v => v.attributeId === atrId || (v.subQuery && isInQuery(v.query,atrId)));
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

	// go through main entities
	for(const f of mod.pgFunctions) {
		if(f.codeFunction.includes(`(${atrId})`)) {
			lookups.pgFunctionIds.push(f.id);
			lookups.anyResults = true;
		}
	}
	for(const s of mod.searchBars) {
		if(isInQuery(s.query) || isInColumns(s.columns,atrId)) {
			lookups.searchBarIds.push(s.id);
			lookups.anyResults = true;
		}
	}
	for(const r of mod.relations) {
		for(const pgi of r.indexes) {
			if(pgi.attributes.some(v => v.attributeId === atrId)) {
				lookups.pgIndexIds.push(pgi.id);
				lookups.anyResults = true;
			}
		}
	}
	for(const f of mod.forms) {
		if(isInQuery(f.query)) {
			lookups.formIds.push(f.id);
			lookups.anyResults = true;
		}

		lookupInFields(f.id,f.fields);
	}
	for(const d of mod.docs) {
		if(isInQuery(d.query)) {
			lookups.docIds.push(d.id);
			lookups.anyResults = true;
		}

		// doc fields
		// doc states
	}
};

export function lookupByName(moduleIdSource) {

};