import MyInputRichtext                 from './inputRichtext.js';
import {getColumnTitle}                from './shared/column.js';
import {aesGcmDecryptBase64WithPhrase} from './shared/crypto.js';
import {consoleError}                  from './shared/error.js';
import {getHtmlStripped}               from './shared/generic.js';
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

const myFormLogLabel = {
	name:'my-form-log-label',
	template:`<my-label
		:caption
		:image="iconId === null ? 'icon_missing.png' : ''"
		:imageBase64="iconId === null ? '' : srcBase64(iconIdMap[iconId].file)"
		:large
		:wrap="isMobile"
	/>`,
	props:{
		caption:{ type:String,        required:true },
		iconId: { type:[String,null], required:true },
		large:  { type:Boolean,       required:false, default:false }
	},
	computed:{
		iconIdMap:s => s.$store.getters['schema/iconIdMap'],
		isMobile: s => s.$store.getters.isMobile
	},
	methods:{
		srcBase64
	}
};

const myFormLogValue = {
	name:'my-form-log-value',
	components:{ MyInputRichtext },
	template:`<div class="form-log-value" :class="{ noGrow:showLarge && !isRichtext, large:showLarge, noPadding:isRichtext }">
		<span class="form-log-value-empty" v-if="isNull">[{{ capGen.button.empty }}]</span>

		<template v-if="!isNull">
			<my-value-rich v-if="isValueRegular" :attributeId :key="attributeId" :length="60" :value />

			<div class="form-log-value-richtext" v-if="showLarge && isRichtext" :class="{ fullscreen:isFullscreen }">
				<my-input-richtext :modelValue="value" :readonly="true" />
			</div>

			<div class="row gap wrap" v-if="isRelationship">
				<div class="form-log-value-record-title"
					v-for="v in value.filter(v => relationIdMapRecordIdMapTitle[relationId]?.[v] !== undefined)"
				>{{ relationIdMapRecordIdMapTitle[relationId]?.[v] }}</div>
			</div>

			<table v-if="isFiles">
				<tbody>
					<tr v-for="(c,fileId) in value.fileIdMapChange">
						<td v-if="c.action === 'create'">{{ capApp.fileCreated }}</td>
						<td v-if="c.action === 'delete'">{{ capApp.fileDeleted }}</td>
						<td v-if="c.action === 'rename'">{{ capApp.fileRenamed }}</td>
						<td v-if="c.action === 'update'">{{ capApp.fileUpdated }}</td>
						<td>
							<!-- latest file version -->
							<a target="_blank" v-if="c.action !== 'update'" :href="getAttributeFileHref(attributeId,fileId,c.name,token)">
								<my-button image="download.png"
									:caption="getFileName(c.name,null)"
									:captionTitle="c.name"
									:naked="true"
								/>
							</a>
							<!-- specific file version -->
							<a target="_blank" v-else :href="getAttributeFileVersionHref(attributeId,fileId,c.name,c.version,token)">
								<my-button image="download.png"
									:caption="getFileName(c.name,c.version)"
									:captionTitle="c.name + ' (v' + c.version + ')'"
									:naked="true"
								/>
							</a>
						</td>
					</tr>
				</tbody>
			</table>
		</template>
	</div>`,
	props:{
		attributeId:                  { type:String,        required:true },
		isFiles:                      { type:Boolean,       required:true },
		isFullscreen:                 { type:Boolean,       required:false, default:false },
		relationId:                   { type:[String,null], required:true }, // set if attribute is relationship, relation of target records
		relationIdMapRecordIdMapTitle:{ type:Object,        required:true },
		showLarge:                    { type:Boolean,       required:false, default:false },
		value:                        { required:true }
	},
	emits:[],
	computed:{
		isLarge:       s => s.isRichtext,
		isNull:        s => s.value === null,
		isRelationship:s => s.relationId !== null,
		isRichtext:    s => s.attribute.contentUse === 'richtext',
		isValueRegular:s => !s.isFiles && !s.isRelationship && (!s.showLarge || !s.isLarge),

		// stores
		attributeIdMap:s => s.$store.getters['schema/attributeIdMap'],
		token:         s => s.$store.getters['local/token'],
		attribute:     s => s.attributeIdMap[s.attributeId],
		capApp:        s => s.$store.getters.captions.formLog,
		capGen:        s => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getAttributeFileHref,
		getAttributeFileVersionHref,

		// presentation
		getFileName(name,version) {
			if(name.length > 30)
				name = name.substring(0,27) + '...';

			return version === null ? name : `${name} (v${version})`;
		}
	}
};

