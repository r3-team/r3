import {isAttributeDecimal}  from './shared/attribute.js';
import {resolveErrCode}      from './shared/error.js';
import {getQueryExpressions} from './shared/query.js';
import MyInputNumberSep      from './inputNumberSep.js';

export default {
	name:'my-list-csv',
	components:{ MyInputNumberSep },
	template:`
		<p v-if="action === 'export'">{{ capApp.message.csvExport }}</p>
		<p v-if="action === 'import'">{{ capApp.message.csvImport.replace('{COUNT}',columns.length) }}</p>
		
		<table>
			<tbody>
				<tr v-if="isExport && isImport">
					<td>{{ capApp.csvAction }}</td>
					<td>
						<select v-model="action" @change="message = ''">
							<option value="export">{{ capApp.option.csvExport }}</option>
							<option value="import">{{ capApp.option.csvImport }}</option>
						</select>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.csvHasHeader }}</td>
					<td><my-bool v-model="hasHeader" /></td>
				</tr>
				<tr>
					<td>{{ capApp.csvCommaChar }}</td>
					<td><input maxlength="1" size="1" @input="setOption('csvCharComma',$event.target.value)" v-model="charComma" />
					</td>
				</tr>
				<tr v-if="hasTime">
					<td>{{ capApp.csvTime }}</td>
					<td><input disabled="disabled" :value="capApp.csvTimeHint" /></td>
				</tr>
				<tr v-if="hasDate">
					<td>{{ capApp.csvDate }}</td>
					<td>
						<select @input="setOption('csvDateFormat',$event.target.value)" :value="dateFormat">
							<option value="Y-m-d">{{ capGen.dateFormat0 }}</option>
							<option value="Y/m/d">{{ capGen.dateFormat1 }}</option>
							<option value="d.m.Y">{{ capGen.dateFormat2 }}</option>
							<option value="d/m/Y">{{ capGen.dateFormat3 }}</option>
							<option value="m/d/Y">{{ capGen.dateFormat4 }}</option>
						</select>
					</td>
				</tr>
				<tr v-if="hasDatetime">
					<td>{{ capApp.csvDatetime }}</td>
					<td>
						<select @input="setOption('csvDateFormat',$event.target.value)" :value="dateFormat">
							<option value="Y-m-d">{{ capGen.dateFormat0 + ' ' + capApp.csvTimeHint }}</option>
							<option value="Y/m/d">{{ capGen.dateFormat1 + ' ' + capApp.csvTimeHint }}</option>
							<option value="d.m.Y">{{ capGen.dateFormat2 + ' ' + capApp.csvTimeHint }}</option>
							<option value="d/m/Y">{{ capGen.dateFormat3 + ' ' + capApp.csvTimeHint }}</option>
							<option value="m/d/Y">{{ capGen.dateFormat4 + ' ' + capApp.csvTimeHint }}</option>
						</select>
					</td>
				</tr>
				<tr v-if="hasDatetime">
					<td>{{ capApp.csvTimezone }}</td>
					<td><input disabled="disabled" :value="timezone" /></td>
				</tr>
				<tr v-if="hasBool">
					<td>{{ capApp.csvBool }}</td>
					<td>
						<select v-model="boolNative">
							<option :value="true">true / false</option>
							<option :value="false">{{ capGen.option.yes + ' / ' +capGen.option.no }}</option>
						</select>
					</td>
				</tr>
				<tr v-if="hasDecimal">
					<td>{{ capGen.numberSepThousand }}</td>
					<td>
						<my-input-number-sep
							@update:modelValue="setOption('csvCharThou',$event === '0' ? '' : $event)"
							:modelValue="charThou === '' ? '0' : charThou"
							:allowNone="true"
						/>
					</td>
				</tr>
				<tr v-if="hasDecimal">
					<td>{{ capGen.numberSepDecimal }}</td>
					<td><my-input-number-sep @update:modelValue="setOption('csvCharDec',$event)" :modelValue="charDec" :allowNone="false" /></td>
				</tr>
				<tr v-if="action === 'export'">
					<td>{{ capApp.csvTotalLimit }}</td>
					<td><input v-model.number="totalLimit" /></td>
				</tr>
				<tr v-if="action === 'import'">
					<td>{{ capApp.csvFile }}</td>
					<td><input type="file" @change="setFile" /></td>
				</tr>
			</tbody>
		</table>
		
		<transition name="fade">
			<p v-if="message !== ''" :class="{ error:messageError }">{{ message }}</p>
		</transition>
		
		<div class="row">
			<my-button image="upload.png"
				v-if="action === 'import'"
				@trigger="send"
				:active="fileSet && charComma !== ''"
				:caption="capGen.button.import"
			/>
		</div>
		
		<a download="export.csv" v-if="action === 'export'" :href="charComma !== '' ? exportHref : null">
			<my-button image="download.png" :active="charComma !== ''" :caption="capGen.button.export" />
		</a>`,
	props:{
		columns:      { type:Array,  required:true },
		columnBatches:{ type:Array,  required:true },
		filters:      { type:Array,  required:true },
		isExport:     { type:Boolean,required:true },
		isImport:     { type:Boolean,required:true },
		joins:        { type:Array,  required:true },
		loginOptions: { type:Object, required:true },
		orders:       { type:Array,  required:true },
		query:        { type:Object, required:true }
	},
	emits:['reload','set-login-option'],
	data() {
		return {
			action:'',               // CSV action (export/import)
			boolNative:true,         // use native bool strings (true/false) or translations (yes/no, ...)
			cacheDenialTimeout:null, // timer do refresh cache denial timestamp
			cacheDenialTimestamp:0,  // unix timestamp, used for CSV export cache denial
			charComma:',',
			fileElm:null,
			fileSet:false,
			hasBool:false,
			hasDate:false,
			hasDatetime:false,
			hasDecimal:false,
			hasHeader:true,
			hasTime:false,
			message:'',
			messageError:false,
			totalLimit:500
		};
	},
	mounted() {
		this.action    = this.isExport ? 'export' : 'import';
		this.charComma = this.$root.getOrFallback(this.loginOptions,'csvCharComma',',');
		
		for(let i = 0, j = this.columns.length; i < j; i++) {
			const atr = this.attributeIdMap[this.columns[i].attributeId];
			if(this.isAttributeDecimal(atr.content)) this.hasDecimal  = true;
			if(atr.content    === 'boolean')         this.hasBool     = true;
			if(atr.contentUse === 'date')            this.hasDate     = true; 
			if(atr.contentUse === 'datetime')        this.hasDatetime = true;
			if(atr.contentUse === 'time')            this.hasTime     = true;
		}
		this.cacheDenialTimeout = setInterval(this.setCacheDenialTimestamp,1000);
	},
	unmounted() {
		clearInterval(this.setCacheDenialTimestamp);
	},
	computed:{
		columnsCsv:s => {
			let out = [];
			for(const c of s.columnsSorted) {
				// only keep relevant data
				out.push({
					attributeId:c.attributeId,
					captions:c.captions
				});
			}
			return out;
		},
		columnsSorted:s => {
			let out = [];
			for(const b of s.columnBatches) {
				for(const columnIndex of b.columnIndexes) {
					out.push(s.columns[columnIndex]);
				}
			}
			return out;
		},
		exportHref:s => {
			const getters = [
				`token=${s.token}`,
				`bool_false=${s.boolNative ? 'false' : s.capGen.option.no}`,
				`bool_true=${s.boolNative ? 'true' : s.capGen.option.yes}`,
				`char_comma=${encodeURIComponent(s.charComma)}`,
				`char_dec=${encodeURIComponent(s.charDec)}`,
				`char_thou=${encodeURIComponent(s.charThou)}`,
				`date_format=${encodeURIComponent(s.dateFormat)}`,
				`timezone=${encodeURIComponent(s.timezone)}`,
				`ignore_header=${s.hasHeader ? 'false' : 'true'}`,
				`relation_id=${s.query.relationId}`,
				`columns=${encodeURIComponent(JSON.stringify(s.columnsCsv))}`,
				`joins=${encodeURIComponent(JSON.stringify(s.joins))}`,
				`expressions=${encodeURIComponent(JSON.stringify(s.expressions))}`,
				`filters=${encodeURIComponent(JSON.stringify(s.filters))}`,
				`orders=${encodeURIComponent(JSON.stringify(s.orders))}`,
				`total_limit=${s.totalLimit}`,
				`timestamp=${s.cacheDenialTimestamp}`
			];
			return `/csv/download/export.csv?${getters.join('&')}`;
		},

		// inputs
		charDec:   s => s.$root.getOrFallback(s.loginOptions,'csvCharDec','.'),
		charThou:  s => s.$root.getOrFallback(s.loginOptions,'csvCharThou',''),
		dateFormat:s => s.$root.getOrFallback(s.loginOptions,'csvDateFormat',s.settings.dateFormat),

		// simple
		expressions:s => s.getQueryExpressions(s.columnsSorted),
		timezone:   s => Intl.DateTimeFormat().resolvedOptions().timeZone,
		
		// stores
		token:         s => s.$store.getters['local/token'],
		attributeIdMap:s => s.$store.getters['schema/attributeIdMap'],
		capApp:        s => s.$store.getters.captions.list,
		capGen:        s => s.$store.getters.captions.generic,
		settings:      s => s.$store.getters.settings
	},
	methods:{
		// externals
		getQueryExpressions,
		isAttributeDecimal,
		resolveErrCode,
		
		// actions
		setCacheDenialTimestamp() {
			this.cacheDenialTimestamp = Math.floor(new Date().getTime() / 1000);
		},
		setFile(evt) {
			this.fileElm = evt.target;
			this.fileSet = true;
		},
		setMessage(msg,isError) {
			this.message      = msg;
			this.messageError = isError;
		},
		setOption(name,value) {
			this.$emit('set-login-option',name,value);
		},
		send() {
			let formData    = new FormData();
			let httpRequest = new XMLHttpRequest();
			
			httpRequest.upload.onprogress = event => {
				if(event.lengthComputable) {}
			};
			httpRequest.onerror = event => {
				this.$store.commit('busyRemove');
				this.setMessage(this.capApp.csvLoadError,true);
			};
			httpRequest.onload = event => {
				this.$store.commit('busyRemove');
				const res = JSON.parse(httpRequest.response);
				
				if(res.error === '') {
					this.setMessage(this.capApp.message.csvImportSuccess.replace('{COUNT}',res.count),false);
					this.$emit('reload');
					return;
				}
				
				const errRow = this.hasHeader ? res.count+2 : res.count+1;
				this.setMessage(this.capApp.csvLineError.replace('{COUNT}',errRow) + this.resolveErrCode(res.error),true);
			};
			formData.append('token',this.token);
			formData.append('columns',JSON.stringify(this.columnsSorted));
			formData.append('joins',JSON.stringify(this.query.joins));
			formData.append('lookups',JSON.stringify(this.query.lookups));
			formData.append('boolTrue',this.boolNative ? 'true' : this.capGen.option.yes);
			formData.append('dateFormat',this.dateFormat);
			formData.append('timezone',this.timezone);
			formData.append('charComma',this.charComma);
			formData.append('ignoreHeader',this.hasHeader ? 'true' : 'false');
			formData.append('file',this.fileElm.files[0]);
			httpRequest.open('POST','csv/upload',true);
			httpRequest.send(formData);
			
			this.fileElm.value = null;
			this.fileSet       = false;
			this.setMessage('',false);
			this.$store.commit('busyAdd');
		}
	}
};