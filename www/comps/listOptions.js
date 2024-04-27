import {
	getColumnBatches
} from './shared/column.js';
import {getCaption} from './shared/language.js';
export {MyListOptions as default};

let MyListOptions = {
	name:'my-list-options',
	template:`<table class="generic-table generic-table-vertical fullWidth">
		<!-- general -->
		<tr>
			<td>{{ capApp.displayMode }}</td>
			<td>
				<div class="row nowrap gap">
					<select v-model="layoutInput">
						<option value="table">{{ capApp.option.layoutTable }}</option>
						<option value="cards">{{ capApp.option.layoutCards }}</option>
					</select>
					<my-button
						@trigger="layout === 'table' ? layoutInput = 'cards' : layoutInput = 'table'"
						:image="layoutInput === 'table' ? 'files_list1.png' : 'files_list3.png'"
						:naked="true"
					/>
				</div>
			</td>
		</tr>
		<tr v-if="layoutInput === 'cards'">
			<td>{{ capApp.cardsCaptions }}</td>
			<td><my-bool v-model="cardsCaptionsInput" /></td>
		</tr>

		<!-- column options -->
		<tr v-if="columnsAll.length > 1">
			<td>
				<div class="column gap">
					<span>{{ capGen.columns }}</span>
					<my-button image="refresh.png"
						@trigger="columnsReset"
						:caption="capGen.button.reset"
					/>
				</div>
			</td>
			<td>
				<div class="list-options-column-config">
					<div class="list-options-batch input-custom dynamic"
						v-for="(b,bi) in columnBatchesAll"
						:class="{ notShown:!getBatchIsVisible(b) }"
					>
						<div class="row nowrap">
							<my-button image="arrowUp.png"
								@trigger="clickBatchSort(b,true)"
								:active="bi !== 0"
								:naked="true"
							/>
							<my-button image="arrowDown.png"
								@trigger="clickBatchSort(b,false)"
								:active="bi !== columnBatchesAll.length - 1"
								:naked="true"
							/>
						</div>
						<span v-if="b.columnIndexes.length > 1">{{ b.caption }}</span>

						<div class="list-options-batch-columns">
							<div class="list-options-batch-column clickable"
								v-for="ci in b.columnIndexes"
								@click="clickColumnInBatch(columnsAll[ci].id)"
								:class="{ notShown:!columnIdsShown.includes(columnsAll[ci].id) }"
							>
								{{ b.columnIndexes.length > 1 ? getTitle(columnsAll[ci]) : b.caption }}
							</div>
						</div>
					</div>
				</div>
			</td>
		</tr>
	</table>`,
	props:{
        cardsCaptions:  { type:Boolean, required:true },
		columns:        { type:Array,   required:true }, // columns as they are visible to the field
		columnsAll:     { type:Array,   required:true }, // all columns, regardless of visibility
		columnBatches:  { type:Array,   required:true }, // column batches as they are visible to the field
		columnBatchSort:{ type:Array,   required:true },
        layout:         { type:String,  required:true },
        moduleId:       { type:String,  required:true }
	},
	emits:['reset', 'set-cards-captions', 'set-column-batch-sort', 'set-column-ids-by-user', 'set-layout'],
	computed:{
		columnIdsShown:(s) => {
			let out = [];
			for(const c of s.columns) {
				out.push(c.id);
			}
			return out;
		},

		// inputs
		cardsCaptionsInput:{
			get()  { return this.cardsCaptions; },
			set(v) { this.$emit('set-cards-captions',v); }
		},
		layoutInput:{
			get()  { return this.layout; },
			set(v) { this.$emit('set-layout',v); }
		},

		// simple
		columnBatchesAll:(s) => s.getColumnBatches(s.moduleId,s.columnsAll,[],[],s.columnBatchSort,true),

		// stores
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		capApp:        (s) => s.$store.getters.captions.list,
		capGen:        (s) => s.$store.getters.captions.generic
	},
	methods:{
		// external
		getColumnBatches,
		getCaption,

		// presentation
		getBatchIsVisible(columnBatch) {
			for(const columnIndex of columnBatch.columnIndexes) {
				if(this.columnIdsShown.includes(this.columnsAll[columnIndex].id))
					return true;
			}
			return false;
		},
		getTitle(column) {
			const atr = this.attributeIdMap[column.attributeId];
			return this.getCaption('attributeTitle',this.moduleId,atr.id,atr.captions,atr.name);
		},

		// actions
		clickBatchSort(batch,up) {
			let out = JSON.parse(JSON.stringify(this.columnBatchSort));

			// no sort order defined, initialize
			if(out.length === 0) {
				for(let i = 0, j = this.columnBatchesAll.length; i < j; i++) {
					out.push(this.columnBatchesAll[i].batchOrderIndex);
				}
			}

			const pos = out.indexOf(batch.batchOrderIndex);
			if(pos === -1) {
				out.push(batch.batchOrderIndex);
			} else {
				const posNew = up ? pos - 1 : pos + 1;
				out.splice(pos, 1);
				out.splice(posNew, 0, batch.batchOrderIndex);
			}
			this.$emit('set-column-batch-sort',out);
		},
		clickColumnInBatch(columnId) {
			let out = JSON.parse(JSON.stringify(this.columnIdsShown));

			let pos = out.indexOf(columnId);
			if(pos !== -1) out.splice(pos,1);
			else           out.push(columnId);
			
			this.$emit('set-column-ids-by-user',out);
		},
		columnsReset() {
			this.$emit('set-column-ids-by-user',[]);
			this.$emit('set-column-batch-sort',[]);

			setTimeout(() => this.$emit('reset'),1000);
		}
	}
};