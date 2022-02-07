import {resolveErrCode} from './shared/error.js';
export {MyListCsv as default};

let MyListCsv = {
	name:'my-list-csv',
	template:`<div class="list-header">
	
		<div class="list-csv-line">
			<p v-if="action === 'export'">{{ capApp.message.csvExport }}</p>
			<p v-if="action === 'import'">{{ capApp.message.csvImport.replace('{COUNT}',this.columns.length) }}</p>
		</div>
		
		<div class="list-csv-line"
			v-if="isExport && isImport"
		>
			<span>{{ capApp.csvAction }}</span>
			<select v-model="action" @change="message = ''">
				<option value="export">{{ capApp.option.csvExport }}</option>
				<option value="import">{{ capApp.option.csvImport }}</option>
			</select>
		</div>
		
		<div class="list-csv-line">
			<span>{{ capApp.csvHasHeader }}</span>
			<my-bool v-model="hasHeader" />
		</div>
		
		<div class="list-csv-line">
			<span>{{ capApp.csvCommaChar }}</span>
			<input v-model="commaChar" />
		</div>
		
		<div class="list-csv-line" v-if="hasTime">
			<span>{{ capApp.csvTime }}</span>
			<input disabled="disabled" :value="capApp.csvTimeHint" />
		</div>
		
		<div class="list-csv-line" v-if="hasDate">
			<span>{{ capApp.csvDate }}</span>
			<input disabled="disabled" :value="settings.dateFormat" />
		</div>
		
		<div class="list-csv-line" v-if="hasDatetime">
			<span>{{ capApp.csvDatetime }}</span>
			<input disabled="disabled" :value="settings.dateFormat + ' ' + capApp.csvTimeHint" />
		</div>
		
		<div class="list-csv-line" v-if="hasDatetime">
			<span>{{ capApp.csvTimezone }}</span>
			<input disabled="disabled" :value="timezone" />
		</div>
		
		<div class="list-csv-line" v-if="hasBool">
			<span>{{ capApp.csvBool }}</span>
			<select v-model="boolNative">
				<option :value="true">true / false</option>
				<option :value="false">
					{{ capGen.option.yes + ' / ' +capGen.option.no }}
				</option>
			</select>
		</div>
		
		<div class="list-csv-line" v-if="action === 'export'">
			<span>{{ capApp.csvTotalLimit }}</span>
			<input v-model.number="totalLimit" />
		</div>
		
		<div class="list-csv-line" v-if="action === 'import'">
			<span>{{ capApp.csvFile }}</span>
			<input type="file" @change="setFile" />
		</div>
		
        <transition name="fade">
			<span class="message"
				v-if="message !== ''"
				:class="{ error:messageError }"
			>{{ message }}</span>
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
			<my-button image="download.png"
				:caption="capGen.button.export"
			/>
		</a>
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
	emits:['reload'],
	data:function() {
		return {
			action:'',       // CSV action (export/import)
			boolNative:true, // use native bool strings (true/false) or translations (yes/no, ...)
			commaChar:',',
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
	mounted:function() {
		this.action = this.isExport ? 'export' : 'import';
		
		for(let i = 0, j = this.columns.length; i < j; i++) {
			
			let atr = this.attributeIdMap[this.columns[i].attributeId];
			if(atr.content === 'boolean')
				this.hasBool = true;
			
			if(this.columns[i].display === 'date')
				this.hasDate =  true;
			
			if(this.columns[i].display === 'datetime')
				this.hasDatetime =  true;
			
			if(this.columns[i].display === 'time')
				this.hasTime =  true;
		}
	},
	computed:{
		exportHref:function() {
			let getters = [
				`token=${this.token}`,
				`bool_false=${this.boolNative ? 'false' : this.capGen.option.no}`,
				`bool_true=${this.boolNative ? 'true' : this.capGen.option.yes}`,
				`comma_char=${encodeURIComponent(this.commaChar)}`,
				`date_format=${encodeURIComponent(this.settings.dateFormat)}`,
				`timezone=${encodeURIComponent(this.timezone)}`,
				`ignore_header=${this.hasHeader ? 'false' : 'true'}`,
				`relation_id=${this.query.relationId}`,
				`columns=${JSON.stringify(this.columns)}`,
				`joins=${JSON.stringify(this.joins)}`,
				`expressions=${JSON.stringify(this.expressions)}`,
				`filters=${JSON.stringify(this.filters)}`,
				`orders=${JSON.stringify(this.orders)}`,
				`total_limit=${this.totalLimit}`
			];
			return `/csv/download/export.csv?${getters.join('&')}`;
		},
		timezone:function() {
			return Intl.DateTimeFormat().resolvedOptions().timeZone;
		},
		
		// stores
		token:         function() { return this.$store.getters['local/token']; },
		attributeIdMap:function() { return this.$store.getters['schema/attributeIdMap']; },
		capApp:        function() { return this.$store.getters.captions.list; },
		capGen:        function() { return this.$store.getters.captions.generic; },
		settings:      function() { return this.$store.getters.settings; }
	},
	methods:{
		// externals
		resolveErrCode,
		
		// actions
		setFile:function(evt) {
			this.file = evt.target.files[0];
		},
		send:function() {
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
			formData.append('dateFormat',this.settings.dateFormat);
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