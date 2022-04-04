import MyField                         from './field.js';
import {aesGcmDecryptBase64WithPhrase} from './shared/crypto.js';
import {consoleError}                  from './shared/error.js';
import {getDataFields}                 from './shared/form.js';
import {getUnixFormat}                 from './shared/time.js';
import {
	getDetailsFromIndexAttributeId,
	getIndexAttributeId,
	getIndexAttributeIdByField
} from './shared/attribute.js';
export {MyFormLog as default};

let MyFormLog = {
	name:'my-form-log',
	components:{MyField},
	template:`<div class="log contentBox">
		<div class="top">
			<div class="area">
				<img class="icon" src="images/time.png" />
				<h1>{{ capApp.dataLog }}</h1>
			</div>
			
			<my-button image="cancel.png"
				@trigger="$emit('close-log')"
				:cancel="true"
				:darkBg="true"
			/>
		</div>
		<div class="top lower">
			<div class="area">
				<my-button 
					@trigger="toggleAll"
					:active="logs.length !== 0"
					:caption="capApp.button.retractLogs"
					:darkBg="true"
					:image="logsHidden.length === logs.length ? 'checkbox1.png' : 'checkbox0.png'"
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
				
				<div class="log-fields" v-show="!logsHidden.includes(i)">
					<template v-for="f in dataFields">
						<my-field flexDirParent="column"
							v-if="hasValueInLog(l,f)"
							:dataFieldMap="dataFieldMap"
							:field="f"
							:fieldIdMapState="fieldIdMapState"
							:formBadLoad="false"
							:formBadSave="false"
							:formIsInline="true"
							:formLoading="loading"
							:logViewer="true"
							:isFullPage="false"
							:joinsIndexMap="joinsIndexMap"
							:key="f.id"
							:values="{ ...values, ...l.values }"
						/>
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
			logsHidden:[]
		};
	},
	computed:{
		dataFields:function() { return this.getDataFields(this.form.fields); },
		
		// stores
		attributeIdMap:function() { return this.$store.getters['schema/attributeIdMap']; },
		capApp:        function() { return this.$store.getters.captions.form; },
		capGen:        function() { return this.$store.getters.captions.generic; },
		settings:      function() { return this.$store.getters.settings; }
	},
	mounted:function() {
		this.get();
	},
	methods:{
		// externals
		aesGcmDecryptBase64WithPhrase,
		consoleError,
		getDataFields,
		getDetailsFromIndexAttributeId,
		getIndexAttributeId,
		getIndexAttributeIdByField,
		getUnixFormat,
		
		// presentation
		displayTitle:function(i,unixTime,name) {
			if(name === '') name = this.capApp.deletedUser;
			let prefix = this.logsHidden.includes(i) ? '\u2BC8' : '\u2BC6';
			let format = [this.settings.dateFormat,'H:i:S'];
			return `${prefix} ${this.getUnixFormat(unixTime,format.join(' '))} (${name})`;
		},
		hasValueInLog:function(l,f) {
			return typeof l.values[this.getIndexAttributeIdByField(f,false)] !== 'undefined'
				|| typeof l.values[this.getIndexAttributeIdByField(f,true)] !== 'undefined'
			;
		},
		
		// actions
		toggleLog:function(i) {
			let pos = this.logsHidden.indexOf(i);
			
			if(pos === -1) this.logsHidden.push(i);
			else           this.logsHidden.splice(pos,1);
		},
		toggleAll:function() {
			if(this.logsHidden.length < this.logs.length) {
				this.logsHidden = [];
				
				for(let i = this.logs.length - 1; i >= 0; i--) {
					this.logsHidden.push(i);
				}
				return;
			}
			this.logsHidden = [];
		},
		reset:function() {
			this.logs       = [];
			this.logsHidden = [];
		},
		releaseLoadingOnNextTick:function() {
			this.$nextTick(function() {
				this.loading = false;
			});
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
					
					let a = this.attributeIdMap[d.attributeId];
					
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