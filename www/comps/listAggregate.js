import {getFirstColumnUsableAsAggregator} from './shared/column.js';
import {getQueryExpressions}              from './shared/query.js';
import {
	getUnixFormat,
	getUtcTimeStringFromUnix
} from './shared/time.js';
export {MyListAggregateInput,MyListAggregateOutput};

let MyListAggregateInput = {
	name:'my-list-aggregate-input',
	template:`<div class="list-header list-aggregator">
		<div class="list-header-title">
			<img src="images/sum.png" />
			<span>{{ capApp.aggregators }}</span>
		</div>
		
		<div class="list-aggregator-item default-inputs" v-for="(a,ai) in aggregators">
			<select v-model="a.columnBatchIndex">
				<template v-for="(b,i) in columnBatches">
					<option
						v-if="a.columnBatchIndex === i || (!columnBatchIndexesUsed.includes(i) && !columnBatchIndexesUnusable.includes(i))"
						:value="i"
					>
						{{ b.caption }}
					</option>
				</template>
			</select>
			<select v-model="a.aggregator">
				<option value="avg">{{ capGen.option.aggAvg }}</option>
				<option value="count">{{ capGen.option.aggCount }}</option>
				<option value="max">{{ capGen.option.aggMax }}</option>
				<option value="min">{{ capGen.option.aggMin }}</option>
				<option value="sum">{{ capGen.option.aggSum }}</option>
			</select>
			
			<my-button image="cancel.png"
				@trigger="del(ai)"
				:naked="true"
				:tight="true"
			/>
		</div>
		
		<div class="list-aggregator-actions">
			<div class="row">
				<my-button image="ok.png"
					@trigger="$emit('set',aggregators)"
					:active="aggregators.length !== 0"
					:caption="capGen.button.apply"
				/>
				<my-button image="add.png"
					@trigger="add"
					:active="columnBatchIndexesUsed.length !== columnBatches.length - columnBatchIndexesUnusable.length"
					:caption="capGen.button.add"
				/>
			</div>
			<div class="row">
				<my-button image="delete.png"
					@trigger="aggregators = [];$emit('set',aggregators)"
					:active="columnBatchIndexesUsed.length !== 0"
					:cancel="true"
					:captionTitle="capGen.button.reset"
				/>
				<my-button image="cancel.png"
					@trigger="$emit('close')"
					:cancel="true"
					:caption="capGen.button.close"
				/>
			</div>
		</div>
	</div>`,
	props:{
		columnBatches:{ type:Array, required:true }, // list column batches
		columns:      { type:Array, required:true }, // list columns
		value:        { type:Array, required:true }  // aggregators, [{columnBatchIndex:3,aggregator:'sum'},{...}]
	},
	data:function() {
		return {
			aggregators:[]
		};
	},
	emits:['close','set'],
	mounted:function() {
		this.aggregators = JSON.parse(JSON.stringify(this.value));
	},
	computed:{
		columnBatchIndexesUsed:(s) => {
			let out = [];
			for(let v of s.aggregators) {
				out.push(v.columnBatchIndex);
			}
			return out;
		},
		columnBatchIndexesUnusable:(s) => {
			let out = [];
			for(let i = 0, j = s.columnBatches.length; i < j; i++) {
				if(s.getFirstColumnUsableAsAggregator(s.columnBatches[i],s.columns) === null)
					out.push(i);
			}
			return out;
		},
		
		// stores
		capApp:(s) => s.$store.getters.captions.list,
		capGen:(s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getFirstColumnUsableAsAggregator,
		
		// actions
		add() {
			let columnBatchIndexUnused = -1;
			for(let i = 0, j = this.columnBatches.length; i < j; i++) {
				if(!this.columnBatchIndexesUnusable.includes(i)
					&& !this.columnBatchIndexesUsed.includes(i)
				) {
					columnBatchIndexUnused = i;
					break;
				}
			}
			
			this.aggregators.push({
				columnBatchIndex:columnBatchIndexUnused,
				aggregator:'sum'
			});
		},
		del(aggregatorIndex) {
			this.aggregators.splice(aggregatorIndex,1);
			this.$emit('set',this.aggregators);
		}
	}
};

let MyListAggregateOutput = {
	name:'my-list-aggregate-output',
	template:`<tr class="aggregation" v-if="anyValues">
		<td v-if="leaveOneEmpty"></td>
		<td v-for="(b,i) in columnBatches">
			{{ typeof columnBatchIndexMapValue[i] !== 'undefined' ? columnBatchIndexMapValue[i] : '' }}
		</td>
	</tr>`,
	props:{
		aggregators:  { type:Array,   required:true }, // list aggregators
		columnBatches:{ type:Array,   required:true }, // list column batches
		columns:      { type:Array,   required:true }, // list columns
		filters:      { type:Array,   required:true }, // list filters
		leaveOneEmpty:{ type:Boolean, required:true },
		joins:        { type:Array,   required:true }, // list joins
		relationId:   { type:String,  required:true }  // list base relation
	},
	data:function() {
		return {
			columnBatchIndexMapValue:{}
		};
	},
	computed:{
		anyValues: (s) => Object.keys(s.columnBatchIndexMapValue).length !== 0,
		dateFormat:(s) => s.$store.getters.settings.dateFormat
	},
	methods:{
		// external
		getFirstColumnUsableAsAggregator,
		getQueryExpressions,
		getUnixFormat,
		getUtcTimeStringFromUnix,
		
		// calls
		get() {
			this.columnBatchIndexMapValue = {};
			if(this.aggregators.length === 0)
				return;
			
			let columns = [];
			for(let a of this.aggregators) {
				let b = this.columnBatches[a.columnBatchIndex];
				let c = JSON.parse(JSON.stringify(
					this.getFirstColumnUsableAsAggregator(b,this.columns)
				));
				
				if(c === null)
					continue;
				
				c.aggregator = a.aggregator;
				columns.push(c);
			}
			
			ws.send('data','get',{
				relationId:this.relationId,
				joins:this.joins,
				expressions:this.getQueryExpressions(columns),
				filters:this.filters
			},false).then(
				res => {
					let values = [];
					for(let r of res.payload.rows) {
						for(let v of r.values) {
							values.push(v);
						}
					}
					
					// set aggregated values
					for(let i = 0, j = this.columnBatches.length; i < j; i++) {
						let b = this.columnBatches[i];
						
						for(let x = 0, y = this.aggregators.length; x < y; x++) {
							let a = this.aggregators[x];
							let v = values[x];
							
							if(a.columnBatchIndex !== i)
								continue;
							
							// count aggregations can be taken directly
							if(a.aggregator === 'count') {
								this.columnBatchIndexMapValue[i] = v;
								break;
							}
							
							switch(columns[x].display) {
								case 'date':     v = this.getUnixFormat(v,this.dateFormat); break;
								case 'datetime': v = this.getUnixFormat(v,this.dateFormat + ' H:i'); break;
								case 'time':     v = this.getUtcTimeStringFromUnix(v); break;
							}
							this.columnBatchIndexMapValue[i] = v;
							break;
						}
					}
				},
				this.$root.genericError
			);
		}
	}
};