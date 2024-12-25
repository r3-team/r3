import {isAttributeFiles}                 from './shared/attribute.js';
import {getFirstColumnUsableAsAggregator} from './shared/column.js';
import {
	getUnixFormat,
	getUnixShifted,
	getUtcTimeStringFromUnix
} from './shared/time.js';
export {MyListColumnBatch as default};

let MyListColumnBatch = {
	name:'my-list-column-batch',
	template:`<div class="columnBatchHeader">
		<my-button image="filter.png"
			v-if="showIconFilter"
			@trigger="click"
			@trigger-right="input = ''; set()"
			:blockBubble="true"
			:captionTitle="capApp.button.columnFilters"
			:naked="true"
		/>
		
		<my-button
			v-if="showIconOrder"
			@trigger="$emit('set-order',!isOrderedAsc)"
			@trigger-right="$emit('set-order',null)"
			:blockBubble="true"
			:caption="columnBatch.orderPosition === 0 ? '' : String(columnBatch.orderPosition)"
			:captionTitle="capApp.button.columnOrderFlip"
			:image="isOrderedAsc ? 'triangleUp.png' : 'triangleDown.png'"
			:naked="true"
		/>
		
		<div class="columBatchHeaderCaption"
			@click.stop="click"
			:class="{ clickable:canOpen, dropdownActive:show, hasIcons:showIconFilter || showIconOrder }"
			:title="columnBatch.caption"
		>{{ columnBatch.caption }}</div>

		<my-button image="toggleDown.png"
			v-if="showToggle"
			@trigger="$emit('toggle-header')"
			:captionTitle="capApp.button.collapseHeader"
			:naked="true"
		/>
		
		<!-- column options dropdown -->
		<div class="input-dropdown-wrap columnOptionWrap"
			v-if="show"
			v-click-outside="escaped"
			:class="{ dropdownRight:dropdownRight }"
		>
			<div class="input-dropdown default-inputs columnOption">
				
				<!-- sorting -->
				<div class="columnOptionItem" v-if="canOrder">
					<my-button image="sort.png"
						@trigger="$emit('del-order')"
						:active="isOrdered"
						:captionTitle="capApp.orderBy"
						:naked="true"
					/>
					<my-button caption="\u25B2"
						@trigger="$emit('set-order',true)"
						:image="isOrderedAsc ? 'radio1.png' : 'radio0.png'"
						:naked="true"
					/>
					<my-button caption="\u25BC"
						@trigger="$emit('set-order',false)"
						:image="isOrdered && !isOrderedAsc ? 'radio1.png' : 'radio0.png'"
						:naked="true"
					/>
				</div>
				
				<!-- aggregation -->
				<div class="columnOptionItem" v-if="aggrColumn !== null">
					<my-button image="sum.png"
						@trigger="aggregatorInput = ''"
						:active="aggregatorInput !== ''"
						:captionTitle="capApp.button.aggregatorsHint"
						:naked="true"
					/>
					<select v-model="aggregatorInput">
						<option value="">-</option>
						<option value="avg">{{ capGen.option.aggAvg }}</option>
						<option value="count">{{ capGen.option.aggCount }}</option>
						<option value="max">{{ capGen.option.aggMax }}</option>
						<option value="min">{{ capGen.option.aggMin }}</option>
						<option value="sum">{{ capGen.option.aggSum }}</option>
					</select>
				</div>
				
				<!-- filter by text -->
				<div class="columnOptionItem" v-if="showFilterText">
					<my-button image="filter.png"
						@trigger="input = ''; set()"
						:active="isFiltered"
						:captionTitle="capGen.button.filter"
						:naked="true"
					/>
					<input
						v-model="input"
						:disabled="isArrayInput"
						:placeholder="capApp.columnFilter.contains"
						@keyup.enter="set"
					/>
					<my-button image="ok.png"
						@trigger="set"
						:active="!isArrayInput && input !== ''"
						:naked="true"
					/>
				</div>
				
				<!-- filter by items -->
				<template v-if="showFilterItems">
					<my-button
						@trigger="valueToggleAll"
						:caption="'['+capGen.button.selectAll+']'"
						:image="(isInputEmpty || input.length === values.length) && !zeroSelection ? 'checkbox1.png' : 'checkbox0.png'"
						:naked="true"
					/>
					<div class="columnFilterValues">
						<my-button
							v-for="v of values"
							@trigger="valueToggle(v)"
							:adjusts="true"
							:caption="displayValue(v)"
							:image="(isInputEmpty || input.includes(v)) && !zeroSelection ? 'checkbox1.png' : 'checkbox0.png'"
							:naked="true"
						/>
					</div>
				</template>
				
				<!-- filter actions -->
				<div class="row space-between">
					<my-button image="remove.png"
						v-if="showFilterAny"
						@trigger="clear"
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
		columnBatch:     { type:Object,  required:true }, // column batch to show options for
		columnIdMapAggr: { type:Object,  required:true },
		columns:         { type:Array,   required:true }, // list columns
		dropdownRight:   { type:Boolean, required:true },
		filters:         { type:Array,   required:true }, // list filters all combined (columns, list, quick, user, choices, ...)
		filtersColumn:   { type:Array,   required:true }, // list filters from users column batch selections
		joins:           { type:Array,   required:true }, // list joins
		orders:          { type:Array,   required:true }, // list orders
		orderOverwritten:{ type:Boolean, required:true }, // list orders were overwritten by user
		relationId:      { type:String,  required:true }, // list query base relation ID
		rowCount:        { type:Number,  required:true }, // list total row count
		show:            { type:Boolean, required:true },
		showToggle:      { type:Boolean, required:true }
	},
	emits:[
		'close','del-aggregator','del-order','set-aggregator',
		'set-filters','set-order','toggle','toggle-header'
	],
	data() {
		return {
			input:'',           // value input (either string if text, or array if selected from values)
			values:[],          // values available to filter with (all values a list could have for column)
			zeroSelection:false
		};
	},
	mounted() {
		if(this.isValidFilter)
			this.$watch('show',v => this.loadValues());
		
		// apply input values from column filter (must be first index)
		if(this.columnFilterIndexes.length !== 0) {
			const f = this.filtersColumn[this.columnFilterIndexes[0]];
			if(f.side1.content === 'value')
				this.input = f.side1.value;
		}
	},
	computed:{
		aggregatorInput:{
			get()  {
				return this.aggrColumn !== null &&
					typeof this.columnIdMapAggr[this.aggrColumn.id] !== 'undefined'
					? this.columnIdMapAggr[this.aggrColumn.id] : '';
			},
			set(v) {
				if(v === '') this.$emit('del-aggregator',this.aggrColumn.id,null);
				else         this.$emit('set-aggregator',this.aggrColumn.id,v);
			}
		},
		
		// returns column of the column batch that is used for filtering (null if none is available)
		columnUsedFilter:(s) => {
			for(let ind of s.columnBatch.columnIndexes) {
				let c = s.columns[ind];
				let a = s.attributeIdMap[c.attributeId];
				
				// ignore color/drawing display, sub query, aggregator, encrypted and file attribute columns
				if(a.contentUse !== 'color' && a.contentUse !== 'drawing' && c.query === null && c.aggregator === null &&
					!a.encrypted && !s.isAttributeFiles(a.content)) {
					
					return c;
				}
			}
			return null;
		},
		
		// indexes of column user filters that this column is responsible for
		columnFilterIndexes:(s) => {
			if(!s.isValidFilter)
				return [];
			
			let atrId    = s.columnUsedFilter.attributeId;
			let atrIndex = s.columnUsedFilter.index;
			let out      = [];
			
			for(let i = 0, j = s.filtersColumn.length; i < j; i++) {
				const f = s.filtersColumn[i];
				if(f.side0.attributeId === atrId && f.side0.attributeIndex === atrIndex)
					out.push(i);
			}
			return out;
		},
		
		// simple
		aggrColumn:       (s) => s.getFirstColumnUsableAsAggregator(s.columnBatch,s.columns),
		canOpen:          (s) => s.rowCount > 1 || s.isFiltered,
		canOrder:         (s) => s.columnBatch.columnIndexesSortBy.length !== 0,
		filtersColumnThis:(s) => s.filtersColumn.filter((v,i) => s.columnFilterIndexes.includes(i)),
		isArrayInput:     (s) => typeof s.input === 'object',
		isDateOrTime:     (s) => s.isValidFilter && ['datetime','date','time'].includes(s.attributeIdMap[s.columnUsedFilter.attributeId].contentUse),
		isFiltered:       (s) => s.columnFilterIndexes.length !== 0,
		isInputEmpty:     (s) => (s.isArrayInput && s.input.length === 0) || !s.isArrayInput && s.input === '',
		isOrdered:        (s) => s.columnBatch.orderIndexesUsed.length !== 0,
		isOrderedAsc:     (s) => s.isOrdered && s.orders[s.columnBatch.orderIndexesUsed[0]].ascending,
		isValidFilter:    (s) => s.columnUsedFilter !== null,
		showFilterAny:    (s) => s.showFilterItems || s.showFilterText,
		showFilterItems:  (s) => s.values.length != 0,
		showFilterText:   (s) => s.values.length >= 5 && !s.isDateOrTime,
		showIconFilter:   (s) => s.isValidFilter && s.isFiltered,
		showIconOrder:    (s) => s.isOrdered && s.orderOverwritten,
		
		// stores
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		capApp:        (s) => s.$store.getters.captions.list,
		capGen:        (s) => s.$store.getters.captions.generic,
		dateFormat:    (s) => s.$store.getters.settings.dateFormat
	},
	methods:{
		// externals
		getFirstColumnUsableAsAggregator,
		getUnixFormat,
		getUnixShifted,
		getUtcTimeStringFromUnix,
		isAttributeFiles,
		
		// presentation
		displayValue(v) {
			if(v === null)
				return '[' + this.capGen.button.empty + ']';
			
			const atr = this.attributeIdMap[this.columnUsedFilter.attributeId];
			
			if(atr.content === 'boolean')
				return v ? this.capGen.option.yes : this.capGen.option.no;
			
			switch(atr.contentUse) {
				case 'date':     return this.getUnixFormat(this.getUnixShifted(v,true),this.dateFormat); break;
				case 'datetime': return this.getUnixFormat(v,this.dateFormat + ' H:i');                  break;
				case 'time':     return this.getUtcTimeStringFromUnix(v);                                break;
				default: return String(v); break;
			}
		},
		
		// actions
		clear() {
			this.input = '';
			this.set();
			this.loadValues();
		},
		click() {
			if(this.canOpen)
				this.$emit('toggle');
		},
		escaped() {
			this.$emit('close');
		},
		valueToggle(v) {
			if(this.isInputEmpty && !this.zeroSelection)
				this.input = JSON.parse(JSON.stringify(this.values));

			if(typeof this.input !== 'object')
				this.input = [];
			
			const p = this.input.indexOf(v);
			if(p !== -1) this.input.splice(p,1);
			else         this.input.push(v);
			
			if(this.input.length === 0 || this.input.length === this.values.length)
				this.input = '';

			this.zeroSelection = false;
			this.set();
		},
		valueToggleAll() {
			if(!this.isInputEmpty || this.zeroSelection) {
				this.zeroSelection = false;
				this.input = '';
			}
			else {
				this.zeroSelection = true;
			}
			this.set();
		},
		
		// retrieval
		loadValues() {
			if(!this.show || !this.isValidFilter)
				return;
			
			this.values = [];
			ws.send('data','get',{
				relationId:this.relationId,
				joins:this.joins,
				expressions:[{
					attributeId:this.columnUsedFilter.attributeId,
					index:this.columnUsedFilter.index,
					aggregator:'first',
					distincted:true
				}],
				filters:this.filters.filter(v => {
					// remove filters coming from this column batch
					for(const f of this.filtersColumnThis) {
						if(JSON.stringify(f) === JSON.stringify(v))
							return false;
					}
					return true;
				}),
				orders:[{ascending:true,expressionPos:0}],
				limit:1000
			},false).then(
				res => {
					for(const row of res.payload.rows) {
						this.values.push(row.values[0]);
					}
				},
				this.$root.genericError
			);
		},
		
		// updates
		set() {
			if(!this.isValidFilter)
				return;
			
			const atrId    = this.columnUsedFilter.attributeId;
			const atrIndex = this.columnUsedFilter.index;
			let filters    = JSON.parse(JSON.stringify(this.filtersColumn));
			let filterUsed = (
				!this.isArrayInput && this.input !== '' ||
				this.isArrayInput  && this.input.length !== 0
			);
			
			// remove existing filters for this column
			filters = filters.filter((v,i) => !this.columnFilterIndexes.includes(i));

			if(filterUsed) {
				// add new filters for this column, if active
				const hasNull = this.isArrayInput && this.input.includes(null);
				filters.push({
					connector:'AND',
					index:0,
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
						index:0,
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