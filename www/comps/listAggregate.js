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
			<div class="batch">{{ valuesByColumnBatch[i] !== null ? valuesByColumnBatch[i] : '' }}</div>
		</td>
	</tr>`,
	props:{
		columnBatches:  { type:Array,   required:true }, // list column batches
		columnIdMapAggr:{ type:Object,  required:true }, // map of aggregators by column ID
		columns:        { type:Array,   required:true }, // list columns
		filters:        { type:Array,   required:true }, // list filters
		leaveOneEmpty:  { type:Boolean, required:true },
		joins:          { type:Array,   required:true }, // list joins
		relationId:     { type:String,  required:true }  // list base relation
	},
	data() {
		return {
			valuesByColumnBatch:[]
		};
	},
	computed:{
		// map aggregator column ID to corresponding column batch index
		columnIdMapColumnBatchIndex:(s) => {
			let out = {};
			for(let i = 0, j = s.columnBatches.length; i < j; i++) {
				const c = s.getFirstColumnUsableAsAggregator(s.columnBatches[i],s.columns);
				
				if(c !== null)
					out[c.id] = i;
			}
			return out;
		},
		
		anyValues: (s) => s.valuesByColumnBatch.length !== 0,
		dateFormat:(s) => s.$store.getters.settings.dateFormat,
		
		// stores
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap']
	},
	methods:{
		// external
		getFirstColumnUsableAsAggregator,
		getQueryExpressions,
		getUnixFormat,
		getUtcTimeStringFromUnix,
		
		// calls
		get() {
			this.valuesByColumnBatch = [];
			
			let columns = [];
			for(let columnId in this.columnIdMapAggr) {
				for(let column of this.columns) {
					if(column.id !== columnId)
						continue;
					
					const c = JSON.parse(JSON.stringify(column));
					c.aggregator = this.columnIdMapAggr[columnId];
					columns.push(c);
					break;
				}
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
					if(res.payload.rows.length !== 1 || res.payload.rows[0].values.length !== columns.length)
						return;
					
					const row = res.payload.rows[0];
					
					for(let b of this.columnBatches) {
						this.valuesByColumnBatch.push(null);
					}
					
					for(let i = 0, j = columns.length; i < j; i++) {
						const c  = columns[i];
						let   v  = row.values[i];
						
						// count aggregations can be taken directly
						if(c.aggregator !== 'count') {
							switch(this.attributeIdMap[c.attributeId].contentUse) {
								case 'date':     v = this.getUnixFormat(v,this.dateFormat);          break;
								case 'datetime': v = this.getUnixFormat(v,this.dateFormat + ' H:i'); break;
								case 'time':     v = this.getUtcTimeStringFromUnix(v);               break;
							}
						}
						
						const bi = this.columnIdMapColumnBatchIndex[c.id];
						this.valuesByColumnBatch[bi] = v;
					}
				},
				this.$root.genericError
			);
		}
	}
};