const myFormLogValueSidebar = {
	name:'my-form-log-value-sidebar',
	components:{
		myFormLogLabel,
		myFormLogValue,
		MyInputRichtext
	},
	template:`<div class="form-log-value-sidebar" v-if="isReady">
		<div class="row gap-large center space-between" v-if="recordTitle !== null">
			<my-label :caption="recordTitle" :imageBase64="source.image" :large="true" />
			<my-button image="cancel.png" v-if="recordTitle !== null" @trigger="$emit('close')" :captionTitle="capApp.button.closeSidebar" />
		</div>

		<div class="form-log-value-sidebar-title">
			<my-form-log-label
				v-if="isValueAttribute"
				:caption="capGen.field + ': ' + source.attributeIdMapTitle[attributeValue.attributeId]"
				:iconId="source.attributeIdMapIcon[attributeValue.attributeId]"
				:large="true"
			/>
			<my-label image="feedback.png"
				v-if="!isValueAttribute"
				:caption="capGen.comment"
				:large="true"
			/>
			<my-button image="cancel.png" v-if="recordTitle === null" @trigger="$emit('close')" :captionTitle="capApp.button.closeSidebar" />
		</div>
		<div class="form-log-value-sidebar-title-sub">
			<span v-if="log.loginName !== ''">{{ log.loginName }}</span>
			<span>{{ getUnixFormat(log.dateChange,settings.dateFormat + ' H:i:S') }}</span>
		</div>
		
		<div class="form-log-value-sidebar-comment" v-if="isValueComment">
			<my-input-richtext :modelValue="log.comment" :readonly="true" />
		</div>
		<my-form-log-value
			v-if="isValueAttribute"
			:attributeId="attributeValue.attributeId"
			:isFiles="source.attributeIdsFiles.includes(attributeValue.attributeId)"
			:isFullscreen
			:relationId="attributeValue.relationId"
			:relationIdMapRecordIdMapTitle
			:showLarge=true
			:value="attributeValue.value"
		/>
	</div>`,
	emits:['close'],
	props:{
		attributeId:                  { type:[String,null], required:true },
		isFullscreen:                 { type:Boolean,       required:true },
		isSingleSource:               { type:Boolean,       required:true },
		log:                          { type:Object,        required:true },
		relationIdMapRecordIdMapTitle:{ type:Object,        required:true },
		source:                       { type:Object,        required:true }
	},
	computed:{
		attributeValue:s => {
			const a = s.log.attributes.find(v => v.attributeId === s.attributeId);
			return a === undefined ? null : a;
		},
		recordTitle:s => {
			return !s.isSingleSource && s.relationIdMapRecordIdMapTitle[s.log.relationId]?.[s.log.recordId] !== undefined
				? s.capGen.record + ': ' + s.relationIdMapRecordIdMapTitle[s.log.relationId]?.[s.log.recordId] : null;
		},
		isReady:         s => s.isValueComment || s.attributeValue !== null,
		isValueAttribute:s => s.attributeId !== null,
		isValueComment:  s => s.log.comment !== null,

		// stores
		settings:s => s.$store.getters.settings,
		capApp:  s => s.$store.getters.captions.formLog,
		capGen:  s => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getUnixFormat
	}
};

