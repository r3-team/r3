import MyField                         from './field.js';
import {aesGcmDecryptBase64WithPhrase} from './shared/crypto.js';
import {consoleError}                  from './shared/error.js';
import {getUnixFormat}                 from './shared/time.js';
import {
	getAttributeFileHref,
	getDetailsFromIndexAttributeId,
	getIndexAttributeId,
	getIndexAttributeIdByField,
	isAttributeFiles
} from './shared/attribute.js';
export {MyFormLog as default};

let MyFormLog = {
	name:'my-form-log',
	components:{MyField},
	template:`<div class="form-log contentBox" :class="{ 'pop-up':isPopUp }">
		<div class="top">
			<div class="area">
				<img class="icon" src="images/time.png" />
				<h1>{{ capApp.title }}</h1>
			</div>
			
			<div class="area">
				<my-button image="cancel.png"
					@trigger="$emit('close-log')"
					:cancel="true"
					:tight="true"
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
							:dataFieldMap="dataFieldMap"
							:field="indexAttributeIdMapField[ia]"
							:fieldIdMapState="fieldIdMapState"
							:formBadSave="false"
							:formIsPopUp="true"
							:formIsSingleField="false"
							:formLoading="loading"
							:formReadonly="false"
							:logViewer="true"
							:isFullPage="false"
							:joinsIndexMap="joinsIndexMap"
							:key="indexAttributeIdMapField[ia].id"
							:values="{ ...values, ...l.values }"
						/>
						
						<!-- file attribute logs -->
						<div class="field readonly" v-else>
							<div class="input-box disabled">
								<div class="caption">
									{{ displayFieldCaption(indexAttributeIdMapField[ia]) }}
								</div>
								<div class="input-line">
									<table class="file-changes">
										<tr v-for="(c,fileId) in v.fileIdMapChange">
											<td v-if="c.action === 'create'">{{ capApp.fileCreated }}</td>
											<td v-if="c.action === 'delete'">{{ capApp.fileDeleted }}</td>
											<td v-if="c.action === 'rename'">{{ capApp.fileRenamed }}</td>
											<td v-if="c.action === 'update'">{{ capApp.fileUpdated }}</td>
											<td>
												<a target="_blank" :href="getAttributeFileHref(indexAttributeIdMapField[ia].attributeId,fileId,c.name,token)">
													<my-button image="download.png"
														:caption="c.name"
														:naked="true"
													/>
												</a>
											</td>
										</tr>
									</table>
								</div>
							</div>
						</div>
					</template>
				</div>
			</div>
		</div>
	</div>`,
	props:{
		dataFieldMap:     { type:Object,  required:true },
		fieldIdMapState:  { type:Object,  required:true },
		form:             { type:Object,  required:true },
		formLoading:      { type:Boolean, required:true },
		isPopUp:          { type:Boolean, required:true },
		indexMapRecordKey:{ type:Object,  required:true },
		joinsIndexMap:    { type:Object,  required:true },
		values:           { type:Object,  required:true }
	},
	emits:['close-log'],
	watch:{
		formLoading:function(v) {
			if(!v) this.get();
		}
	},
	data:function() {
		return {
			loading:false,
			logs:[],
			logsShown:[]
		};
	},
	computed:{
		attributeIdsFiles:(s) => {
			let out = [];
			for(let k in s.dataFieldMap) {
				let atr = s.attributeIdMap[s.dataFieldMap[k].attributeId];
				
				if(s.isAttributeFiles(atr.content))
					out.push(atr.id);
			}
			return out;
		},
		indexAttributeIdMapField:(s) => {
			let out = {};
			for(let k in s.dataFieldMap) {
				let f   = s.dataFieldMap[k];
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
		moduleLanguage:(s) => s.$store.getters.moduleLanguage,
		settings:      (s) => s.$store.getters.settings,
		token:         (s) => s.$store.getters['local/token']
	},
	mounted:function() {
		this.get();
	},
	methods:{
		// externals
		aesGcmDecryptBase64WithPhrase,
		consoleError,
		getAttributeFileHref,
		getDetailsFromIndexAttributeId,
		getIndexAttributeId,
		getIndexAttributeIdByField,
		getUnixFormat,
		isAttributeFiles,
		
		// presentation
		displayFieldCaption:function(f) {
			if(typeof f.captions.fieldTitle[this.moduleLanguage] !== 'undefined')
				return f.captions.fieldTitle[this.moduleLanguage];
			
			let atr = this.attributeIdMap[f.attributeId];
			
			return typeof atr.captions.attributeTitle[this.moduleLanguage] !== 'undefined'
				? atr.captions.attributeTitle[this.moduleLanguage]
				: atr.name;
		},
		displayTitle:function(i,unixTime,name) {
			if(name === '') name = this.capApp.deletedUser;
			let prefix = this.logsShown.includes(i) ? '\u2BC6' : '\u2BC8';
			let format = [this.settings.dateFormat,'H:i:S'];
			return `${prefix} ${this.getUnixFormat(unixTime,format.join(' '))} (${name})`;
		},
		isFiles:function(ia) {
			let d = this.getDetailsFromIndexAttributeId(ia);
			let a = this.attributeIdMap[d.attributeId];
			return this.isAttributeFiles(a.content);
		},
		
		// actions
		toggleLog:function(i) {
			const pos = this.logsShown.indexOf(i);
			
			if(pos === -1) this.logsShown.push(i);
			else           this.logsShown.splice(pos,1);
			
			this.loading = true;
			this.releaseLoadingOnNextTick();
		},
		toggleAll:function() {
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
		releaseLoadingOnNextTick:function() {
			this.$nextTick(function() {
				this.loading = false;
			});
		},
		reset:function() {
			this.logs      = [];
			this.logsShown = [];
		},
		
		// backend calls
		get:function() {
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