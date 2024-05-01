import {resolveErrCode}      from './shared/error.js';
import {getQueryExpressions} from './shared/query.js';
export {MyListCsv as default};

let MyListCsv = {
	name:'my-list-csv',
	template:`
		<p v-if="action === 'export'">{{ capApp.message.csvExport }}</p>
		<p v-if="action === 'import'">{{ capApp.message.csvImport.replace('{COUNT}',columns.length) }}</p>
		
		<table>
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
				<td><input v-model="commaChar" /></td>
			</tr>
			<tr v-if="hasTime">
				<td>{{ capApp.csvTime }}</td>
				<td><input disabled="disabled" :value="capApp.csvTimeHint" /></td>
			</tr>
			<tr v-if="hasDate">
				<td>{{ capApp.csvDate }}</td>
				<td>
					<select v-model="dateFormat">
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
					<select v-model="dateFormat">
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
			<tr v-if="action === 'export'">
				<td>{{ capApp.csvTotalLimit }}</td>
				<td><input v-model.number="totalLimit" /></td>
			</tr>
			<tr v-if="action === 'import'">
				<td>{{ capApp.csvFile }}</td>
				<td><input type="file" @change="setFile" /></td>
			</tr>
		</table>
		
		<transition name="fade">
			<p v-if="message !== ''" :class="{ error:messageError }">{{ message }}</p>
		</transition>
		
		<div class="row">
			<my-button image="upload.png"
				v-if="action === 'import'"
				@trigger="send"
				:active="fileSet"
				:caption="capGen.button.import"
			/>
		</div>
		
		<a download="export.csv" v-if="action === 'export'" :href="exportHref">
			<my-button image="download.png" :caption="capGen.button.export" />
		</a>`,
	props:{
		columns:      { type:Array,  required:true },
		columnBatches:{ type:Array,  required:true },
		filters:      { type:Array,  required:true },
		isExport:     { type:Boolean,required:true },
		isImport:     { type:Boolean,required:true },
		joins:        { type:Array,  required:true },
		orders:       { type:Array,  required:true },
		query:        { type:Object, required:true }
	},
	emits:['reload'],
	data() {
		return {
			action:'',               // CSV action (export/import)
			boolNative:true,         // use native bool strings (true/false) or translations (yes/no, ...)
			cacheDenialTimeout:null, // timer do refresh cache denial timestamp
			cacheDenialTimestamp:0,  // unix timestamp, used for CSV export cache denial
			commaChar:',',
			dateFormat:'Y-m-d',
			fileElm:null,
			fileSet:false,
			hasBool:false,
			hasDate:false,
			hasDatetime:false,
			hasHeader:true,
			hasTime:false,
			message:'',
			messageError:false,
			totalLimit:500
		};
	},
	mounted() {
		this.action     = this.isExport ? 'export' : 'import';
		this.dateFormat = this.settings.dateFormat;
		
		for(let i = 0, j = this.columns.length; i < j; i++) {
			let atr = this.attributeIdMap[this.columns[i].attributeId];
			if(atr.content    === 'boolean')  this.hasBool     = true;
			if(atr.contentUse === 'date')     this.hasDate     = true; 
			if(atr.contentUse === 'datetime') this.hasDatetime = true;
			if(atr.contentUse === 'time')     this.hasTime     = true;
		}
		this.cacheDenialTimeout = setInterval(this.setCacheDenialTimestamp,1000);
	},
	unmounted() {
		clearInterval(this.cacheDenialTimeout);
	},
	computed:{
		columnsSorted:(s) => {
			let out = [];
			for(const b of s.columnBatches) {
				for(const columnIndex of b.columnIndexes) {
					out.push(s.columns[columnIndex]);
				}
			}
			return out;
		},
		exportHref:(s) => {
			let getters = [
				`token=${s.token}`,
				`bool_false=${s.boolNative ? 'false' : s.capGen.option.no}`,
				`bool_true=${s.boolNative ? 'true' : s.capGen.option.yes}`,
				`comma_char=${encodeURIComponent(s.commaChar)}`,
				`date_format=${encodeURIComponent(s.dateFormat)}`,
				`timezone=${encodeURIComponent(s.timezone)}`,
				`language_code=${s.settings.languageCode}`,
				`ignore_header=${s.hasHeader ? 'false' : 'true'}`,
				`relation_id=${s.query.relationId}`,
				`columns=${JSON.stringify(s.columnsSorted)}`,
				`joins=${JSON.stringify(s.joins)}`,
				`expressions=${JSON.stringify(s.expressions)}`,
				`filters=${JSON.stringify(s.filters)}`,
				`orders=${JSON.stringify(s.orders)}`,
				`total_limit=${s.totalLimit}`,
				`timestamp=${s.cacheDenialTimestamp}`
			];
			return `/csv/download/export.csv?${getters.join('&')}`;
		},

		// simple
		expressions:(s) => s.getQueryExpressions(s.columnsSorted),
		timezone:   (s) => Intl.DateTimeFormat().resolvedOptions().timeZone,
		
		// stores
		token:         (s) => s.$store.getters['local/token'],
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		capApp:        (s) => s.$store.getters.captions.list,
		capGen:        (s) => s.$store.getters.captions.generic,
		settings:      (s) => s.$store.getters.settings
	},
	methods:{
		// externals
		getQueryExpressions,
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
			formData.append('commaChar',this.commaChar);
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