export default {
	name:'my-form-log',
	components:{
		myFormLogLabel,
		myFormLogValue,
		myFormLogValueSidebar
	},
	template:`<div class="app-sub-window" @mousedown.left.self="$emit('close')" :class="{ 'under-header':!isMobile }">
		<div class="contentBox scroll float form-log" :class="{ fullscreen:showFullscreen }">
			<div class="top lower">
				<div class="area nowrap">
					<img class="icon" src="images/time.png" />
					<h1>{{ capApp.title }}</h1>
				</div>
				<div class="area">
					<my-button v-if="!isMobile" @trigger="showFullscreen = !showFullscreen" :captionTitle="capGen.fullscreenSwitchTo" :image="showFullscreen ? 'shrink.png' : 'expand.png'" />
					<my-button image="cancel.png" @trigger="$emit('close')" :caption="capGen.button.close" :cancel="true" />
				</div>
			</div>
			<div class="form-log-content">
				<div class="form-log-content-table" v-if="isLogTableVisible">
					<div class="form-log-options" v-if="isSidebarLogShown">
						<my-button
							@trigger="logShownFilter = !logShownFilter"
							:caption="capApp.button.filterByAttribute"
							:image="logShownFilter ? 'checkbox1.png' : 'checkbox0.png'"
						/>
						<my-button image="cancel.png"
							@trigger="logShownSidebarSet(null,null,false)"
							:caption="capApp.button.closeSidebar"
						/>
					</div>
					<div class="form-log-table">
						<table class="generic-table auto-height sticky-top no-wrap-text-header bright topAligned">
							<thead>
								<tr>
									<th>{{ capGen.date }}</th>
									<th v-if="!isMobile">{{ capGen.changedBy }}</th>
									<th v-if="!isSingleSourceActive">{{ capGen.source }}</th>
									<th v-if="!isSingleSourceForm">{{ capGen.record }}</th>
									<th>{{ capGen.field }}</th>
									<th>{{ capGen.value }}</th>
								</tr>
							</thead>
							<tbody>
								<tr v-if="logsShown.length === 0"><td colspan="6">{{ capGen.nothingThere }}</td></tr>

								<template v-for="(l,li) in logsShown" :key="l.id">

									<!-- log line for comment -->
									<tr class="row-clickable"
										v-if="l.comment !== null"
										@click="logShownSidebarSet(l.id,null,true)"
										:class="{ 'row-contrast':li % 2 === 0, 'row-selected':l.id === logShownId && null === logShownAttributeId }"
										:key="l.id"
									>
										<!-- log info -->
										<td class="minimum">{{ getDateFormatted(l.dateChange) }}</td>
										<td class="minimum" v-if="!isMobile">
											<span v-if="!l.isSystem && l.loginName !== ''">{{ l.loginName }}</span>
											<span v-if="!l.isSystem && l.loginName === ''"><i>[{{ capApp.deletedUser }}]</i></span>
											<span v-if="l.isSystem"><i>[{{ capGen.system }}]</i></span>
										</td>
										<td class="minimum" v-if="!isSingleSourceActive">
											<div class="form-log-source">
												<img :src="sources[l.sourceIndex].image" />
												<span v-if="!isMobile">{{ sources[l.sourceIndex].title }}</span>
											</div>
										</td>
										<td class="minimum" v-if="!isSingleSourceForm">
											<div class="form-log-record-title">
												{{ relationIdMapRecordIdMapTitle[l.relationId]?.[l.recordId] !== undefined ? relationIdMapRecordIdMapTitle[l.relationId][l.recordId] : '-' }}
											</div>
										</td>
										<td class="minimum"><i>[{{ capGen.comment }}]</i></td>
										<td>{{ getCommentPreview(l.comment) }}</td>
									</tr>

									<!-- log line(s) for attribute values -->
									<tr class="row-clickable"
										v-if="l.comment === null"
										v-for="(a,i) in l.attributes.filter(v => !isSidebarLogFilter || v.attributeId === logShownAttributeId)"
										@click="logShownSidebarSet(l.id,a.attributeId,false)"
										:class="{ 'row-contrast':li % 2 === 0, 'row-selected':l.id === logShownId && a.attributeId === logShownAttributeId }"
										:key="'l.id' + '_' + 'a.attributeId'"
									>
										<!-- log info -->
										<template v-if="i === 0">
											<td class="minimum" :rowspan="!isSidebarLogFilter ? l.attributes.length : 1">
												{{ getDateFormatted(l.dateChange) }}
											</td>
											<td class="minimum" :rowspan="!isSidebarLogFilter ? l.attributes.length : 1" v-if="!isMobile">
												<span v-if="l.loginName !== ''">{{ l.loginName }}</span>
												<span v-if="l.loginName === ''"><i>[{{ capApp.deletedUser }}]</i></span>
											</td>
											<td class="minimum" :rowspan="!isSidebarLogFilter ? l.attributes.length : 1" v-if="!isSingleSourceActive">
												<div class="form-log-source">
													<img :src="sources[l.sourceIndex].image" />
													<span v-if="!isMobile">{{ sources[l.sourceIndex].title }}</span>
												</div>
											</td>
											<td class="minimum" :rowspan="!isSidebarLogFilter ? l.attributes.length : 1"  v-if="!isSingleSourceForm">
												<div class="form-log-record-title">
													{{ relationIdMapRecordIdMapTitle[l.relationId]?.[l.recordId] !== undefined ? relationIdMapRecordIdMapTitle[l.relationId][l.recordId] : '-' }}
												</div>
											</td>
										</template>

										<!-- log values -->
										<td class="minimum">
											<my-form-log-label
												:caption="sources[l.sourceIndex].attributeIdMapTitle[a.attributeId]"
												:iconId="sources[l.sourceIndex].attributeIdMapIcon[a.attributeId]"
											/>
										</td>
										<td>
											<my-form-log-value
												:attributeId="a.attributeId"
												:isFiles="sources[l.sourceIndex].attributeIdsFiles.includes(a.attributeId)"
												:relationId="a.relationId"
												:relationIdMapRecordIdMapTitle
												:value="a.value"
											/>
										</td>
									</tr>
								</template>
							</tbody>
						</table>
					</div>
				</div>
				<div class="form-log-sidebar" v-if="isSidebarSourcesShown || isSidebarLogShown" :class="{ underTable:isMobile && isSidebarSourcesShown }">
					<div class="column gap" v-if="isSidebarSourcesShown">
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
					<my-form-log-value-sidebar
						v-if="isSidebarLogShown"
						@close="logShownSidebarSet(null,null,false)"
						:attributeId="logShownAttributeId"
						:isFullscreen="showFullscreen"
						:isSingleSource="isSingleSourceForm"
						:log="logShownSidebar"
						:relationIdMapRecordIdMapTitle
						:source="sources[logShownSidebar.sourceIndex]"
					/>
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
			logShownAttributeId:null,
			logShownComment:false,
			logShownId:null,
			logShownFilter:true, // only show logs if they match the log in the sidebar (by attribute ID or if they also show a comment)
			showFullscreen:false,
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
			const parseFields = (fields,isFirstField,tabTitle) => {
				for(const f of fields) {
					const state = s.entityIdMapEffect.field[f.id] !== undefined
						? s.entityIdMapEffect.field[f.id] : f.state;
					
					if(state === 'hidden')
						continue;

					switch(f.content) {
						case 'container':
							parseFields(f.fields,false,'');
						break;
						case 'tabs':
							for(const t of f.tabs) {
								parseFields(t.fields,false,s.getCaption('tabTitle',s.moduleId,t.id,t.captions,''));
							}
						break;
						case 'data':
							// if field join index is available
							const src = out.find(v => v.fieldId === null && v.index === f.index);
							if(src !== undefined && !src.attributeIds.includes(f.attributeId)) {

								const isNm = f.attributeIdNm !== undefined && f.attributeIdNm !== null;
								const atr  = isNm ? s.attributeIdMap[f.attributeIdNm] : s.attributeIdMap[f.attributeId];
								const rel  = s.relationIdMap[s.joinsIndexMap[f.index].relationId];

								if(!s.relationHasRetention(rel))
									continue;

								if(isNm || s.isAttributeRelationship(atr.content)) {
									// fetch only relationship attributes, if their relation has record titles
									const relShip = s.relationIdMap[atr.relationshipId];
									if(relShip.attributeIdsTitle.length === 0)
										continue;
								}

								let title  = '';
								let iconId = f.iconId !== null ? f.iconId : atr.iconId;
								
								if(s.fieldIdMapOverwrite.caption[f.id] !== undefined)
									title = s.fieldIdMapOverwrite.caption[f.id];

								if(title === '') title = s.getCaption('fieldTitle',s.moduleId,f.id,f.captions);
								if(title === '') title = tabTitle;
								if(title === '') title = s.getCaption('attributeTitle',s.moduleId,f.attributeId,atr.captions,atr.name);
								
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

								// for list fields, we need both a title for the source as well as record titles
								// otherwise it´s not possible to see what a change belongs to
								const rel = s.relationIdMap[join.relationId];
								if(rel.attributeIdsTitle.length === 0)
									continue;

								let title = '';
								if(title === '') title = s.getCaption('fieldTitle',s.moduleId,f.id,f.captions);
								if(title === '') title = tabTitle;
								if(title === '') title = s.getCaption('relationTitle',s.moduleId,rel.id,rel.captions);
								if(title === '' && isFirstField) title = s.formTitle;

								if(title === '')
									continue;

								let src = s.getSourceTemplate(f.id,index,join.relationId,s.fieldIdMapIndexMapRecordIds[f.id][index],'images/files_list2.png',title);
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
					out.push(s.getSourceTemplate(null,j.index,j.relationId,[j.recordId],s.formIconSrc,s.formTitle));
			}
			parseFields(s.fields,true,'');
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
		logShownSidebar:s => {
			const l = s.logsShown.find(v => v.id === s.logShownId);
			return l === undefined ? null : l;
		},
		logsShown:s => {
			return s.logs.filter(v => !s.sourceFieldIdsHide.includes(s.sources[v.sourceIndex].fieldId)
				&& !s.isSidebarLogFilter
				|| (s.logShownAttributeId !== null && v.attributes.findIndex(w => w.attributeId === s.logShownAttributeId) !== -1)
				|| (s.logShownComment     === true && v.comment !== null)
			);
		},

		// simple
		isLogTableVisible:    s => !s.isMobile || !s.isSidebarLogShown,
		isSidebarLogFilter:   s => s.logShownFilter && (s.logShownAttributeId !== null || s.logShownComment !== false),
		isSidebarLogShown:    s => s.logShownSidebar !== null,
		isSidebarSourcesShown:s => !s.isSingleSource && !s.isSidebarLogShown,
		isSingleSourceActive: s => s.isSingleSource || s.sourceFieldIdsHide.length === s.sourcesFieldIds.length - 1,
		isSingleSourceForm:   s => s.isSingleSource && (s.sources.length === 0 || s.sources[0].fieldId === null),

		// stores
		attributeIdMap:s => s.$store.getters['schema/attributeIdMap'],
		relationIdMap: s => s.$store.getters['schema/relationIdMap'],
		capApp:        s => s.$store.getters.captions.formLog,
		capGen:        s => s.$store.getters.captions.generic,
		isMobile:      s => s.$store.getters.isMobile,
		settings:      s => s.$store.getters.settings
	},
	mounted() {
		window.addEventListener('keydown',this.handleHotkeys);
		this.get(false);
	},
	unmounted() {
		window.removeEventListener('keydown',this.handleHotkeys);
	},
	methods:{
		// externals
		aesGcmDecryptBase64WithPhrase,
		consoleError,
		getCaption,
		getColumnTitle,
		getHtmlStripped,
		getUnixFormat,
		isAttributeFiles,
		isAttributeRelationship,
		isAttributeRelationship11,
		isAttributeRelationshipN1,

		getCommentPreview(comment) {
			comment = this.getHtmlStripped(comment);
			return comment.length > 120 ? `${comment.substring(0,117)}...` : comment;
		},
		getDateFormatted(unix) {
			return this.getUnixFormat(unix,this.settings.dateFormat + (this.isMobile ? '' : ' H:i:S'));
		},
		getSourceTemplate(fieldId,index,relationId,recordIds,image,title) {
			return { fieldId, index, image, relationId, recordIds, title,
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
					return `${src.title} (${String(src.recordIds.length)})`;
			}
			return '';
		},
		relationHasRetention(rel) {
			return (rel.retentionCount !== null && rel.retentionCount !== 0) || (rel.retentionDays !== null && rel.retentionDays !== 0);
		},

		// actions
		handleHotkeys(e) {
			if(e.key === 'Escape') {
				e.preventDefault();

				if(this.isSidebarLogShown)
					return this.logShownSidebarSet(null,null,false);
				
				this.$emit('close');
			}
		},
		logShownSidebarSet(logId,attributeId,showComment) {
			this.logShownAttributeId = attributeId;
			this.logShownComment     = showComment;
			this.logShownId          = logId;
		},
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
					relationId:src.relationId,
					attributeIds:src.attributeIds,
					recordIds:src.recordIds,
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