import {hasAccessToRelation}         from './access.js';
import {getIndexAttributeId}         from './attribute.js';
import {getItemTitle}                from './builder.js';
import {getCollectionValues}         from './collection.js';
import {variableValueGet}            from './variable.js';
import MyStore                       from '../../stores/store.js';
import {
	checkDataOptions,
	filterOperatorIsSingleValue
} from './generic.js';
import {
	getUnixNowDate,
	getUnixNowDatetime,
	getUnixNowTime
} from './time.js';

let getQueryExpressionAttribute = function(column) {
	return {
		attributeId:column.attributeId,
		index:column.index,
		groupBy:column.groupBy,
		aggregator:column.aggregator,
		distincted:column.distincted
	};
};

// map of joins keyed by relation index
export function getJoinIndexMap(joins) {
	let map = {};
	for(const j of joins) {
		map[j.index] = j;
	}
	return map;
};
export function getJoinIndexMapExpanded(joins,indexMapRecordId,indexesNoDel,indexesNoSet,dataOptions) {
	let map = {};
	for(let j of joins) {
		const recordId = indexMapRecordId[j.index];
		j.recordId     = Number.isInteger(recordId) ? recordId : 0;
		j.recordNew    = j.applyCreate && checkDataOptions(4,dataOptions) && hasAccessToRelation(MyStore.getters.access,j.relationId,2);

		// states based on combined join settings, data option overwrite, user access, state of record on current join, protection setting of preset record (delete only)
		j.recordCreate = j.applyCreate && j.recordId === 0 && checkDataOptions(4,dataOptions) && hasAccessToRelation(MyStore.getters.access,j.relationId,2);
		j.recordUpdate = j.applyUpdate && j.recordId !== 0 && checkDataOptions(2,dataOptions) && hasAccessToRelation(MyStore.getters.access,j.relationId,2) && !indexesNoSet.includes(j.index);
		j.recordDelete = j.applyDelete && j.recordId !== 0 && checkDataOptions(1,dataOptions) && hasAccessToRelation(MyStore.getters.access,j.relationId,3) && !indexesNoDel.includes(j.index) &&
			MyStore.getters['schema/relationIdMap'][j.relationId].presets.filter(p => p.protected && MyStore.getters['schema/presetIdMapRecordId'][p.id] === j.recordId).length === 0;
		
		map[j.index] = j;
	}
	return map;
};

export function fillRelationRecordIds(joinsOrg) {
	// clone to not update referenced joins
	let joins = JSON.parse(JSON.stringify(joinsOrg));
	for(let i = 0, j = joins.length; i < j; i++) {
		joins[i].recordId = 0;
	}
	return joins;
};

export function getRelationsJoined(joins) {
	let out = [];
	for(const j of joins) {
		if(j.index === 0) // ignore source relation
			continue;
		
		out.push({
			attributeId:j.attributeId,
			index:j.index,
			indexFrom:j.indexFrom,
			connector:j.connector
		});
	}
	return out;
};

export function getQueryExpressions(columns) {
	let out = [];
	for(const c of columns) {
		if(!c.subQuery) {
			out.push(getQueryExpressionAttribute(c));
			continue;
		}
		
		// move expression aggregator to query (allows ORDER BY in aggregation)
		let expr = getQueryExpressionAttribute(c);
		expr.aggregator = null;
		
		out.push({
			aggregator:c.aggregator,
			query:{
				relationId:c.query.relationId,
				limit:c.query.fixedLimit,
				joins:c.query.joins,
				expressions:[expr],
				filters:c.query.filters,
				orders:c.query.orders
			}
		});
	}
	return out;
};

export function getQueryExpressionsDateRange(attributeId0,index0,attributeId1,index1,attributeIdColor,indexColor) {
	// fixed date range expressions
	let expr = [
		{ attributeId:attributeId0,index:index0,groupBy:false,aggregator:null },
		{ attributeId:attributeId1,index:index1,groupBy:false,aggregator:null }
	];
	
	// attribute color expression
	if(attributeIdColor !== null)
		expr.push({
			attributeId:attributeIdColor,
			index:indexColor,
			groupBy:false,
			aggregator:null
		});
	
	// add expressions from selected columns
	return expr;
};

export function getNestedIndexAttributeIdsByJoins(joins,nestingLevel,inclEncrypted) {
	let out = [];
	for(const join of joins) {
		let r = MyStore.getters['schema/relationIdMap'][join.relationId];
		
		for(const atr of r.attributes) {
			if(!atr.encrypted || inclEncrypted)
				out.push(`${nestingLevel}_${join.index}_${atr.id}`);
		}
	}
	return out;
};

export function getCaptionByIndexAttributeId(indexAttributeId) {
	let v = indexAttributeId.split('_');
	return getItemTitle(v[1],v[0],false,null);
};

