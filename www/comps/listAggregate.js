import {isAttributeDecimal}               from './shared/attribute.js';
import {getFirstColumnUsableAsAggregator} from './shared/column.js';
import {getNumberFormatted}               from './shared/generic.js';
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
		<td v-for="(b,i) in columnBatches" :class="domClassByColumnBatch[i]">
			{{ valuesByColumnBatch[i] !== null ? valuesByColumnBatch[i] : '' }}
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
			domClassByColumnBatch:[],
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
		
		// simple
		anyValues: (s) => s.valuesByColumnBatch.length !== 0,
		dateFormat:(s) => s.$store.getters.settings.dateFormat,
		
		// stores
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap']
	},
	methods:{
		// external
		getFirstColumnUsableAsAggregator,
		getNumberFormatted,
		getQueryExpressions,
		getUnixFormat,
		getUtcTimeStringFromUnix,
		isAttributeDecimal,
		
		// calls
		get() {
			this.domClassByColumnBatch = [];
			this.valuesByColumnBatch   = [];
			
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
						this.domClassByColumnBatch.push({});
						this.valuesByColumnBatch.push(null);
					}
					
					for(let i = 0, j = columns.length; i < j; i++) {
						const c = columns[i];
						const a = this.attributeIdMap[c.attributeId];
						let   v = row.values[i];
						
						// count aggregations can be taken directly
						// decimal numbers need to be formatted
						// integer values are parsed as an aggregation can contain fractions
						if(c.aggregator !== 'count') {
							switch(a.contentUse) {
								case 'date':     v = this.getUnixFormat(v,this.dateFormat);          break;
								case 'datetime': v = this.getUnixFormat(v,this.dateFormat + ' H:i'); break;
								case 'time':     v = this.getUtcTimeStringFromUnix(v);               break;
								default:         v = this.isAttributeDecimal(a.content) ? this.getNumberFormatted(v,a) : parseInt(v); break;
							}
						}

						const bi = this.columnIdMapColumnBatchIndex[c.id];
						this.valuesByColumnBatch[bi] = v;

						if(c.flags.alignEnd) this.domClassByColumnBatch[bi].alignEnd = true;
						if(c.flags.alignMid) this.domClassByColumnBatch[bi].alignMid = true;
					}
				},
				this.$root.genericError
			);
		}
	}
};