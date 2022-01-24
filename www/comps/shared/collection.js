import MyStore                from '../../stores/store.js';
import {genericError}         from './error.js';
import {getValidLanguageCode} from './language.js';
import {
	getJoinIndexMap,
	getQueryColumnsProcessed,
	getQueryExpressions,
	getQueryFiltersProcessed,
	getRelationsJoined
} from './query.js';

export function getCollectionColumn(collectionId,columnId) {
	let colSchema = MyStore.getters['schema/collectionIdMap'][collectionId];
	for(let i = 0, j = colSchema.columns.length; i < j; i++) {
		if(colSchema.columns[i].id === columnId) {
			return colSchema.columns[i];
		}
	}
	return false;
};

export function getCollectionValues(collectionId,columnId,singleValue) {
	let colSchema = MyStore.getters['schema/collectionIdMap'][collectionId];
	let colValues = MyStore.getters['collectionIdMap'][collectionId];
	
	// collection might not have been retrieved yet or are empty
	if(typeof colValues === 'undefined' || colValues.length === 0)
		return singleValue ? null : [];
	
	// find requested column index by ID
	let columnIndex = -1;
	for(let i = 0, j = colSchema.columns.length; i < j; i++) {
		if(colSchema.columns[i].id === columnId) {
			columnIndex = i;
			break;
		}
	}
	if(columnIndex === -1)
		return singleValue ? null : [];
	
	if(singleValue)
		return colValues[0][columnIndex];
	
	let out = [];
	for(let i = 0, j = colValues.length; i < j; i++) {
		out.push(colValues[i][columnIndex]);
	}
	return out;
};

export function updateCollections() {
	let access          = MyStore.getters.access.collection;
	let collectionIdMap = MyStore.getters['schema/collectionIdMap'];
	
	// clear existing collections, not all might receive new values (role changed)
	MyStore.commit('collectionsClear',{});
	
	for(let collectionId in collectionIdMap) {
		
		if(typeof access[collectionId] === 'undefined' || access[collectionId] < 1)
			continue;
		
		let c = collectionIdMap[collectionId];
		let q = c.query;
		
		// set module language so that language filters can work outside of module context
		let m = MyStore.getters['schema/moduleIdMap'][c.moduleId];
		MyStore.commit('moduleLanguage',getValidLanguageCode(m));
		
		let joinIndexMap = getJoinIndexMap(q.joins);
		let filters      = getQueryFiltersProcessed(q.filters,{},joinIndexMap);
		let columns      = getQueryColumnsProcessed(c.columns,{},joinIndexMap);
		
		ws.send('data','get',{
			relationId:q.relationId,
			joins:getRelationsJoined(q.joins),
			expressions:getQueryExpressions(columns),
			filters:filters,
			orders:q.orders,
			limit:q.fixedLimit,
			offset:0
		},true).then(
			(res) => {
				let recordValues = [];
				for(let i = 0, j = res.payload.rows.length; i < j; i++) {
					recordValues.push(res.payload.rows[i].values);
				}
				MyStore.commit('collection',{
					id:collectionId,
					records:recordValues
				});
			},
			(err) => genericError(err)
		);
	}
};