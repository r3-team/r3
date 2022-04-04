import {getIndexAttributeId} from './attribute.js';
import {getItemTitle}        from './builder.js';
import {getCollectionValues} from './collection.js';
import MyStore               from '../../stores/store.js';

let getQueryExpressionAttribute = function(column) {
	return {
		attributeId:column.attributeId,
		index:column.index,
		groupBy:column.groupBy,
		aggregator:column.aggregator,
		distincted:column.distincted
	};
};

export function fillRelationRecordIds(joins) {
	for(let i = 0, j = joins.length; i < j; i++) {
		joins[i].recordId = 0;
	}
	return joins;
};

export function getRelationsJoined(joins) {
	let relsJoined = [];
	
	for(let i = 0, j = joins.length; i < j; i++) {
		let join = joins[i];
		
		if(join.index === 0) // ignore source relation
			continue;
		
		relsJoined.push({
			attributeId:join.attributeId,
			index:join.index,
			indexFrom:join.indexFrom,
			connector:join.connector
		});
	}
	return relsJoined;
};

export function getQueryExpressions(columns) {
	let expr = [];
	for(let i = 0, j = columns.length; i < j; i++) {
		let c = columns[i];
		
		if(!c.subQuery) {
			expr.push(getQueryExpressionAttribute(c));
			continue;
		}
		
		expr.push({
			query:{
				queryId:c.query.id,
				relationId:c.query.relationId,
				limit:c.query.fixedLimit,
				joins:c.query.joins,
				expressions:[getQueryExpressionAttribute(c)],
				filters:c.query.filters,
				orders:c.query.orders
			}
		});
	}
	return expr;
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

export function getNestedIndexAttributeIdsByJoins(joins,nestingLevel) {
	let out = [];
	for(let i = 0, j = joins.length; i < j; i++) {
		let r = MyStore.getters['schema/relationIdMap'][joins[i].relationId];
		
		for(let x = 0, y = r.attributes.length; x < y; x++) {
			out.push(`${nestingLevel}_${joins[i].index}_${r.attributes[x].id}`);
		}
	}
	return out;
};

export function getCaptionByIndexAttributeId(indexAttributeId) {
	let v = indexAttributeId.split('_');
	let a = MyStore.getters['schema/attributeIdMap'][v[1]];
	let r = MyStore.getters['schema/relationIdMap'][a.relationId];
	return getItemTitle(r,a,v[0],false,false);
};

export function getSubQueryFilterExpressions(subQuery) {
	return [{
		aggregator:subQuery.queryAggregator,
		attributeId:subQuery.attributeId,
		index:subQuery.attributeIndex
	}];
};

export function getQueryColumnsProcessed(columns,dataFieldIdMap,joinsIndexMap,values) {
	columns = JSON.parse(JSON.stringify(columns));
	for(let i = 0, j = columns.length; i < j; i++) {
		
		if(!columns[i].subQuery)
			continue;
		
		columns[i].query.filters = getQueryFiltersProcessed(
			columns[i].query.filters,
			dataFieldIdMap,
			joinsIndexMap,
			values
		);
	}
	return columns;
};

export function getQueryFiltersProcessed(filters,dataFieldIdMap,joinsIndexMap,
	values,joinIndexesRemove,collectionIdMapIndexFilter) {

	filters = JSON.parse(JSON.stringify(filters));
	let out = [];
	
	if(typeof values === 'undefined')
		values = {};
	
	if(typeof joinIndexesRemove === 'undefined')
		joinIndexesRemove = [];
	
	if(typeof collectionIdMapIndexFilter === 'undefined')
		collectionIdMapIndexFilter = {};
	
	let getFilterSideProcessed = function(s,operator) {
		switch(s.content) {
			case 'collection':
				let singleValue = !['= ANY','<> ALL'].includes(operator);
				let recordIndex = typeof collectionIdMapIndexFilter[s.collectionId] === 'undefined'
					? -1 : collectionIdMapIndexFilter[s.collectionId];
				
				s.value = getCollectionValues(s.collectionId,s.columnId,singleValue,recordIndex);
			break;
			case 'field':
				let fld     = dataFieldIdMap[s.fieldId];
				let atrIdNm = typeof fld.attributeIdNm !== 'undefined' ? fld.attributeIdNm : null;
				
				s.value = values[getIndexAttributeId(
					fld.index,fld.attributeId,fld.outsideIn === true,atrIdNm
				)];
			break;
			case 'javascript':
				s.value = Function(s.value)();
			break;
			case 'languageCode':
				s.value = MyStore.getters.moduleLanguage;
			break;
			case 'login':
				s.value = MyStore.getters.loginId;
			break;
			case 'preset':
				// unprotected presets can be deleted, 0 as fallback
				s.value = 0;
				
				let presetIdMap = MyStore.getters['schema/presetIdMapRecordId'];
				if(typeof presetIdMap[s.presetId] !== 'undefined')
					s.value = presetIdMap[s.presetId];
			break;
			case 'record':
				if(typeof joinsIndexMap['0'] !== 'undefined')
					s.value = joinsIndexMap['0'].recordId;
			break;
			case 'recordNew':
				if(typeof joinsIndexMap['0'] !== 'undefined')
					s.value = joinsIndexMap['0'].recordId === 0;
			break;
			case 'role':
				s.value = MyStore.getters.access.roleIds.includes(s.roleId);
			break;
			case 'subQuery':
				s.query.expressions = getSubQueryFilterExpressions(s);
				s.query.filters     = getQueryFiltersProcessed(
					s.query.filters,
					dataFieldIdMap,
					joinsIndexMap,
					values,
					joinIndexesRemove,
					collectionIdMapIndexFilter
				);
			break;
			case 'true':
				s.value = true;
			break;
		}
		
		if(s.content !== 'subQuery') {
			delete(s.query);
			delete(s.queryAggregator);
		}
		return s;
	};
	for(let i = 0, j = filters.length; i < j; i++) {
		let f = filters[i];
		
		if(f.side0.attributeId !== null && joinIndexesRemove.includes(f.side0.attributeIndex))
			continue;
		
		if(f.side1.attributeId !== null && joinIndexesRemove.includes(f.side1.attributeIndex))
			continue;
		
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