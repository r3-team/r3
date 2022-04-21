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
					v-if="i < 2"
					@click="entryRemove(recIndex)"
				>
					{{ rows[recIndex].values[valueIndexDisplay] }}
				</div>
			</template>
				
			<div class="entry clickable"
				v-if="rowIndexesSelected.length > 2"
				@click="toggle"
			>
				{{ '+' + (rowIndexesSelected.length-2).toString() }}
			</div>
		</div>
		
		<my-button image="arrowDown.png"
			v-if="!readonly"
			@trigger="toggle"
			:naked="true"
		/>
		
		<!-- context menu dropdown -->
		<div class="input-dropdown-wrap left-overhang">
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
		multiValue:     { type:Boolean, required:false, default:false },
		readonly:       { type:Boolean, required:false, default:false }
	},
	emits:['update:indexes'],
	data:function() {
		return {
			rowIndexesSelected:[], // selected record indexes
			limitVisible:10,       // number of available entries shown in context menu
			textInput:'',          // text line input
			showDropdown:false
		};
	},
	computed:{
		placeholder:(s) => {
			return s.getColumnTitle(s.getCollectionColumn(s.collectionId,s.columnIdDisplay));
		},
		rowIndexesVisible:(s) => {
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
		rows:             (s) => s.collectionIdMap[s.collectionId],
		valueIndexDisplay:(s) => s.getCollectionColumnIndex(s.collectionId,s.columnIdDisplay),
		
		// stores
		collectionIdMap:      (s) => s.$store.getters['collectionIdMap'],
		collectionIdMapSchema:(s) => s.$store.getters['schema/collectionIdMap'],
		iconIdMap:            (s) => s.$store.getters['schema/iconIdMap'],
		capGen:               (s) => s.$store.getters.captions.generic
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
			
			this.rowIndexesSelected.splice(pos,1);
			this.$emit('update:indexes',this.rowIndexesSelected);
		},
		entrySelect(i) {
			if(!this.multiValue)
				this.rowIndexesSelected = [];
			
			this.textInput = '';
			this.rowIndexesSelected.push(i);
			this.$emit('update:indexes',this.rowIndexesSelected);
		},
		escape() { this.showDropdown = false; },
		keyup () { this.showDropdown = true; },
		toggle() { this.showDropdown = !this.showDropdown; }
	}
};