import {isAttributeFiles}                 from './shared/attribute.js';
import {getFirstColumnUsableAsAggregator} from './shared/column.js';
import {
	getUnixFormat,
	getUtcTimeStringFromUnix
} from './shared/time.js';
export {MyListColumnBatch as default};

let MyListColumnBatch = {
	name:'my-list-column-batch',
	template:`<div class="columnBatch">
		<div class="columBatchCaption" @click.stop="click" :class="{ clickable:canOpen }">
			<span v-if="show"><b>{{ columnBatch.caption }}</b></span>
			<span v-else>{{ columnBatch.caption }}</span>
		</div>
		
		<my-button
			v-if="isValidFilter && filterActive"
			@trigger="click"
			@trigger-right="input = ''; set()"
			:blockBubble="true"
			:caption="filterActive && isArrayInput ? String(input.length) : ''"
			:captionTitle="capApp.button.columnFilters"
			:image="filterActive ? 'filter.png' : ''"
			:naked="true"
			:tight="true"
		/>
		
		<my-button
			v-if="isOrdered"
			@trigger="$emit('set-order',!isOrderedAsc)"
			@trigger-right="$emit('set-order',null)"
			:blockBubble="true"
			:caption="orders.length === 1 ? '' : String(columnSortPos+1)"
			:captionTitle="capApp.button.columnOrderFlip"
			:image="isOrderedAsc ? 'triangleUp.png' : 'triangleDown.png'"
			:naked="true"
			:tight="true"
		/>
		
		<!-- column options dropdown -->
		<div class="input-dropdown-wrap columnOptionWrap"
			v-if="show"
			v-click-outside="escaped"
			:class="{ lastInRow:lastInRow }"
		>
			<div class="input-dropdown default-inputs columnOption">
				
				<!-- sorting -->
				<div class="columnOptionItem" v-if="columnBatch.columnIndexSortBy !== -1">
					<my-button image="sort.png"
						@trigger="$emit('del-order')"
						:active="isOrdered"
						:captionTitle="capApp.orderBy"
						:naked="true"
						:tight="true"
					/>
					<my-button caption="\u25B2"
						@trigger="$emit('set-order',true)"
						:image="isOrderedAsc ? 'radio1.png' : 'radio0.png'"
						:naked="true"
						:tight="true"
					/>
					<my-button caption="\u25BC"
						@trigger="$emit('set-order',false)"
						:image="isOrderedDesc ? 'radio1.png' : 'radio0.png'"
						:naked="true"
						:tight="true"
					/>
				</div>
				
				<!-- aggregation -->
				<div class="columnOptionItem" v-if="canAggregate">
					<my-button image="sum.png"
						@trigger="aggregatorProcessed = ''"
						:active="aggregatorProcessed !== ''"
						:captionTitle="capApp.button.aggregatorsHint"
						:naked="true"
						:tight="true"
					/>
					<select v-model="aggregatorProcessed">
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
						:active="filterActive"
						:captionTitle="capGen.button.filter"
						:naked="true"
						:tight="true"
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
						:image="input.length === values.length ? 'checkbox1.png' : 'checkbox0.png'"
						:naked="true"
						:tight="true"
					/>
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
				</template>
				
				<!-- filter actions -->
				<div class="row space-between">
					<my-button image="remove.png"
						v-if="showFilterAny"
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
		aggregator:   { required:true },
		columnBatch:  { type:Object,  required:true }, // column batch to show options for
		columns:      { type:Array,   required:true }, // list columns
		columnSortPos:{ type:Number,  required:true }, // list sort for this column (number indicates sort position)
		filters:      { type:Array,   required:true }, // list filters
		filtersColumn:{ type:Array,   required:true }, // list filters from column filters
		lastInRow:    { type:Boolean, required:true },
		joins:        { type:Array,   required:true }, // list joins
		orders:       { type:Array,   required:true }, // list orders
		relationId:   { type:String,  required:true }, // list query base relation ID
		rowCount:     { type:Number,  required:true }, // list total row count
		show:         { type:Boolean, required:true }
	},
	emits:[
		'close','del-aggregator','del-order','set-aggregator',
		'set-filters','set-order','toggle'
	],
	data:function() {
		return {
			filterActive:false, // filter active from this column
			input:'',           // value input (either string if text, or array if selected from values)
			values:[],          // values available to filter with (all values a list could have for column)
			valuesLoaded:false  // values loaded once
		};
	},
	mounted:function() {
		if(this.isValidFilter)
			this.$watch('show',v => this.loadValues());
	},
	computed:{
		aggregatorProcessed:{
			get()  { return typeof this.aggregator !== 'undefined' ? this.aggregator : ''; },
			set(v) { this.$emit(v === '' ? 'del-aggregator' : 'set-aggregator', v); }
		},
		columnUsedFilter:(s) => {
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
		canAggregate:   (s) => s.getFirstColumnUsableAsAggregator(s.columnBatch,s.columns) !== null,
		canOpen:        (s) => s.rowCount > 1 || s.filterActive,
		showFilterAny:  (s) => s.showFilterItems || s.showFilterText,
		showFilterItems:(s) => s.values.length >= 3 || s.rowCount > 5,
		showFilterText: (s) => s.values.length >= 5 && !s.isDateOrTime,
		isArrayInput:   (s) => typeof s.input === 'object',
		isDateOrTime:   (s) => s.isValidFilter && ['datetime','date','time'].includes(s.columnUsedFilter.display),
		isOrdered:      (s) => s.columnSortPos !== -1,
		isOrderedAsc:   (s) => s.isOrdered && s.orders[s.columnSortPos].ascending,
		isOrderedDesc:  (s) => s.isOrdered && !s.orders[s.columnSortPos].ascending,
		isValidFilter:  (s) => s.columnUsedFilter !== null,
		
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
		getUtcTimeStringFromUnix,
		isAttributeFiles,
		
		// presentation
		displayValue(v) {
			if(v === null)
				return '[' + this.capGen.button.empty + ']';
			
			switch(this.columnUsedFilter.display) {
				case 'datetime': return this.getUnixFormat(v,this.dateFormat + ' H:i:S'); break;
				case 'date':     return this.getUnixFormat(v,this.dateFormat);            break;
				case 'time':     return this.getUtcTimeStringFromUnix(v);                 break;
				default: return String(v); break;
			}
		},
		
		// actions
		click() {
			if(this.canOpen)
				this.$emit('toggle');
		},
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
					attributeId:this.columnUsedFilter.attributeId,
					index:this.columnUsedFilter.index,
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
			
			let atrId    = this.columnUsedFilter.attributeId;
			let atrIndex = this.columnUsedFilter.index;
			let filters  = JSON.parse(JSON.stringify(this.filtersColumn));
			
			// remove existing filter
			for(let i = 0, j = filters.length; i < j; i++) {
				let f = filters[i];
				if(f.side0.attributeId === atrId && f.side0.attributeIndex === atrIndex) {
					filters.splice(i,1);
					i--; j--;
				}
			}
			
			this.filterActive = (
				!this.isArrayInput && this.input !== '' ||
				this.isArrayInput  && this.input.length !== 0
			);
			
			if(this.filterActive) {
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