export function getSubQueryFilterExpressions(subQuery) {
	return [{
		aggregator:subQuery.queryAggregator,
		attributeId:subQuery.attributeId,
		index:subQuery.attributeIndex
	}];
};

export function getQueryFiltersProcessed(filters,joinsIndexMap,globalSearch,globalSearchDict,
	dataFieldIdMap,fieldIdsChanged,fieldIdsInvalid,fieldValues,recordMayCreate,recordMayDelete,
	recordMayUpdate,collectionIdMapIndexFilter,variableIdMapLocal) {
	
	if(globalSearch               === undefined) globalSearch               = null;
	if(globalSearchDict           === undefined) globalSearchDict           = null;
	if(dataFieldIdMap             === undefined) dataFieldIdMap             = {};
	if(fieldIdsChanged            === undefined) fieldIdsChanged            = [];
	if(fieldIdsInvalid            === undefined) fieldIdsInvalid            = [];
	if(fieldValues                === undefined) fieldValues                = {};
	if(recordMayCreate            === undefined) recordMayCreate            = false;
	if(recordMayDelete            === undefined) recordMayDelete            = false;
	if(recordMayUpdate            === undefined) recordMayUpdate            = false;
	if(collectionIdMapIndexFilter === undefined) collectionIdMapIndexFilter = {};
	if(variableIdMapLocal         === undefined) variableIdMapLocal         = {};
	
	const getFilterSideProcessed = function(s,operator) {
		switch(s.content) {
			// data
			case 'collection':
				s.value = getCollectionValues(
					s.collectionId,
					s.columnId,
					filterOperatorIsSingleValue(operator),
					collectionIdMapIndexFilter[s.collectionId]);
			break;
			case 'subQuery':
				s.query.expressions = getSubQueryFilterExpressions(s);
				s.query.filters     = getQueryFiltersProcessed(
					s.query.filters,joinsIndexMap,globalSearch,globalSearchDict,dataFieldIdMap,
					fieldIdsChanged,fieldIdsInvalid,fieldValues,recordMayCreate,recordMayDelete,
					recordMayUpdate,collectionIdMapIndexFilter,variableIdMapLocal
				);
				s.query.limit = s.query.fixedLimit;
			break;
			case 'true':     s.value = true; break;
			case 'variable': s.value = variableValueGet(s.variableId,variableIdMapLocal); break;

			// global search
			case 'globalSearch':
				s.ftsDict = globalSearchDict;
				s.value   = globalSearch;
			break;
			
			// form
			case 'field':
				const fld = dataFieldIdMap[s.fieldId];
				if(fld !== undefined) {
					const atrIdNm = typeof fld.attributeIdNm !== 'undefined'
						? fld.attributeIdNm : null;
					
					s.value = JSON.parse(JSON.stringify(fieldValues[getIndexAttributeId(
						fld.index,fld.attributeId,fld.outsideIn === true,atrIdNm
					)]));
				}
			break;
			case 'fieldChanged':    s.value = fieldIdsChanged.includes(s.fieldId);                                    break;
			case 'fieldValid':      s.value = !fieldIdsInvalid.includes(s.fieldId);                                   break;
			case 'formChanged':     s.value = fieldIdsChanged.length !== 0;                                           break;
			case 'javascript':      s.value = Function(s.value)();                                                    break;
			case 'preset':          s.value = MyStore.getters['schema/presetIdMapRecordId'][s.presetId];              break;
			case 'record':          if(joinsIndexMap['0'] !== undefined) s.value = joinsIndexMap['0'].recordId;       break;
			case 'recordMayCreate': s.value = recordMayCreate;                                                        break;
			case 'recordMayDelete': s.value = recordMayDelete;                                                        break;
			case 'recordMayUpdate': s.value = recordMayUpdate;                                                        break;
			case 'recordNew':       if(joinsIndexMap['0'] !== undefined) s.value = joinsIndexMap['0'].recordId === 0; break;
			
			// login
			case 'languageCode': s.value = MyStore.getters.settings.languageCode;             break;
			case 'login':        s.value = MyStore.getters.loginId;                           break;
			case 'role':         s.value = MyStore.getters.access.roleIds.includes(s.roleId); break;
			
			// date & time
			case 'nowDate':     s.value = getUnixNowDate()     + s.nowOffset; break;
			case 'nowDatetime': s.value = getUnixNowDatetime() + s.nowOffset; break;
			case 'nowTime':     s.value = getUnixNowTime()     + s.nowOffset; break;
		}
		
		// remove unnecessary data
		if(s.content !== 'subQuery') {
			delete(s.query);
			delete(s.queryAggregator);
		} else {
			delete(s.query.choices);
			delete(s.query.fixedLimit);
			delete(s.query.id);
			delete(s.query.lookups);
		}
		delete(s.collectionId);
		delete(s.columnId);
		delete(s.content);
		delete(s.fieldId);
		delete(s.presetId);
		delete(s.roleId);
		delete(s.variableId);
		return s;
	};
	
	let out = [];
	filters = JSON.parse(JSON.stringify(filters));
	for(let f of filters) {
		f.side0 = getFilterSideProcessed(f.side0,f.operator);
		f.side1 = getFilterSideProcessed(f.side1,f.operator);
		out.push(f);
	}
	return getFiltersEncapsulated(out);
};

