import {getColumnTitle}                from './shared/column.js';
import {aesGcmDecryptBase64WithPhrase} from './shared/crypto.js';
import {consoleError}                  from './shared/error.js';
import {srcBase64}                     from './shared/image.js';
import {getCaption}                    from './shared/language.js';
import {getUnixFormat}                 from './shared/time.js';
import {
	getAttributeFileHref,
	getAttributeFileVersionHref,
	isAttributeFiles,
	isAttributeRelationship,
	isAttributeRelationship11,
	isAttributeRelationshipN1
} from './shared/attribute.js';

export default {
	name:'my-form-log',
	template:`<div class="app-sub-window under-header" @mousedown.left.self="$emit('close')">
		<div class="contentBox scroll float form-log">
			<div class="top">
				<div class="area nowrap">
					<img class="icon" src="images/time.png" />
					<h1>{{ capApp.title }}</h1>
				</div>
				<div class="area">
					<my-button image="cancel.png" @trigger="$emit('close')" :cancel="true" />
				</div>
			</div>
			<div class="form-log-content">
				<div class="form-log-table">
					<table class="generic-table auto-height sticky-top bright topAligned">
						<thead>
							<tr>
								<th>{{ capGen.date }}</th>
								<th>{{ capGen.username }}</th>
								<th v-if="!isSingleSource">{{ capGen.source }}</th>
								<th v-if="!isSingleSourceForm">{{ capGen.record }}</th>
								<th>{{ capGen.field }}</th>
								<th>{{ capGen.value }}</th>
							</tr>
						</thead>
						<tbody>
							<tr v-if="logsShown.length === 0"><td colspan="6">{{ capGen.nothingThere }}</td></tr>

							<template v-for="(l,li) in logsShown">
								<tr v-for="(a,i) in l.attributes" :class="{ 'row-contrast':li % 2 === 0 }">
									<!-- log info -->
									<template v-if="i === 0">
										<td class="minimum" :rowspan="l.attributes.length">{{ getUnixFormat(l.dateChange,settings.dateFormat + ' H:i:S') }}</td>
										<td class="minimum" :rowspan="l.attributes.length">{{ l.loginName }}</td>
										<td class="minimum" :rowspan="l.attributes.length" v-if="!isSingleSource">
											<div class="form-log-source">
												<img :src="sources[l.sourceIndex].image" />
												<span>{{ sources[l.sourceIndex].title }}</span>
											</div>
										</td>
										<td class="minimum" :rowspan="l.attributes.length"  v-if="!isSingleSourceForm">
											{{ relationIdMapRecordIdMapTitle[l.relationId]?.[l.recordId] !== undefined ? relationIdMapRecordIdMapTitle[l.relationId][l.recordId] : '-' }}
										</td>
									</template>

									<!-- log values -->
									<td class="minimum">
										<my-label
											v-if="sources[l.sourceIndex].attributeIdMapIcon[a.attributeId] !== null"
											:caption="sources[l.sourceIndex].attributeIdMapTitle[a.attributeId]"
											:imageBase64="srcBase64(iconIdMap[sources[l.sourceIndex].attributeIdMapIcon[a.attributeId]].file)"
										/>
										<my-label image="icon_missing.png"
											v-if="sources[l.sourceIndex].attributeIdMapIcon[a.attributeId] === null"
											:caption="sources[l.sourceIndex].attributeIdMapTitle[a.attributeId]"
										/>
									</td>
									<td v-if="a.value === null">
										<span class="form-log-empty-value">[{{ capGen.button.empty }}]</span>
									</td>

									<template v-if="a.value !== null">
										<template v-if="!sources[l.sourceIndex].attributeIdsFiles.includes(a.attributeId)">
											<td v-if="a.relationId === null">
												<my-value-rich :attributeId="a.attributeId" :length="80" :value="a.value" />
											</td>
											<td v-if="a.relationId !== null">
												<div class="row gap wrap">
													<div class="form-log-record-title"
														v-for="v in a.value.filter(v => relationIdMapRecordIdMapTitle[a.relationId]?.[v] !== undefined)"
													>{{ relationIdMapRecordIdMapTitle[a.relationId]?.[v] }}</div>
												</div>
											</td>
										</template>
										<td v-else>
											<table>
												<tbody>
													<tr v-for="(c,fileId) in a.value.fileIdMapChange">
														<td v-if="c.action === 'create'">{{ capApp.fileCreated }}</td>
														<td v-if="c.action === 'delete'">{{ capApp.fileDeleted }}</td>
														<td v-if="c.action === 'rename'">{{ capApp.fileRenamed }}</td>
														<td v-if="c.action === 'update'">{{ capApp.fileUpdated }}</td>
														<td>
															<!-- latest file version -->
															<a target="_blank" v-if="c.action !== 'update'" :href="getAttributeFileHref(a.attributeId,fileId,c.name,token)">
																<my-button image="download.png" :caption="c.name" :naked="true" />
															</a>
															<!-- specific file version -->
															<a target="_blank" v-else :href="getAttributeFileVersionHref(a.attributeId,fileId,c.name,c.version,token)">
																<my-button image="download.png" :caption="c.name + ' (v' + c.version + ')'" :naked="true" />
															</a>
														</td>
													</tr>
												</tbody>
											</table>
										</td>
									</template>
								</tr>
							</template>
						</tbody>
					</table>
				</div>
				<div class="form-log-sidebar">
					<div class="column gap" v-if="!isSingleSource">
						<my-label image="filter.png" :caption="capGen.sources" :large="true" />
						<my-button
							v-for="fieldId in sourcesFieldIds"
							@trigger="sourceToggle(fieldId)"
							:caption="getSourceTitleByFieldId(fieldId)"
							:images="[sourceFieldIdsHide.includes(fieldId) ? 'checkbox0.png' : 'checkbox1.png', fieldId === null ? 'fileText.png' : 'files_list2.png']"
							:modelValue="!sourceFieldIdsHide.includes(fieldId)"
							:naked="true"
						/>
					</div>
				</div>
			</div>
		</div>
	</div>`,
	props:{
		entityIdMapEffect:          { type:Object, required:true },
		fields:                     { type:Array,  required:true },
		fieldIdMapIndexMapRecordIds:{ type:Object, required:true },
		fieldIdMapOverwrite:        { type:Object, required:true },
		formIconSrc:                { type:String, required:true },
		formTitle:                  { type:String, required:true },
		indexMapRecordKey:          { type:Object, required:true },
		joinsIndexMap:              { type:Object, required:true },
		moduleId:                   { type:String, required:true }
	},
	emits:['close'],
	data() {
		return {
			logs:[],
			sourceFieldIdsHide:[],
			relationIdMapRecordIdMapTitle:{}
		};
	},
	computed:{
		// a source requests data logs for a number of record IDs and defined attributes
		// sources can either be the current form itself or a number of list fields on the form
		// which attributes are requested depends on the requestor (form = visible data fields, list = available columns)
		// a data log request runs for specific record IDs for a single relation, with shared attributes to retrieve
		//  both form & list fields can have multiple sources if they join multiple relations
		sources:s => {
			let out = [];

			const parseFields = (fields,tabTitle) => {
				for(const f of fields) {
					switch(f.content) {
						case 'container':
							parseFields(f.fields,'');
						break;
						case 'tabs':
							for(const t of f.tabs) {
								parseFields(t.fields,s.getCaption('tabTitle',s.moduleId,t.id,t.captions,''));
							}
						break;
						case 'data':
							// if field join index is available & field is accessible
							const src = out.find(v => v.fieldId === null && v.index === f.index);
							if(src !== undefined && !src.attributeIds.includes(f.attributeId)) {
		
								const state = s.entityIdMapEffect.field[f.id] !== undefined
									? s.entityIdMapEffect.field[f.id] : f.state;
								
								if(state === 'hidden')
									continue;

								const isNm = f.attributeIdNm !== undefined && f.attributeIdNm !== null;
								const atr  = isNm ? s.attributeIdMap[f.attributeIdNm] : s.attributeIdMap[f.attributeId];

								if(isNm || s.isAttributeRelationship(atr.content)) {
									// fetch only relationship attributes, if their relation has record titles
									const rel = s.relationIdMap[atr.relationshipId];
									if(rel.attributeIdsTitle.length === 0)
										continue;
								}

								let title  = '';
								let iconId = f.iconId !== null ? f.iconId : atr.iconId;
								
								if(s.fieldIdMapOverwrite.caption[f.id] !== undefined)
									title = s.fieldIdMapOverwrite.caption[f.id];

								if(title === '')
									title = s.getCaption('fieldTitle',s.moduleId,f.id,f.captions);

								if(title === '')
									title = s.getCaption('attributeTitle',s.moduleId,f.attributeId,atr.captions,atr.name);
								
								src.attributeIds.push(f.attributeId);
								src.attributeIdMapIcon[f.attributeId]  = iconId;
								src.attributeIdMapTitle[f.attributeId] = title;

								if(!isNm && atr.encrypted)
									src.attributeIdsEnc.push(f.attributeId);

								if(s.isAttributeFiles(atr.content))
									src.attributeIdsFiles.push(f.attributeId);
							}
						break;
						case 'list':
							// lists are their own data log source if they have records loaded
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

								let title = '';
								if(title === '')
									title = s.getCaption('fieldTitle',s.moduleId,f.id,f.captions);
								
								if(title === '')
									title = tabTitle;

								if(title === '')
									title = s.getCaption('relationTitle',s.moduleId,rel.id,rel.captions);

								let src = s.getSourceTemplate(f.id,index,s.fieldIdMapIndexMapRecordIds[f.id][index],'images/files_list2.png',title);
								for(const c of f.columns) {
									if(!c.subQuery && c.index === index) {
										const atr = s.attributeIdMap[c.attributeId];

										// encrypted change logs are not supported for sub lists, keys are not available
										// it would require providing keys during data log GET call to implement this
										if(atr.encrypted)
											continue;

										src.attributeIds.push(c.attributeId);
										src.attributeIdMapIcon[c.attributeId]  = atr.iconId;
										src.attributeIdMapTitle[c.attributeId] = s.getColumnTitle(c,s.moduleId);

										if(s.isAttributeFiles(atr.content))
											src.attributeIdsFiles.push(c.attributeId);
									}
								}
								out.push(src);
							}

							// add relationship attributes
							for(const join of f.query.joins) {
								if(join.attributeId === null)
									continue;

								const src = out.find(v => v.fieldId === f.id && v.index === join.index);
								if(src === undefined)
									continue;

								const atr   = s.attributeIdMap[join.attributeId];
								const title = s.getCaption('attributeTitle',s.moduleId,atr.id,atr.captions,atr.name);
								if(atr.relationId === join.relationId) {
									src.attributeIds.push(atr.id);
									src.attributeIdMapIcon[atr.id]  = atr.iconId;
									src.attributeIdMapTitle[atr.id] = title;
									continue;
								}

								const srcFrom = out.find(v => v.fieldId === f.id && v.index === join.indexFrom);
								if(srcFrom !== undefined) {
									srcFrom.attributeIds.push(atr.id);
									srcFrom.attributeIdMapIcon[atr.id]  = atr.iconId;
									srcFrom.attributeIdMapTitle[atr.id] = title;
								}
							}
						break;
					}
				}
			};
			
			for(const k in s.joinsIndexMap) {	
				const j = s.joinsIndexMap[k];
				if(j.recordId !== 0)
					out.push(s.getSourceTemplate(null,j.index,[j.recordId],s.formIconSrc,s.formTitle));
			}
			parseFields(s.fields,'');
			return out;
		},
		sourcesFieldIds:s => {
			let out = [];
			for(const src of s.sources) {
				if(!out.includes(src.fieldId))
					out.push(src.fieldId);
			}
			return out;
		},
		isSingleSource:s => {
			let srcFieldIdLast;
			for(const src of s.sources) {
				if(srcFieldIdLast === undefined) {
					srcFieldIdLast = src.fieldId;
					continue;
				}

				if(srcFieldIdLast !== src.fieldId)
					return false;
			}
			return true;
		},

		// simple
		isSingleSourceForm:s => s.isSingleSource && (s.sources.length === 0 || s.sources[0].fieldId === null),
		logsShown:         s => s.logs.filter(v => !s.sourceFieldIdsHide.includes(s.sources[v.sourceIndex].fieldId)),

		// stores
		attributeIdMap:s => s.$store.getters['schema/attributeIdMap'],
		iconIdMap:     s => s.$store.getters['schema/iconIdMap'],
		relationIdMap: s => s.$store.getters['schema/relationIdMap'],
		token:         s => s.$store.getters['local/token'],
		capApp:        s => s.$store.getters.captions.formLog,
		capGen:        s => s.$store.getters.captions.generic,
		settings:      s => s.$store.getters.settings
	},
	mounted() {
		this.get(false);
	},
	methods:{
		// externals
		aesGcmDecryptBase64WithPhrase,
		consoleError,
		getAttributeFileHref,
		getAttributeFileVersionHref,
		getCaption,
		getColumnTitle,
		getUnixFormat,
		isAttributeFiles,
		isAttributeRelationship,
		isAttributeRelationship11,
		isAttributeRelationshipN1,
		srcBase64,

		getSourceTemplate(fieldId,index,recordIds,image,title) {
			return { fieldId, index, image, recordIds, title,
				attributeIds:[],
				attributeIdsEnc:[],
				attributeIdsFiles:[],
				attributeIdMapIcon:{},
				attributeIdMapTitle:{}
			};
		},
		getSourceTitleByFieldId(fieldId) {
			for(const src of this.sources) {
				if(fieldId === src.fieldId)
					return src.title;
			}
			return '';
		},

		// actions
		sourceToggle(fieldId) {
			const pos = this.sourceFieldIdsHide.indexOf(fieldId);
			if(pos === -1) this.sourceFieldIdsHide.push(fieldId);
			else           this.sourceFieldIdsHide.splice(pos,1);
		},

		// backend calls
		get(isNextPage) {
			let requests = [];

			// copy sources in cases it changes before responses come back (need to match request response to each source)
			for(let i = 0, j = this.sources.length; i < j; i++) {
				const src = this.sources[i];
				if(src.recordIds.length === 0 || src.attributeIds.length === 0)
					continue;

				// if multiple sources exist, we require a title to differentiate them
				if(!this.isSingleSource && src.title === '')
					continue;

				requests.push(ws.prepare('data','getLog',{
					recordIds:src.recordIds,
					attributeIds:src.attributeIds,
					sourceIndex:i
				}));
			}
			
			if(requests.length === 0)
				return;

			ws.sendMultiple(requests,true).then(
				async responses => {
					let logsCombined = []; // logs from all data log requests combined
					let logIdsParsed = []; // logs can be fetched twice, if multiple sources refer to the same records
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
					const parseLogValues = async (attributeValues,src) => {
						for(const a of attributeValues) {
							a.relationId = null;
							a.value      = JSON.parse(a.value);

							const atr = this.attributeIdMap[a.attributeId];
							if(!this.isAttributeRelationship(atr.content)) {
								if(a.value !== null && src.attributeIdsEnc.includes(atr.id)) {
									// decrypt encrypted attribute value
									const keyStr = this.indexMapRecordKey[src.index];
									if(keyStr === undefined)
										throw new Error('no data key for record');

									a.value = await this.aesGcmDecryptBase64WithPhrase(a.value,keyStr);
								}
								continue;
							}

							// process relationship values
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
					};

					for(let i = 0, j = responses.length; i < j; i++) {
						const res  = responses[i];
						const req  = requests[i];
						const logs = [];

						for(const log of res.payload) {
							if(logIdsParsed.includes(log.id))
								continue;

							logIdsParsed.push(log.id);
							log.sourceIndex = req.payload.sourceIndex;
							const src = this.sources[log.sourceIndex];
							addRelationRecordIds(log.relationId,[log.recordId]);
							
							try      { await parseLogValues(log.attributes,src); }
							catch(e) {
								this.consoleError(e); // full error for troubleshooting
								this.$root.genericErrorWithFallback(e.message,'SEC','003');
								return;
							}
							logs.push(log);
						}
						logsCombined = logsCombined.concat(logs);
					}

					// sort logs by date change (separate requests are sorted individually, but not together)
					logsCombined.sort((a,b) => b.dateChange - a.dateChange);

					// fetch titles for loaded records and relationship values
					ws.send('data','getRecordTitles',relationIdMapRecordIds,true).then(
						res => {
							this.relationIdMapRecordIdMapTitle = res.payload;

							// apply processed logs once record titles are ready
							if(!isNextPage) this.logs = logsCombined;
							else            this.logs.concat(logsCombined);
						},
						this.$root.genericError
					);
				},
				this.$root.genericError
			);
		}
	}
};