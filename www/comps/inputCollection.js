import {getColumnTitle} from './shared/column.js';
import {srcBase64}      from './shared/image.js';
import {
	getCollectionColumn,
	getCollectionColumnIndex
} from './shared/collection.js';
export {MyInputCollection as default};

let MyInputCollection = {
	name:'my-input-collection',
	template:`<div class="input-collection input-custom"
		@keyup.esc="escape"
		v-click-outside="escape"
	>
		<img class="line-icon"
			v-if="collection.iconId !== null"
			:src="srcBase64(iconIdMap[collection.iconId].file)"
		/>
		
		<input type="text"
			v-model="textInput"
			@keyup="keyup"
			@keyup.enter="enter"
			@keyup.esc="escape"
			:class="{ small:rowIndexesSelected.length !== 0 }"
			:disabled="readonly"
			:placeholder="placeholder"
			:tabindex="!readonly ? 0 : -1"
		/>
		
		<!-- first two selections as preview -->
		<div class="entries preview">
			<template v-for="(recIndex,i) in rowIndexesSelected">
				<div class="entry clickable"
					v-if="i < resultPreviewCnt"
					@click="entryRemove(recIndex)"
				>
					{{ rows[recIndex].values[valueIndexDisplay] }}
				</div>
			</template>
				
			<div class="entry clickable"
				v-if="rowIndexesSelected.length > resultPreviewCnt"
				@click="toggle"
			>
				{{ '+' + (rowIndexesSelected.length-resultPreviewCnt).toString() }}
			</div>
		</div>
		
		<my-button image="arrowDown.png"
			v-if="!readonly"
			@trigger="toggle"
			:naked="true"
		/>
		
		<!-- context menu dropdown -->
		<div class="input-dropdown-wrap overhang">
			<div v-if="showDropdown" class="input-dropdown context">
				
				<!-- search results -->
				<div class="entries">
					<div class="label" v-if="rowIndexesVisible.length === 0">
						{{ capGen.resultsNone }}
					</div>
					<div class="label" v-if="rowIndexesVisible.length !== 0">
						{{ capGen.available }}
					</div>
					
					<template v-for="(index,i) in rowIndexesVisible">
						<div class="entry clickable" tabindex="0"
							v-if="i < limitVisible"
							@click.stop="entrySelect(index)"
							@keyup.enter.space="entrySelect(index)"
						>
							{{ rows[index].values[valueIndexDisplay] }}
						</div>
					</template>
				</div>
				
				<!-- more results -->
				<div class="actions">
					<my-button
						v-if="rowIndexesVisible.length > limitVisible"
						@trigger="limitVisible += 10"
						:blockBubble="true"
						:caption="capGen.more"
						:naked="true"
					/>
				</div>
			
				<!-- all active selections -->
				<div class="entries box" v-if="multiValue && rowIndexesSelected.length !== 0">
					<div class="label">{{ capGen.selected }}</div>
					<div v-for="i in rowIndexesSelected" class="entry clickable" tabindex="0"
						@click.stop="entryRemove(i)"
						@keyup.enter.space="entryRemove(i)"
					>
						{{ rows[i].values[valueIndexDisplay] }}
					</div>
				</div>
			</div>
		</div>
	</div>`,
	props:{
		collectionId:   { type:String,  required:true },
		columnIdDisplay:{ type:String,  required:true },
		modelValue:     { required:true }, // indexes of selected rows in collection
		multiValue:     { type:Boolean, required:false, default:false },
		readonly:       { type:Boolean, required:false, default:false }
	},
	emits:['update:modelValue'],
	data() {
		return {
			limitVisible:10,       // number of available entries shown in context menu
			textInput:'',          // text line input
			showDropdown:false
		};
	},
	computed:{
		rowIndexesSelected:(s) => typeof s.modelValue === 'undefined' ? [] : s.modelValue,
		rowIndexesVisible: (s) => {
			let out = [];
			for(let i = 0, j = s.rows.length; i < j; i++) {
				if(!s.rowIndexesSelected.includes(i)
					&& (
						s.textInput === ''
						|| s.rows[i].values[s.valueIndexDisplay].toLowerCase().includes(s.textInput.toLowerCase())
					)
				) out.push(i);
			}
			return out;
		},
		
		// simple states
		collection:       (s) => s.collectionIdMapSchema[s.collectionId],
		placeholder:      (s) => s.getColumnTitle(s.getCollectionColumn(s.collectionId,s.columnIdDisplay)),
		resultPreviewCnt: (s) => !s.isMobile ? 2 : 0,
		rows:             (s) => s.collectionIdMap[s.collectionId],
		valueIndexDisplay:(s) => s.getCollectionColumnIndex(s.collectionId,s.columnIdDisplay),
		
		// stores
		collectionIdMap:      (s) => s.$store.getters['collectionIdMap'],
		collectionIdMapSchema:(s) => s.$store.getters['schema/collectionIdMap'],
		iconIdMap:            (s) => s.$store.getters['schema/iconIdMap'],
		capGen:               (s) => s.$store.getters.captions.generic,
		isMobile:             (s) => s.$store.getters.isMobile
	},
	methods:{
		// externals
		getCollectionColumn,
		getCollectionColumnIndex,
		getColumnTitle,
		srcBase64,
		
		// actions
		enter() {
			if(this.textInput === '' && !this.showDropdown)
				return this.toggle();
			
			if(this.rowIndexesVisible.length > 0)
				this.entrySelect(this.rowIndexesVisible[0]);
		},
		entryRemove(i) {
			const pos = this.rowIndexesSelected.indexOf(i);
			if(pos === -1)
				return;
			
			let rowIndexes = JSON.parse(JSON.stringify(this.rowIndexesSelected));
			rowIndexes.splice(pos,1);
			this.$emit('update:modelValue',rowIndexes);
		},
		entrySelect(i) {
			let rowIndexes = JSON.parse(JSON.stringify(this.rowIndexesSelected));
			
			if(!this.multiValue) rowIndexes = [];
			
			this.textInput = '';
			rowIndexes.push(i);
			this.$emit('update:modelValue',rowIndexes);
		},
		escape() { this.showDropdown = false; },
		keyup () { this.showDropdown = true; },
		toggle() { this.showDropdown = !this.showDropdown; }
	}
};