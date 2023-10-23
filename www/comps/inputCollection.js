import {getColumnTitle} from './shared/column.js';
import {srcBase64}      from './shared/image.js';
import {
	getCollectionColumn,
	getCollectionColumnIndex
} from './shared/collection.js';
export {MyInputCollection as default};

let MyInputCollection = {
	name:'my-input-collection',
	template:`<div class="input-collection input-custom" @keyup.esc="escape">
	
		<my-button
			@trigger="click"
			:active="!readonly"
			:caption="titleAction"
			:captionTitle="title"
			:imageBase64="hasIcon ? srcBase64(iconIdMap[collection.iconId].file) : ''"
			:naked="true"
		/>
		
		<!-- value previews -->
		<div class="preview row gap centered">
			<template v-for="(recIndex,i) in rowIndexesSelected">
				<div class="entry clickable"
					v-if="i < previewCount"
					@click="entryRemove(recIndex)"
				>
					{{ rows[recIndex].values[valueIndexDisplay] }}
				</div>
			</template>
		</div>
		
		<!-- hover input -->
		<div class="app-sub-window under-header"
			v-if="showHover"
			@click.self.stop="showHover = false"
		>
			<div class="input-collection-hover contentBox float">
				<div class="top lower">
					<div class="area">
						<img class="icon"
							v-if="hasIcon"
							:src="srcBase64(iconIdMap[collection.iconId].file)"
						/>
						<div class="caption">{{ title }}</div>
					</div>
					<div class="area">
						<my-button image="cancel.png"
							@trigger="showHover = false"
							:blockBubble="true"
							:cancel="true"
						/>
					</div>
				</div>
				<div class="content grow input-collection-sides">
					
					<!-- available -->
					<div class="input-collection-side">
						<div class="row gap centered space-between default-inputs">
							<span class="label">{{ capGen.available }}</span>
							<input class="short"
								v-model="textInput"
								:placeholder="capGen.threeDots"
							/>
						</div>
						<div class="entries">
							<div class="entry clickable" tabindex="0"
								v-for="(index,i) in rowIndexesVisible"
								@click.stop="entrySelect(index)"
								@keyup.enter.space="entrySelect(index)"
							>
								{{ rows[index].values[valueIndexDisplay] }}
							</div>
						</div>
					</div>
					
					<!-- active selections -->
					<div class="input-collection-side">
						<div class="row gap centered">
							<span class="label">{{ capGen.selected }}</span>
							<my-button image="delete.png"
								@trigger="$emit('update:modelValue',[])"
								:active="hasSelections"
								:cancel="true"
								:caption="capGen.button.clear"
							/>
						</div>
						<div class="entries">
							<div v-for="i in rowIndexesSelected" class="entry clickable" tabindex="0"
								@click.stop="entryRemove(i)"
								@keyup.enter.space="entryRemove(i)"
							>
								{{ rows[i].values[valueIndexDisplay] }}
							</div>
						</div>
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
		previewCount:   { type:Number,  required:true },
		readonly:       { type:Boolean, required:false, default:false },
		showTitle:      { type:Boolean, required:false, default:true }
	},
	emits:['update:modelValue'],
	data() {
		return {
			textInput:'', // text line input
			showHover:false
		};
	},
	computed:{
		titleAction:(s) => {
			const cnt         = (s.previewCount === 0 ? '' : '+') + (s.rowIndexesSelected.length - s.previewCount).toString();
			const enoughSpace = s.rowIndexesSelected.length <= s.previewCount;
			
			if(!s.showTitle && s.hasIcon)
				return enoughSpace ? '' : cnt;
			
			return enoughSpace ? s.title : `${s.title} (${ cnt })`;
		},
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
		hasIcon:          (s) => s.collection.iconId !== null,
		hasSelections:    (s) => s.rowIndexesSelected.length !== 0,
		rows:             (s) => s.collectionIdMap[s.collectionId],
		title:            (s) => s.getColumnTitle(s.getCollectionColumn(s.collectionId,s.columnIdDisplay)),
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
		click() {
			if(!this.readonly)
				this.showHover = true;
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
		escape() { this.showHover = false; }
	}
};