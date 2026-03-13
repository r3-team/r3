import {getColumnAttributeIdsForLogs} from './shared/column.js';
import {getUnixFormat} from './shared/time.js';
import {
	isAttributeRelationship,
	isAttributeRelationship11,
	isAttributeRelationshipN1
} from './shared/attribute.js';

export default {
	name:'my-form-log-neo',
	template:`<div class="app-sub-window under-header" @mousedown.left.self="$emit('close')">
		<div class="contentBox form-log-neo float">
			<table>
				<thead>
					<tr>
						<td>{{ capGen.date }}</td>
						<td>{{ capGen.username }}</td>
						<td>{{ capGen.record }}</td>
						<td>{{ capGen.value }}</td>
					</tr>
				</thead>
				<tbody>
					<tr v-for="l in logs">
						<td>{{ getUnixFormat(l.dateChange,settings.dateFormat + ' H:i:S') }}</td>
						<td>{{ l.loginName }}</td>
						<td>{{ relationIdMapRecordIdMapTitle[l.relationId]?.[l.recordId] !== undefined
							? relationIdMapRecordIdMapTitle[l.relationId][l.recordId]
							: 'UNKNOWN'
						}}</td>
						<td>
							<table>
								<tbody>
									<tr v-for="a in l.attributes">
										<template v-if="a.relationId === null">
											<td>{{ attributeIdMap[a.attributeId].name }}</td>
											<td>{{ a.value !== null ? a.value : capGen.button.empty }}</td>
										</template>
										<template v-if="a.relationId !== null">
											<td>{{ a.attributeIdNm === null ? attributeIdMap[a.attributeId].name : attributeIdMap[a.attributeIdNm].name }}</td>
											<td v-if="a.value !== null">
												<div class="row gap">
													<div class="form-log-neo-record-title"
														v-for="v in a.value.filter(v => relationIdMapRecordIdMapTitle[a.relationId]?.[v] !== undefined)"
													>{{ relationIdMapRecordIdMapTitle[a.relationId]?.[v] }}</div>
												</div>
											</td>
											<td v-if="a.value === null">{{ capGen.button.empty }}</td>
										</template>
									</tr>
								</tbody>
							</table>
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>`,
	props:{
		entityIdMapEffect:          { type:Object, required:true },
		fields:                     { type:Array,  required:true },
		fieldIdMapIndexMapRecordIds:{ type:Object, required:true },
		joinsIndexMap:              { type:Object, required:true },

		/*
		indexMapRecordKey:  { type:Object,  required:true },
		moduleId:           { type:String,  required:true }
		*/
	},
	emits:['close'],
	data() {
		return {
			logs:[],
			relationIdMapRecordIdMapTitle:{}
		};
	},
	computed:{
		sources:s => { // [ { fieldId:null, index:0, recordIds:[], attributeIds:[] } ]
			let out = [];

			const parseFields = fields => {
				for(const f of fields) {
					switch(f.content) {
						case 'container':
							parseFields(f.fields);
						break;
						case 'tabs':
							for(const t of f.tabs) {
								parseFields(t.fields);
							}
						break;
						case 'data':
							// if field join index is available & field is accessible
							const src = out.find(v => v.fieldId === null && v.index === f.index);
							if(src !== undefined && !src.attributeIds.includes(f.attributeId)) {
		
								const state = s.entityIdMapEffect.field[f.id] !== undefined
									? s.entityIdMapEffect.field[f.id] : f.state;
								
								if(state !== 'hidden')
									src.attributeIds.push(f.attributeId);
							}
						break;
						case 'list':
							if(f.query === null || s.fieldIdMapIndexMapRecordIds[f.id] === undefined)
								continue;

							for(const k in s.fieldIdMapIndexMapRecordIds[f.id]) {
								const index = parseInt(k);
								const join  = f.query.joins.find(v => v.index === index);

								if(join === undefined)
									continue;

								// fetch only records, if their relation has record titles
								const rel = s.relationIdMap[join.relationId];
								if(rel.attributeIdsTitle.length === 0)
									continue;

								out.push({
									fieldId:f.id,
									index:index,
									recordIds:s.fieldIdMapIndexMapRecordIds[f.id][index],
									attributeIds:s.getColumnAttributeIdsForLogs(f.columns,index)
								});
							}

							// add relationship attributes
							for(const join of f.query.joins) {
								if(join.attributeId === null)
									continue;

								const src = out.find(v => v.fieldId === f.id && v.index === join.index);
								if(src === undefined)
									continue;

								const atr = s.attributeIdMap[join.attributeId];
								if(atr.relationId === join.relationId) {
									src.attributeIds.push(join.attributeId);
									continue;
								}

								const srcFrom = out.find(v => v.fieldId === f.id && v.index === join.indexFrom);
								if(srcFrom !== undefined)
									srcFrom.attributeIds.push(join.attributeId);
							}
						break;
					}
				}
			};
			
			for(const k in s.joinsIndexMap) {	
				const j = s.joinsIndexMap[k];

				if(j.recordId !== 0)
					out.push({
						fieldId:null,
						index:j.index,
						recordIds:[j.recordId],
						attributeIds:[]
					});
			}
			parseFields(s.fields);
			return out;
		},

		// stores
		attributeIdMap:s => s.$store.getters['schema/attributeIdMap'],
		relationIdMap: s => s.$store.getters['schema/relationIdMap'],
		capGen:        s => s.$store.getters.captions.generic,
		settings:      s => s.$store.getters.settings
	},
	mounted() {
		this.get(false);
	},
	methods:{
		// externals
		getColumnAttributeIdsForLogs,
		getUnixFormat,
		isAttributeRelationship,
		isAttributeRelationship11,
		isAttributeRelationshipN1,

		// actions

		// backend calls
		get(isNextPage) {
			let requests = [];

			// copy sources in cases it changes before responses come back (need to match request response to each source)
			const sources = JSON.parse(JSON.stringify(this.sources));
			for(const src of sources) {
				if(src.recordIds.length === 0 || src.attributeIds.length === 0)
					continue;

				requests.push(ws.prepare('data','getLog',{
					recordIds:src.recordIds,
					attributeIds:src.attributeIds
				}));
			}
			
			if(requests.length === 0)
				return;

			ws.sendMultiple(requests,true).then(
				async responses => {
					let logs = [];
					let relationIdMapRecordIds = {};
					const addRelationRecordIds = (relationId,recordIds) => {

						// skip if the record of the log relation does not have a title
						if(this.relationIdMap[relationId].attributeIdsTitle.length === 0)
							return;

						if(relationIdMapRecordIds[relationId] === undefined)
							relationIdMapRecordIds[relationId] = [];

						for(const id of recordIds) {
							if(!relationIdMapRecordIds[relationId].includes(id))
								relationIdMapRecordIds[relationId].push(id);
						}
					};

					for(const res of responses) {

						// store record IDs for record title retrieval
						for(const l of res.payload) {
							addRelationRecordIds(l.relationId,[l.recordId]);

							// parse records from relationship attribute values
							for(const a of l.attributes) {
								a.relationId = null;
								a.value      = JSON.parse(a.value);

								const atr = this.attributeIdMap[a.attributeId];

								// process relationship values
								if(!this.isAttributeRelationship(atr.content))
									continue;

								const isSingleValue = this.isAttributeRelationship11(atr.content)
									|| (this.isAttributeRelationshipN1(atr.content) && a.outsideIn !== true);
								
								if(isSingleValue) {
									a.relationId = a.outsideIn ? atr.relationId : atr.relationshipId;
									if(a.value !== null)
										a.value = [a.value];
								} else {
									// multi values are always outside-in
									a.relationId = a.attributeIdNm === null ? atr.relationId : this.attributeIdMap[a.attributeIdNm].relationshipId;
								}

								if(a.value !== null)
									addRelationRecordIds(a.relationId,a.value);
							}
						}

						// decrypt values

						logs = logs.concat(res.payload);
					}

					// sort logs by date change (separate requests are sorted individually, but not together)
					logs.sort((a,b) => a.dateChange - b.dateChange);

					// fetch title for loaded record and relationship values
					ws.send('data','getRecordTitles',relationIdMapRecordIds,true).then(
						res => {
							// store fetched record titles
							this.relationIdMapRecordIdMapTitle = res.payload;

							// apply processed logs
							if(!isNextPage) this.logs = logs;
							else            this.logs.concat(logs);
						},
						this.$root.genericError
					);
				},
				this.$root.genericError
			);
		}
	}
};