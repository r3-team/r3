import {getIndexAttributeId}         from './attribute.js';
import {getItemTitle}                from './builder.js';
import {getCollectionValues}         from './collection.js';
import {filterOperatorIsSingleValue} from './generic.js';
import MyStore                       from '../../stores/store.js';
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
export function getJoinsIndexMap(joins) {
	let map = {};
	for(const j of joins) {
		map[j.index] = j;
	}
	return map;
};
export function getJoinIndexMapExpanded(joins,indexMapRecordId,indexesNoDel,indexesNoSet) {
	let map = {};
	for(let j of joins) {
		const recordId = indexMapRecordId[j.index];
		j.recordId     = Number.isInteger(recordId) ? recordId : 0;
		j.recordNoDel  = indexesNoDel.includes(j.index);
		j.recordNoSet  = indexesNoSet.includes(j.index);
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

export function getQueryFiltersProcessed(filters,joinsIndexMap,dataFieldIdMap,
	fieldIdsChanged,fieldIdsInvalid,fieldValues,collectionIdMapIndexFilter,variableIdMapLocal) {
	
	if(typeof dataFieldIdMap             === 'undefined') dataFieldIdMap             = {};
	if(typeof fieldIdsChanged            === 'undefined') fieldIdsChanged            = [];
	if(typeof fieldIdsInvalid            === 'undefined') fieldIdsInvalid            = [];
	if(typeof fieldValues                === 'undefined') fieldValues                = {};
	if(typeof collectionIdMapIndexFilter === 'undefined') collectionIdMapIndexFilter = {};
	if(typeof variableIdMapLocal         === 'undefined') variableIdMapLocal         = {};
	
	let getFilterSideProcessed = function(s,operator) {
		switch(s.content) {
			// data
			case 'collection':
				s.value = getCollectionValues(
					s.collectionId,
					s.columnId,
					filterOperatorIsSingleValue(operator),
					collectionIdMapIndexFilter[s.collectionId]);
			break;
			case 'preset':
				s.value = MyStore.getters['schema/presetIdMapRecordId'][s.presetId];
			break;
			case 'subQuery':
				s.query.expressions = getSubQueryFilterExpressions(s);
				s.query.filters     = getQueryFiltersProcessed(
					s.query.filters,joinsIndexMap,dataFieldIdMap,
					fieldIdsChanged,fieldIdsInvalid,fieldValues,
					collectionIdMapIndexFilter,variableIdMapLocal
				);
				s.query.limit = s.query.fixedLimit;
			break;
			case 'true': s.value = true; break;
			case 'variable':
				if(variableIdMapLocal[s.variableId] !== undefined) {
					s.value = variableIdMapLocal[s.variableId];
				}
				else if(MyStore.getters.variableIdMapGlobal[s.variableId] !== undefined) {
					s.value = MyStore.getters.variableIdMapGlobal[s.variableId];
				}
				else {
					s.value = null;
				}
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
			case 'fieldChanged': s.value = fieldIdsChanged.includes(s.fieldId);  break;
			case 'fieldValid':   s.value = !fieldIdsInvalid.includes(s.fieldId); break;
			case 'formChanged':  s.value = fieldIdsChanged.length !== 0;         break;
			case 'javascript':   s.value = Function(s.value)();                  break;
			case 'record':       if(typeof joinsIndexMap['0'] !== 'undefined') s.value = joinsIndexMap['0'].recordId;       break;
			case 'recordNew':    if(typeof joinsIndexMap['0'] !== 'undefined') s.value = joinsIndexMap['0'].recordId === 0; break;
			
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

export function getJoinIndexMap(joins) {
	let map = {};
	for(let i = 0, j = joins.length; i < j; i++) {
		map[joins[i].index] = joins[i];
	}
	return map;
};

export function getQueryAttributePkFilter(relationId,recordId,index,not) {
	return {
		connector:'AND',
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

export function getQueryFiltersDateRange(attributeId0,index0,date0,attributeId1,index1,date1) {
	// set query filters for records which attribute value range (attribute 0 to 1)
	//  occur within defined date range (date 0 to 1)
	return [{
		connector:'AND',
		operator:'<=',
		side0:{
			attributeId:attributeId0,
			attributeIndex:index0,
			brackets:1
		},
		side1:{
			brackets:0,
			value:date1
		}
	},{
		connector:'AND',
		operator:'<=',
		side0:{
			brackets:0,
			value:date0
		},
		side1:{
			attributeId:attributeId1,
			attributeIndex:index1,
			brackets:1
		}
	}];
};

export function getFiltersEncapsulated(filters) {
	// add brackets to encapsulate a filter set from other filter sets
	//  some sets: query filters, quick filters, custom user filters
	// otherwise a single OR would negate all other filters
	if(filters.length !== 0) {
		filters[0].side0.brackets++;
		filters[filters.length-1].side1.brackets++;
	}
	return filters;
};