export function getQueryAttributePkFilter(relationId,recordId,index,not) {
	return {
		connector:'AND',
		index:0,
		operator:not ? '<>' : '=',
		side0:{
			attributeId:MyStore.getters['schema/relationIdMap'][relationId].attributeIdPk,
			attributeIndex:index,
			brackets:0
		},
		side1:{
			brackets:0,
			value:recordId
		}
	};
};

export function getQueryAttributesPkFilter(relationId,recordIds,index,not) {
	return {
		connector:'AND',
		index:0,
		operator:not ? '<> ALL' : '= ANY',
		side0:{
			attributeId:MyStore.getters['schema/relationIdMap'][relationId].attributeIdPk,
			attributeIndex:index,
			brackets:0
		},
		side1:{
			brackets:0,
			value:recordIds
		}
	};
};

export function getQueryTemplate() {
	return {
		id:'00000000-0000-0000-0000-000000000000',
		relationId:null,fixedLimit:0,joins:[],filters:[],orders:[],lookups:[],choices:[]
	};
};

export function getQueryTemplateIfNull(query) {
	return query === null ? getQueryTemplate() : query;
};

export function getQueryFilterNew() {
	return {
		connector:'AND',
		operator:'=',
		index:0,
		side0:{
			attributeId:null,
			attributeIndex:0,
			attributeNested:0,
			brackets:0,
			collectionId:null,
			columnId:null,
			content:'attribute',
			fieldId:null,
			ftsDict:null,
			query:null,
			queryAggregator:null,
			presetId:null,
			roleId:null,
			value:''
		},
		side1:{
			attributeId:null,
			attributeIndex:0,
			attributeNested:0,
			brackets:0,
			collectionId:null,
			columnId:null,
			content:'value',
			fieldId:null,
			ftsDict:null,
			query:null,
			queryAggregator:null,
			presetId:null,
			roleId:null,
			value:''
		}
	};
};

export function getQueryFiltersDateRange(subJoinFilter,attributeId0,index0,date0,attributeId1,index1,date1) {
	// set query filters for attribute date values (attribute 0 to 1) occuring in date range (date 0 to 1)
	// if sub join filter is used, we apply filter to relation joins, allowing for other relation data to be retrieved
	//  useful for queries where grouping data is to be received even if date dependent records are not there (like in Gantts)
	return [{
		connector:'AND',
		index:subJoinFilter ? index0 : 0,
		operator:'<=',
		side0:{
			attributeId:attributeId0,
			attributeIndex:index0
		},
		side1:{
			value:date1
		}
	},{
		connector:'AND',
		index:subJoinFilter ? index1 : 0,
		operator:'<=',
		side0:{
			value:date0
		},
		side1:{
			attributeId:attributeId1,
			attributeIndex:index1
		}
	}];
};

export function getFiltersEncapsulated(filters) {
	let filtersBase = filters.filter(v => v.index === 0);
	let filtersJoin = filters.filter(v => v.index !== 0);

	// add brackets to encapsulate filter set from other sets (query filters, quick filters, user filters, ...)
	// otherwise a single OR would negate all other filters
	if(filtersBase.length !== 0) {
		filtersBase[0].side0.brackets++;
		filtersBase[filtersBase.length-1].side1.brackets++;
	}
	return filtersBase.concat(filtersJoin);
};

export function getIsContentInAnyFilter(filters,columns,content) {
	for(const f of filters) {
		if(f.side0.content === content || f.side1.content === content)
			return true;

		if(f.side0.content === 'subQuery' && getIsContentInAnyFilter(f.side0.query.filters,[],content))
			return true;

		if(f.side1.content === 'subQuery' && getIsContentInAnyFilter(f.side1.query.filters,[],content))
			return true;
	}
	for(const c of columns) {
		if(c.subQuery && getIsContentInAnyFilter(c.query.filters,[],content))
			return true;
	}
	return false;
};

export function getIsOperatorInAnyFilter(filters,columns,operator) {
	for(const f of filters) {
		if(f.operator === operator)
			return true;

		if(f.side0.content === 'subQuery' && getIsOperatorInAnyFilter(f.side0.query.filters,[],operator))
			return true;

		if(f.side1.content === 'subQuery' && getIsOperatorInAnyFilter(f.side1.query.filters,[],operator))
			return true;
	}
	for(const c of columns) {
		if(c.subQuery && getIsOperatorInAnyFilter(c.query.filters,[],operator))
			return true;
	}
	return false;
};