import {
	getColumnBatches
} from './shared/column.js';
import {getCaption} from './shared/language.js';
export {MyListOptions as default};

let MyListOptions = {
	name:'my-list-options',
	template:`<table class="generic-table generic-table-vertical fullWidth">
		<tr>
			<td>{{ capGen.name }}*</td>
			<td>
				<div class="list-options-column-config">
					<div class="list-options-batch" v-for="b in columnBatchesAll">
						<span v-if="b.columnIndexes.length > 1">{{ b.caption }}:</span>

						<div class="list-options-batch-columns">
							<div class="list-options-batch-column clickable"
								v-for="ci in b.columnIndexes"
								@click="click(columnsAll[ci].id)"
								:class="{ notShown:!columnIdsShown.includes(columnsAll[ci].id) }"
							>
								{{ getTitle(columnsAll[ci]) }}
							</div>
						</div>
					</div>
				</div>
			</td>
		</tr>
	</table>`,
	props:{
		columns:      { type:Array,  required:true },
		columnsAll:   { type:Array,  required:true },
		columnBatches:{ type:Array,  required:true },
        moduleId:     { type:String, required:true }
	},
	emits:['set-column-ids-by-user'],
	data() {
		return {
		};
	},
	mounted() {
	},
	computed:{
		columnIdsShown:(s) => {
			let out = [];
			for(const ca of s.columnsAll) {
				for(const c of s.columns) {
					if(c.id === ca.id) {
						out.push(c.id);
						break;
					}
				}
			}
			return out;
		},

		// simple
		columnBatchesAll:(s) => s.getColumnBatches(s.moduleId,s.columnsAll,[],[],true),

		// stores
		//capApp:        (s) => s.$store.getters.captions.list,
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		capGen:        (s) => s.$store.getters.captions.generic
	},
	methods:{
		// external
		getColumnBatches,
		getCaption,

		// presentation
		getTitle(column) {
			const atr = this.attributeIdMap[column.attributeId];
			return this.getCaption('attributeTitle',this.moduleId,atr.id,atr.captions,atr.name);
		},

		// actions
		click(columnId) {
			let out = JSON.parse(JSON.stringify(this.columnIdsShown));

			const pos = out.indexOf(columnId);
			if(pos === -1) out.push(columnId);
			else           out.splice(pos,1);

			this.$emit('set-column-ids-by-user',out);
		}
	}
};