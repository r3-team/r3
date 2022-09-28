import {getFirstColumnUsableAsAggregator} from './shared/column.js';
import {getQueryExpressions}              from './shared/query.js';
import {
	getUnixFormat,
	getUtcTimeStringFromUnix
} from './shared/time.js';
export {MyListAggregate as default};

let MyListAggregate = {
	name:'my-list-aggregate',
	template:`<tr class="aggregation" v-if="anyValues">
		<td v-if="leaveOneEmpty"></td>
		<td v-for="(b,i) in columnBatches">
			{{ typeof columnBatchIndexMapValue[i] !== 'undefined' ? columnBatchIndexMapValue[i] : '' }}
		</td>
	</tr>`,
	props:{
		columnBatches:          { type:Array,   required:true }, // list column batches
		columnBatchIndexMapAggr:{ type:Object,  required:true }, // list aggregators
		columns:                { type:Array,   required:true }, // list columns
		filters:                { type:Array,   required:true }, // list filters
		leaveOneEmpty:          { type:Boolean, required:true },
		joins:                  { type:Array,   required:true }, // list joins
		relationId:             { type:String,  required:true }  // list base relation
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
			let columns = [];
			for(let i = 0, j = this.columnBatches.length; i < j; i++) {
				if(typeof this.columnBatchIndexMapAggr[i] === 'undefined')
					continue;
				
				let b = this.columnBatches[i];
				let c = JSON.parse(JSON.stringify(
					this.getFirstColumnUsableAsAggregator(b,this.columns)
				));
				
				if(c === null)
					continue;
				
				c.aggregator = this.columnBatchIndexMapAggr[i];
				columns.push(c);
			}
			
			if(columns.length === 0)
				return;
			
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
					let valueIndex = -1;
					for(let i = 0, j = this.columnBatches.length; i < j; i++) {
						
						if(typeof this.columnBatchIndexMapAggr[i] === 'undefined')
							continue;
						
						valueIndex++;
						let a = this.columnBatchIndexMapAggr[i];
						let v = values[valueIndex];
						
						// count aggregations can be taken directly
						if(a === 'count') {
							this.columnBatchIndexMapValue[i] = v;
							continue;
						}
						
						switch(columns[valueIndex].display) {
							case 'date':     v = this.getUnixFormat(v,this.dateFormat); break;
							case 'datetime': v = this.getUnixFormat(v,this.dateFormat + ' H:i'); break;
							case 'time':     v = this.getUtcTimeStringFromUnix(v); break;
						}
						this.columnBatchIndexMapValue[i] = v;
					}
				},
				this.$root.genericError
			);
		}
	}
};