import {resolveErrCode} from './shared/error.js';
export {MyListCsv as default};

let MyListCsv = {
	name:'my-list-csv',
	template:`<div class="contentBox float list-csv">
		<div class="top lower">
			<div class="area">
				<img class="icon" src="images/fileSheet.png" />
				<div class="caption">{{ capApp.button.csv }}</div>
			</div>
			<div class="area">
				<my-button image="cancel.png"
					@trigger="$emit('close')"
					:blockBubble="true"
					:cancel="true"
				/>
			</div>
		</div>
		<div class="content grow default-inputs">
			<p v-if="action === 'export'">{{ capApp.message.csvExport }}</p>
			<p v-if="action === 'import'">{{ capApp.message.csvImport.replace('{COUNT}',this.columns.length) }}</p>
			
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
			
			<my-button image="upload.png"
				v-if="action === 'import'"
				@trigger="send"
				:active="file !== null"
				:caption="capGen.button.import"
			/>
			
			<a download="export.csv"
				v-if="action === 'export'"
				:href="exportHref"
			>
				<my-button image="download.png" :caption="capGen.button.export" />
			</a>
		</div>
	</div>`,
	props:{
		columns:    { type:Array,  required:true },
		expressions:{ type:Array,  required:true },
		filters:    { type:Array,  required:true },
		isExport:   { type:Boolean,required:true },
		isImport:   { type:Boolean,required:true },
		joins:      { type:Array,  required:true },
		orders:     { type:Array,  required:true },
		query:      { type:Object, required:true }
	},
	emits:['close','reload'],
	data() {
		return {
			action:'',               // CSV action (export/import)
			boolNative:true,         // use native bool strings (true/false) or translations (yes/no, ...)
			cacheDenialTimeout:null, // timer do refresh cache denial timestamp
			cacheDenialTimestamp:0,  // unix timestamp, used for CSV export cache denial
			commaChar:',',
			dateFormat:'Y-m-d',
			file:null,
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
				`columns=${JSON.stringify(s.columns)}`,
				`joins=${JSON.stringify(s.joins)}`,
				`expressions=${JSON.stringify(s.expressions)}`,
				`filters=${JSON.stringify(s.filters)}`,
				`orders=${JSON.stringify(s.orders)}`,
				`total_limit=${s.totalLimit}`,
				`timestamp=${s.cacheDenialTimestamp}`
			];
			return `/csv/download/export.csv?${getters.join('&')}`;
		},
		timezone:(s) => Intl.DateTimeFormat().resolvedOptions().timeZone,
		
		// stores
		token:         (s) => s.$store.getters['local/token'],
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		capApp:        (s) => s.$store.getters.captions.list,
		capGen:        (s) => s.$store.getters.captions.generic,
		settings:      (s) => s.$store.getters.settings
	},
	methods:{
		// externals
		resolveErrCode,
		
		// actions
		setCacheDenialTimestamp() {
			this.cacheDenialTimestamp = Math.floor(new Date().getTime() / 1000);
		},
		setFile(evt) {
			this.file = evt.target.files[0];
		},
		send() {
			let that = this;
			let formData    = new FormData();
			let httpRequest = new XMLHttpRequest();
			
			httpRequest.upload.onprogress = function(event) {
				if(event.lengthComputable) {}
			};
			httpRequest.onload = function(event) {
				that.$store.commit('busyRemove');
				let res = JSON.parse(httpRequest.response);
				
				if(res.error === '') {
					that.message = that.capApp.message.csvImportSuccess.replace('{COUNT}',res.count);
					that.$emit('reload');
					return;
				}
				
				let errRow = that.hasHeader ? res.count+2 : res.count+1;
				
				that.messageError = true;
				that.message = that.capApp.csvLineError.replace(
					'{COUNT}',errRow) + that.resolveErrCode(res.error);
			};
			formData.append('token',this.token);
			formData.append('columns',JSON.stringify(this.columns));
			formData.append('joins',JSON.stringify(this.query.joins));
			formData.append('lookups',JSON.stringify(this.query.lookups));
			formData.append('boolTrue',this.boolNative ? 'true' : this.capGen.option.yes);
			formData.append('dateFormat',this.dateFormat);
			formData.append('timezone',this.timezone);
			formData.append('commaChar',this.commaChar);
			formData.append('ignoreHeader',this.hasHeader ? 'true' : 'false');
			formData.append('file',this.file);
			httpRequest.open('POST','csv/upload',true);
			httpRequest.send(formData);
			
			that.message      = '';
			that.messageError = false;
			that.$store.commit('busyAdd');
		}
	}
};