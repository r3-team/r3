import MyStore        from '../../stores/store.js';
import {genericError} from './error.js';
import {
	getJoinIndexMap,
	getQueryColumnsProcessed,
	getQueryExpressions,
	getQueryFiltersProcessed,
	getRelationsJoined
} from './query.js';

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
		
		let joinIndexMap = getJoinIndexMap(q.joins);
		
		let filters = getQueryFiltersProcessed(
			q.filters,{},joinIndexMap,[],{});
		
		let columns = getQueryColumnsProcessed(
			c.columns,{},joinIndexMap,{});
		
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