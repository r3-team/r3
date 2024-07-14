import {
	getColumnBatches
} from './shared/column.js';
import {getCaption}                    from './shared/language.js';
import {setSingle as setSettingSingle} from './shared/settings.js';
export {MyListOptions as default};

let MyListOptions = {
	name:'my-list-options',
	template:`<table class="generic-table generic-table-vertical fullWidth">
		<!-- general -->
		<tr v-if="hasPaging">
			<td>{{ capApp.pageLimit }}</td>
			<td>
				<select v-model="pageLimitInput">
					<option v-for="o in pageLimitOptions" :value="o">{{ o }}</option>
				</select>
			</td>
		</tr>
		<tr>
			<td>{{ capApp.displayMode }}</td>
			<td>
				<div class="row nowrap gap">
					<select v-model="layoutInput">
						<option value="table">{{ capApp.option.layoutTable }}</option>
						<option value="cards">{{ capApp.option.layoutCards }}</option>
					</select>
					<my-button
						@trigger="isTable ? layoutInput = 'cards' : layoutInput = 'table'"
						:image="isTable ? 'files_list1.png' : 'files_list3.png'"
						:naked="true"
					/>
				</div>
			</td>
		</tr>
		<tr v-if="isCards">
			<td>{{ capApp.cardsCaptions }}</td>
			<td><my-bool v-model="cardsCaptionsInput" /></td>
		</tr>
		<tr>
			<td>{{ capAppSet.listRows }}</td>
			<td>
				<div class="row gap">
					<my-button-check
						@update:modelValue="setSettingSingle('listSpaced',!settings.listSpaced)"
						:caption="capAppSet.listSpaced"
						:modelValue="settings.listSpaced"
					/>
					<my-button-check
						v-if="isTable"
						@update:modelValue="setSettingSingle('listColored',!settings.listColored)"
						:caption="capAppSet.listColored"
						:modelValue="settings.listColored"
					/>
				</div>
			</td>
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
				<draggable handle=".dragAnchor" group="filters" itemKey="id" animation="100" class="list-options-column-config"
					v-model="columnBatchesAllDrag"
					@change="dropBatchSort"
					:fallbackOnBody="true"
				>
					<template #item="{element,index}">
						<div class="list-options-batch input-custom dynamic" v-if="getBatchIsVisible(element,columnIdsShown)">
							
							<!-- batch sort -->
							<img class="dragAnchor" src="images/drag.png" v-if="!isMobile" />

							<!-- batch sort for mobile -->
							<div class="row nowrap" v-if="isMobile">
								<my-button image="arrowUp.png"
									@trigger="clickBatchSort(element,true)"
									:active="columnBatchSortAll.indexOf(element.batchOrderIndex) !== 0"
									:naked="true"
								/>
								<my-button image="arrowDown.png"
									@trigger="clickBatchSort(element,false)"
									:active="columnBatchSortAll.indexOf(element.batchOrderIndex) !== columnBatches.length - 1"
									:naked="true"
								/>
							</div>

							<!-- batch/columns -->
							<div class="row wrap centered gap">
								<span v-if="element.columnIndexes.length > 1">{{ element.caption }}</span>

								<div class="list-options-batch-columns">
									<div class="list-options-batch-column clickable"
										v-for="ci in element.columnIndexes"
										@click="clickColumnInBatch(columnsAll[ci].id,element)"
										:class="{ notShown:!columnIdsShown.includes(columnsAll[ci].id) }"
									>
										{{ element.columnIndexes.length > 1 ? getTitle(columnsAll[ci]) : element.caption }}
									</div>
								</div>
							</div>
						</div>
					</template>
				</draggable>

				<br />
				<div class="list-options-column-config" v-if="columnBatchesAll.filter(v => !getBatchIsVisible(v,columnIdsShown)).length !== 0">
					<span>{{ capGen.notShown }}</span>
					<template v-for="(b,bi) in columnBatchesAll">
						<div class="list-options-batch input-custom dynamic" v-if="!getBatchIsVisible(b,columnIdsShown)">

							<!-- batch/columns -->
							<div class="row wrap centered gap">
								<span v-if="b.columnIndexes.length > 1">{{ b.caption }}</span>

								<div class="list-options-batch-columns">
									<div class="list-options-batch-column clickable"
										v-for="ci in b.columnIndexes"
										@click="clickColumnInBatch(columnsAll[ci].id,b)"
										:class="{ notShown:!columnIdsShown.includes(columnsAll[ci].id) }"
									>
										{{ b.columnIndexes.length > 1 ? getTitle(columnsAll[ci]) : b.caption }}
									</div>
								</div>
							</div>
						</div>
					</template>
				</div>

				<template v-if="csvImport">
					<br />
					<span>{{ capApp.message.csvImportWarning }}</span>
				</template>
			</td>
		</tr>
	</table>`,
	props:{
		cardsCaptions:  { type:Boolean, required:true }, // layout option for 'cards', show captions?
		columns:        { type:Array,   required:true }, // columns as they are visible to the field
		columnsAll:     { type:Array,   required:true }, // all columns, regardless of visibility
		columnBatches:  { type:Array,   required:true }, // column batches as they are visible to the field
		columnBatchSort:{ type:Array,   required:true }, // batch sort definitions (2 arrays), [ batchSortShown, batchSortAll ]
		csvImport:      { type:Boolean, required:true },
		layout:         { type:String,  required:true }, // layout of list field: 'table', 'cards'
		hasPaging:      { type:Boolean, required:true },
		limitDefault:   { type:Number,  required:true },
		moduleId:       { type:String,  required:true },
		pageLimit:      { type:Number,  required:true }
	},
	emits:['reset', 'set-cards-captions', 'set-column-batch-sort', 'set-column-ids-by-user', 'set-layout', 'set-page-limit'],
	computed:{
		columnBatchSortAll:(s) => {
			if(s.columnBatchSort[1].length === s.columnBatchesAll.length)
				return s.columnBatchSort[1];

			let out = [];
			for(let i = 0, j = s.columnBatchesAll.length; i < j; i++) {
				out.push(i);
			}
			return out;
		},
		columnIdsShown:(s) => {
			let out = [];
			for(const c of s.columns) {
				out.push(c.id);
			}
			return out;
		},
		pageLimitOptions:(s) => {
			let out = [10,25,50,100,250,500,1000];
			
			if(!out.includes(s.limitDefault))
				out.unshift(s.limitDefault);
			
			return out.sort((a, b) => a - b);
		},

		// inputs
		columnBatchesAllDrag:{
			get()  { return this.columnBatchesAll; },
			set(v) {}
		},
		cardsCaptionsInput:{
			get()  { return this.cardsCaptions; },
			set(v) { this.$emit('set-cards-captions',v); }
		},
		layoutInput:{
			get()  { return this.layout; },
			set(v) { this.$emit('set-layout',v); }
		},
		pageLimitInput:{
			get()  { return this.pageLimit; },
			set(v) { this.$emit('set-page-limit',parseInt(v)); }
		},

		// simple
		columnBatchesAll:        (s) => s.getColumnBatches(s.moduleId,s.columnsAll,[],[],s.columnBatchSort[1],true),
		columnBatchesAllUnsorted:(s) => s.getColumnBatches(s.moduleId,s.columnsAll,[],[],[],true),
		isCards:                 (s) => s.layoutInput === 'cards',
		isTable:                 (s) => s.layoutInput === 'table',

		// stores
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		capApp:        (s) => s.$store.getters.captions.list,
		capAppSet:     (s) => s.$store.getters.captions.settings,
		capGen:        (s) => s.$store.getters.captions.generic,
		isMobile:      (s) => s.$store.getters.isMobile,
		settings:      (s) => s.$store.getters.settings
	},
	mounted() {
		// invalid batch sort, reset
		if(this.columnBatchSort[1].length !== 0 && this.columnBatchSort[1].length !== this.columnBatchesAll.length)
			this.columnsReset();
	},
	methods:{
		// external
		getColumnBatches,
		getCaption,
		setSettingSingle,

		// presentation
		getBatchColumnCountVisible(columnBatch) {
			return columnBatch.columnIndexes.filter(v => this.columnIdsShown.includes(this.columnsAll[v].id)).length;
		},
		getBatchIsVisible(columnBatch,columnIdsShown) {
			for(const columnIndex of columnBatch.columnIndexes) {
				if(columnIdsShown.includes(this.columnsAll[columnIndex].id))
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
			let out = JSON.parse(JSON.stringify(this.columnBatchSortAll));
			const pos    = out.indexOf(batch.batchOrderIndex);
			const posNew = up ? pos - 1 : pos + 1;
			out.splice(pos, 1);
			out.splice(posNew, 0, batch.batchOrderIndex);

			this.setBatchOrder(out,this.columnIdsShown);
		},
		clickColumnInBatch(columnId,columnBatch) {
			let outCols = JSON.parse(JSON.stringify(this.columnIdsShown));
			let outSort = JSON.parse(JSON.stringify(this.columnBatchSortAll));

			const columnsInBatchCount = this.getBatchColumnCountVisible(columnBatch);

			const pos = outCols.indexOf(columnId);
			if(pos !== -1) {
				outCols.splice(pos,1);

				// column to be removed is last one in batch, move to end of batch all order
				if(columnsInBatchCount === 1) {
					const posBatch = outSort.indexOf(columnBatch.batchOrderIndex);
					outSort.splice(posBatch,1);
					outSort.push(columnBatch.batchOrderIndex);
				}
			}
			else {
				outCols.push(columnId);

				// column to be added is first one in batch, move batch to end of shown batch order
				if(columnsInBatchCount === 0) {
					const posBatch = outSort.indexOf(columnBatch.batchOrderIndex);
					outSort.splice(posBatch,1);
					outSort.splice(this.columnBatches.length,0,columnBatch.batchOrderIndex);
				}
			};
			
			this.$emit('set-column-ids-by-user',outCols);
			this.setBatchOrder(outSort,outCols);
		},
		columnsReset() {
			this.$emit('set-column-ids-by-user',[]);
			this.$emit('set-column-batch-sort',[[],[]]);

			setTimeout(() => this.$emit('reset'),500);
		},
		dropBatchSort(v) {
			if(typeof v.moved === undefined)
				return;
			
			let out     = JSON.parse(JSON.stringify(this.columnBatchSortAll));
			const batch = this.columnBatchesAll[v.moved.oldIndex];
			
			out.splice(v.moved.oldIndex, 1);
			out.splice(v.moved.newIndex, 0, batch.batchOrderIndex);

			this.setBatchOrder(out,this.columnIdsShown);
		},
		setBatchOrder(batchSortAll,columnIdsShown) {
			let batchSortShown = [];
			let indexesMissing = [];

			// as batches get filtered down to what is available, the batch order indexes must be corrected
			// [5,3,4,0] is missing indexes [1,2] -> is converted to: [3,1,2,0]
			// we store both original and corrected sort order recover full sort order later
			for(const batchIndex of batchSortAll) {
				const batch = this.columnBatchesAllUnsorted[batchIndex];
				if(this.getBatchIsVisible(batch,columnIdsShown))
					batchSortShown.push(batchIndex);
				else
					indexesMissing.push(batchIndex);
			}

			indexesMissing.sort((a,b) => b - a);
			for(const indexMissing of indexesMissing) {
				for(let i = 0, j = batchSortShown.length; i < j; i++) {
					if(batchSortShown[i] > indexMissing)
						batchSortShown[i]--;
				}
			}
			this.$emit('set-column-batch-sort',[batchSortShown,batchSortAll]);
		}
	}
};