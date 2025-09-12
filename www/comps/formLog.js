import MyField                         from './field.js';
import {aesGcmDecryptBase64WithPhrase} from './shared/crypto.js';
import {consoleError}                  from './shared/error.js';
import {getFieldOverwriteDefault}      from './shared/field.js';
import {getCaption}                    from './shared/language.js';
import {getUnixFormat}                 from './shared/time.js';
import {
	getAttributeFileHref,
	getAttributeFileVersionHref,
	getDetailsFromIndexAttributeId,
	getIndexAttributeId,
	getIndexAttributeIdByField,
	isAttributeFiles
} from './shared/attribute.js';

export default {
	name:'my-form-log',
	components:{MyField},
	template:`<div class="form-log contentBox" :class="{ 'float':isPopUpFloating }">
		<div class="top">
			<div class="area">
				<img class="icon" src="images/time.png" />
				<h1>{{ capApp.title }}</h1>
			</div>
			
			<div class="area">
				<my-button image="cancel.png"
					@trigger="$emit('close-log')"
					:cancel="true"
				/>
			</div>
		</div>
		<div class="top lower">
			<div class="area">
				<my-button 
					@trigger="toggleAll"
					:active="logs.length !== 0"
					:caption="capApp.button.showAll.replace('{CNT}',logs.length)"
					:image="logsShown.length === logs.length ? 'triangleDown.png' : 'triangleRight.png'"
				/>
			</div>
		</div>
		
		<div class="log-entries">
			<span v-if="logs.length === 0">{{ capGen.nothingThere }}</span>
			
			<div class="entry" v-for="(l,i) in logs">
				<div>
					<my-button
						@trigger="toggleLog(i)"
						:caption="displayTitle(i,l.dateChange,l.loginName)"
						:naked="true"
					/>
				</div>
				
				<div class="log-fields" v-if="logsShown.includes(i)">
					<template v-for="(v,ia) in l.values">
						
						<!-- regular attribute logs -->
						<my-field flexDirParent="column"
							v-if="!isFiles(ia)"
							:entityIdMapEffect
							:field="indexAttributeIdMapField[ia]"
							:fieldIdMapOptions
							:fieldIdMapOverwrite
							:fieldIdMapProcessed
							:formBadSave="false"
							:formBlockInputs="false"
							:formIsEmbedded="true"
							:formLoading="loading"
							:logViewer="true"
							:isAloneInForm="false"
							:joinsIndexMap
							:key="indexAttributeIdMapField[ia].id"
							:moduleId
							:values="{ ...values, ...l.values }"
							:variableIdMapLocal
						/>
						
						<!-- file attribute logs -->
						<div class="field readonly" v-else>
							<div class="field-caption">
								{{ displayFieldCaption(indexAttributeIdMapField[ia]) }}
							</div>
							<div class="field-content intent data disabled">
								<table class="file-changes">
									<tbody>
										<tr v-for="(c,fileId) in v.fileIdMapChange">
											<td v-if="c.action === 'create'">{{ capApp.fileCreated }}</td>
											<td v-if="c.action === 'delete'">{{ capApp.fileDeleted }}</td>
											<td v-if="c.action === 'rename'">{{ capApp.fileRenamed }}</td>
											<td v-if="c.action === 'update'">{{ capApp.fileUpdated }}</td>
											<td>
												<!-- latest file version -->
												<a target="_blank"
													v-if="c.action !== 'update'"
													:href="getAttributeFileHref(indexAttributeIdMapField[ia].attributeId,fileId,c.name,token)"
												>
													<my-button image="download.png"
														:caption="c.name"
														:naked="true"
													/>
												</a>
												<!-- specific file version -->
												<a target="_blank"
													v-else
													:href="getAttributeFileVersionHref(indexAttributeIdMapField[ia].attributeId,fileId,c.name,c.version,token)"
												>
													<my-button image="download.png"
														:caption="c.name + ' (v' + c.version + ')'"
														:naked="true"
													/>
												</a>
											</td>
										</tr>
									</tbody>
								</table>
							</div>
						</div>
					</template>
				</div>
			</div>
		</div>
	</div>`,
	props:{
		entityIdMapEffect:  { type:Object,  required:true },
		fieldIdMapData:     { type:Object,  required:true },
		fieldIdMapProcessed:{ type:Object,  required:true },
		formLoading:        { type:Boolean, required:true },
		isPopUpFloating:    { type:Boolean, required:true },
		indexMapRecordKey:  { type:Object,  required:true },
		joinsIndexMap:      { type:Object,  required:true },
		moduleId:           { type:String,  required:true },
		values:             { type:Object,  required:true },
		variableIdMapLocal: { type:Object,  required:true }
	},
	emits:['close-log'],
	watch:{
		formLoading(v) {
			if(!v) this.get();
		}
	},
	data() {
		return {
			fieldIdMapOptions:{},
			fieldIdMapOverwrite:{},
			loading:false,
			logs:[],
			logsShown:[]
		};
	},
	computed:{
		indexAttributeIdMapField:(s) => {
			let out = {};
			for(let k in s.fieldIdMapData) {
				let f   = s.fieldIdMapData[k];
				let ia1 = s.getIndexAttributeIdByField(f,false);
				let ia2 = s.getIndexAttributeIdByField(f,true);
				
				if(typeof ia1 !== 'undefined') out[ia1] = f;
				if(typeof ia2 !== 'undefined') out[ia2] = f;
			}
			return out;
		},
		
		// stores
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		capApp:        (s) => s.$store.getters.captions.formLog,
		capGen:        (s) => s.$store.getters.captions.generic,
		settings:      (s) => s.$store.getters.settings,
		token:         (s) => s.$store.getters['local/token']
	},
	mounted() {
		this.fieldIdMapOverwrite = this.getFieldOverwriteDefault();
		this.get();
	},
	methods:{
		// externals
		aesGcmDecryptBase64WithPhrase,
		consoleError,
		getAttributeFileHref,
		getAttributeFileVersionHref,
		getCaption,
		getDetailsFromIndexAttributeId,
		getFieldOverwriteDefault,
		getIndexAttributeId,
		getIndexAttributeIdByField,
		getUnixFormat,
		isAttributeFiles,
		
		// presentation
		displayFieldCaption(f) {
			const atr = this.attributeIdMap[f.attributeId];
			return this.getCaption('fieldTitle',this.moduleId,f.id,f.captions,
				this.getCaption('attributeTitle',this.moduleId,atr.Id,atr.captions,atr.name));
		},
		displayTitle(i,unixTime,name) {
			if(name === '') name = this.capApp.deletedUser;
			let prefix = this.logsShown.includes(i) ? '\u2BC6' : '\u2BC8';
			let format = [this.settings.dateFormat,'H:i:S'];
			return `${prefix} ${this.getUnixFormat(unixTime,format.join(' '))} (${name})`;
		},
		isFiles(ia) {
			let d = this.getDetailsFromIndexAttributeId(ia);
			let a = this.attributeIdMap[d.attributeId];
			return this.isAttributeFiles(a.content);
		},
		
		// actions
		toggleLog(i) {
			const pos = this.logsShown.indexOf(i);
			
			if(pos === -1) this.logsShown.push(i);
			else           this.logsShown.splice(pos,1);
			
			this.loading = true;
			this.releaseLoadingOnNextTick();
		},
		toggleAll() {
			if(this.logsShown.length < this.logs.length) {
				for(let i = this.logs.length - 1; i >= 0; i--) {
					this.logsShown.push(i);
				}
				this.loading = true;
				this.releaseLoadingOnNextTick();
				return;
			}
			this.logsShown = [];
		},
		releaseLoadingOnNextTick() {
			this.$nextTick(function() {
				this.loading = false;
			});
		},
		reset() {
			this.logs      = [];
			this.logsShown = [];
		},
		
		// backend calls
		get() {
			if(this.formLoading)
				return;
			
			let attributeIdsEnc = [];
			let requests        = [];
			
			for(let index in this.joinsIndexMap) {
				let j = this.joinsIndexMap[index];
				
				// only get logs for relations that can be changed on this form
				if(!j.applyCreate && !j.applyUpdate)
					continue;
				
				// request log data for attributes on this form
				let attributeIds = [];
				for(let k in this.values) {
					let d = this.getDetailsFromIndexAttributeId(k);
					
					if(d.index !== parseInt(index))
						continue;
					
					const a = this.attributeIdMap[d.attributeId];
					
					if(a.encrypted)
						attributeIdsEnc.push(a.id);
					
					attributeIds.push(a.id);
				}
				
				// get logs for this relation if any attributes are available and record is set
				if(attributeIds.length !== 0 && j.recordId !== 0)
					requests.push(ws.prepare('data','getLog',{
						recordId:j.recordId,
						index:parseInt(index),
						attributeIds:attributeIds
					}));
			}
			
			if(requests.length === 0)
				return this.reset();
			
			ws.sendMultiple(requests,true).then(
				async (res) => {
					this.loading = true;
					this.reset();
					
					// store logs grouped by composite key of date+login ID
					// each log connects to a single relation - a change spanning multiple relations is therefore grouped
					let logsGrouped = {};
					let parseLogsForRelation = async (logs,request) => {
						for(const l of logs) {
							let g = `${l.dateChange}_${l.loginName}`;
							
							if(typeof logsGrouped[g] === 'undefined')
								logsGrouped[g] = {
									dateChange:l.dateChange,
									loginName:l.loginName,
									values:{}
								};
							
							for(const a of l.attributes) {
								let value = JSON.parse(a.value);
								
								if(attributeIdsEnc.includes(a.attributeId)) {
									const keyStr = this.indexMapRecordKey[request.index];
									
									if(typeof keyStr === 'undefined')
										throw new Error('no data key for record');
									
									value = await this.aesGcmDecryptBase64WithPhrase(value,keyStr);
								}
								
								logsGrouped[g].values[this.getIndexAttributeId(
									request.index,
									a.attributeId,
									a.outsideIn,
									a.attributeIdNm
								)] = value;
							}
						}
					};
					
					for(let i = 0, j = res.length; i < j; i++) {
						try      { await parseLogsForRelation(res[i].payload,requests[i].payload); }
						catch(e) {
							this.consoleError(e); // full error for troubleshooting
							this.$root.genericErrorWithFallback(e.message,'SEC','003');
							return;
						}
					}
					
					// sort groups by their composite key, effectively sorting by date
					let keys = Object.keys(logsGrouped).sort().reverse();
					for(let i = 0, j = keys.length; i < j; i++) {
						this.logs.push(logsGrouped[keys[i]]);
					}
					this.releaseLoadingOnNextTick();
				},
				this.$root.genericError
			);
		}
	}
};