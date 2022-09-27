import {isAttributeFiles} from './shared/attribute.js';
import {
	getUnixFormat,
	getUtcTimeStringFromUnix
} from './shared/time.js';
export {MyListColumnBatch as default};

let MyListColumnBatch = {
	name:'my-list-column-batch',
	template:`<div class="columnBatch">
		<div class="columBatchCaption"
			@click.left="$emit('click-left')"
			@click.right.prevent="$emit('click-right')"
			:class="{ clickable:columnBatch.columnIndexSortBy !== -1 }"
		><span>{{ caption }}</span></div>
		
		<my-button
			v-if="isValidFilter && (rowCount > 5 || active || filtersColumn.length !== 0)"
			@trigger="$emit(show ? 'close' : 'open')"
			:blockBubble="true"
			:caption="active && isArrayInput ? String(input.length) : ''"
			:image="active ? 'filterFull.png' : 'filterTransp.png'"
			:naked="true"
			:tight="true"
		/>
		
		<!-- column filter dropdown -->
		<div class="input-dropdown-wrap columnFilterWrap"
			v-if="show"
			v-click-outside="escaped"
			:class="{ firstInRow:firstInRow }"
		>
			<div class="input-dropdown default-inputs columnFilter">
				
				<!-- text filter -->
				<div class="row gap" v-if="values.length >= 5 && !isDateOrTime">
					<input
						v-model="input"
						:disabled="isArrayInput"
						:placeholder="capApp.columnFilter.contains"
						@keyup.enter="set"
					/>
					<my-button image="ok.png"
						@trigger="set"
						:active="!isArrayInput && input !== ''"
					/>
				</div>
				
				<!-- select all -->
				<my-button
					v-if="values.length >= 3"
					@trigger="valueToggleAll"
					:caption="'['+capGen.button.selectAll+']'"
					:image="input.length === values.length ? 'checkbox1.png' : 'checkbox0.png'"
					:naked="true"
					:tight="true"
				/>
				
				<!-- select values -->
				<div class="columnFilterValues">
					<my-button
						v-for="v of values"
						@trigger="valueToggle(v)"
						:caption="displayValue(v)"
						:image="input.includes(v) ? 'checkbox1.png' : 'checkbox0.png'"
						:naked="true"
						:tight="true"
					/>
				</div>
				
				<!-- actions -->
				<div class="row space-between">
					<my-button image="remove.png"
						@trigger="input = ''; set()"
						:active="input !== ''"
						:cancel="true"
						:caption="capGen.button.clear"
					/>
					<my-button image="cancel.png"
						@trigger="$emit('close')"
						:cancel="true"
						:captionTitle="capGen.button.close"
					/>
				</div>
			</div>
		</div>
	</div>`,
	props:{
		caption:      { type:String,  required:true }, // column caption
		columnBatch:  { type:Object,  required:true }, // column batch to show filters for
		columns:      { type:Array,   required:true }, // list columns
		filters:      { type:Array,   required:true }, // list filters
		filtersColumn:{ type:Array,   required:true }, // list filters from column filters
		firstInRow:   { type:Boolean, required:true },
		joins:        { type:Array,   required:true }, // list joins
		relationId:   { type:String,  required:true }, // list query base relation ID
		rowCount:     { type:Number,  required:true }, // list row count
		show:         { type:Boolean, required:true }
	},
	emits:['click-left','click-right','close','open','set-filters'],
	data:function() {
		return {
			active:false,      // filter active from this column
			input:'',          // value input (either string if text, or array if selected from values)
			values:[],         // values available to filter with (all values a list could have for column)
			valuesLoaded:false // values loaded once
		};
	},
	mounted:function() {
		if(this.isValidFilter)
			this.$watch('show',v => this.loadValues());
	},
	computed:{
		columnUsed:(s) => {
			for(let ind of s.columnBatch.columnIndexes) {
				let c = s.columns[ind];
				let a = s.attributeIdMap[c.attributeId];
				
				// ignore color display, sub query, aggregator, encrypted and file attribute columns
				if(c.display !== 'color' && c.query === null && c.aggregator === null &&
					!a.encrypted && !s.isAttributeFiles(a.content)) {
					
					return c;
				}
			}
			return null;
		},
		
		// simple
		isArrayInput:  (s) => typeof s.input === 'object',
		isDateOrTime:  (s) => s.isValidFilter && ['datetime','date','time'].includes(s.columnUsed.display),
		isValidFilter: (s) => s.columnUsed !== null,
		
		// stores
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		capApp:        (s) => s.$store.getters.captions.list,
		capGen:        (s) => s.$store.getters.captions.generic,
		dateFormat:    (s) => s.$store.getters.settings.dateFormat
	},
	methods:{
		// externals
		getUnixFormat,
		getUtcTimeStringFromUnix,
		isAttributeFiles,
		
		// presentation
		displayValue(v) {
			if(v === null)
				return '[' + this.capGen.button.empty + ']';
			
			switch(this.columnUsed.display) {
				case 'datetime': return this.getUnixFormat(v,this.dateFormat + ' H:i'); break;
				case 'date':     return this.getUnixFormat(v,this.dateFormat);          break;
				case 'time':     return this.getUtcTimeStringFromUnix(v);               break;
				default: return String(v); break;
			}
		},
		
		// actions
		escaped() {
			this.$emit('close');
		},
		valueToggle(v) {
			if(typeof this.input !== 'object')
				this.input = [];
			
			let p = this.input.indexOf(v);
			if(p !== -1) this.input.splice(p,1);
			else         this.input.push(v);
			
			if(this.input.length === 0)
				this.input = '';
			
			this.set();
		},
		valueToggleAll() {
			if(typeof this.input !== 'object')
				this.input = [];
			
			if(this.input.length === this.values.length)
				this.input = [];
			else
				this.input = JSON.parse(JSON.stringify(this.values));
			
			this.set();
		},
		
		// retrieval
		loadValues() {
			if(!this.show || !this.isValidFilter || this.valuesLoaded)
				return;
			
			ws.send('data','get',{
				relationId:this.relationId,
				joins:this.joins,
				expressions:[{
					attributeId:this.columnUsed.attributeId,
					index:this.columnUsed.index,
					aggregator:'first',
					distincted:true
				}],
				filters:this.filters,
				orders:[{ascending:true,expressionPos:0}],
				limit:1000
			},false).then(
				res => {
					for(let row of res.payload.rows) {
						this.values.push(row.values[0]);
					}
					this.valuesLoaded = true;
				},
				this.$root.genericError
			);
		},
		
		// updates
		set() {
			if(!this.isValidFilter)
				return;
			
			let atrId    = this.columnUsed.attributeId;
			let atrIndex = this.columnUsed.index;
			let filters  = JSON.parse(JSON.stringify(this.filtersColumn));
			
			// remove existing filter
			for(let i = 0, j = filters.length; i < j; i++) {
				let f = filters[i];
				if(f.side0.attributeId === atrId && f.side0.attributeIndex === atrIndex) {
					filters.splice(i,1);
					i--; j--;
				}
			}
			
			this.active = (
				!this.isArrayInput && this.input !== '' ||
				this.isArrayInput  && this.input.length !== 0
			);
			
			if(this.active) {
				let hasNull = this.isArrayInput && this.input.includes(null);
				filters.push({
					connector:'AND',
					operator:typeof this.input === 'string' ? 'ILIKE' : '= ANY',
					side0:{
						attributeId:atrId,
						attributeIndex:atrIndex,
						brackets:1
					},
					side1:{
						brackets:hasNull ? 0 : 1,
						content:'value',
						value:this.input
					}
				});
				
				if(hasNull) {
					filters.push({
						connector:'OR',
						operator:'IS NULL',
						side0:{
							attributeId:atrId,
							attributeIndex:atrIndex,
							brackets:0
						},
						side1:{
							brackets:1
						}
					});
				}
			}
			this.$emit('set-filters',filters);
		}
	}
};