import MyBuilderDocColumn     from './builderDocColumn.js';
import {getTemplateDocColumn} from '../shared/builderTemplate.js';

export default {
	name:'my-builder-doc-columns',
	components:{MyBuilderDocColumn},
	template:`<div class="builder-doc-columns"
		@dragenter="dragEnter"
		@dragleave="dragLeave"
		@dragover="dragOver($event,null)"
		@drop="drop"
	>
		<div class="builder-doc-bg-text">{{ capGen.columns }}</div>

		<my-builder-doc-column
			v-model="c"
			v-for="(c,i) in columns"
			@click.stop="$emit('setColumnIdOptions',c.id)"
			@close="$emit('setColumnIdOptions',null)"
			@dragenter="dragEnter"
			@dragover="dragOver($event,c.id)"
			@dragleave="dragLeave"
			@dragend.stop="dragEnd"
			@dragstart.stop="dragStart($event,c)"
			:builderLanguage
			:elmOptions
			:isDragPreview="columnIdPreview === c.id"
			:isDragSource="columnIdDragged === c.id"
			:isOptionsShow="columnIdOptions === c.id"
			:joins
			:joinsParent
			:style="getStyle(c)"
			:draggable="!readonly"
			:key="c.id"
			:moduleId
			:readonly
			:sizeXMax
		/>
	</div>`,
	props:{
		builderLanguage:{ type:String,        required:true },
		columnIdOptions:{ type:[String,null], required:true },
		dragType:       { type:String,        required:true },
		elmOptions:     { required:true },
		joins:          { type:Array,         required:true },
		joinsParent:    { type:Array,         required:true },
		modelValue:     { type:Array,         required:true },
		moduleId:       { type:String,        required:true },
		parentSizeX:    { type:Number,        required:true },
		readonly:       { type:Boolean,       required:true },
		sizeXMax:       { type:Number,        required:true },
		zoom:           { type:Number,        required:true }
	},
	data() {
		return {
			columnIdDragged:null,
			columnIdPreview:null,
			dragEnterCounter:0
		};
	},
	emits:['setColumnIdOptions','update:modelValue'],
	computed:{
		columnIdMapWidth:s => {
			let out            = {};
			let columnCntAuto  = 0;
			let sizeXAvailable = s.parentSizeX;

			// fixed widths
			for(const c of s.columns) {
				if(c.sizeX !== 0) {
					out[c.id] = c.sizeX;
					sizeXAvailable -= c.sizeX;
				} else {
					columnCntAuto++;
				}
			}
			// dynamic widths
			const sizeXAuto = sizeXAvailable / columnCntAuto;
			for(const c of s.columns) {
				if(c.sizeX === 0)
					out[c.id] = sizeXAuto;
			}
			return out;
		},

		// inputs
		columns:{ // this method updates obj directly
			get()  { return this.modelValue; },
			set(v) { this.$emit('update:modelValue',v); }
		},

		// simple
		dragPreviewIndex:s => s.columns.findIndex(v => v.id === s.columnIdPreview),

		// stores
		capApp:s => s.$store.getters.captions.builder.doc,
		capGen:s => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getTemplateDocColumn,

		// presentation
		getStyle(c) {
			return `width:${this.columnIdMapWidth[c.id] * this.zoom}mm;`;
		},

		// drag & drop
		dragPreviewMoveTo(ind) {
			if(this.dragPreviewIndex === -1) {
				const column = this.getTemplateDocColumn(null,0,false);
				this.columns.splice(ind,0,column);
				this.columnIdPreview = column.id;
				return;
			}

			if(ind === -1)
				ind = 0;

			if(this.dragPreviewIndex === ind)
				return;

			const columnsNew = this.columns.filter(v => v.id !== this.columnIdPreview);
			columnsNew.splice(ind,0,this.columns[this.dragPreviewIndex]);
			this.columns = columnsNew;
		},
		dragPreviewRemove() {
			if(this.dragPreviewIndex !== -1)
				this.columns.splice(this.dragPreviewIndex,1);

			this.columnIdPreview = null;
		},

		// drag source
		dragEnd(e) {
			const ind = this.columns.findIndex(v => v.id === this.columnIdDragged);
			if(ind !== -1) this.columns.splice(ind,1);

			this.columnIdDragged = null;
			this.dragPreviewRemove();
		},
		dragStart(e,column) {
			// store column for later drop & adjust ghost image to start at mouse position
			e.dataTransfer.setData('application/json',JSON.stringify(column));
			e.dataTransfer.setData(this.dragType,'');
			e.dataTransfer.setDragImage(e.srcElement,0,0);

			// store column index for removal from the source on later drop
			// timeout serves to make sure that ghost image is taken before hidden CSS is applied
			setTimeout(() => this.columnIdDragged = column.id,50);
		},

		// drag target
		dragOver(e,columnId) {
			if(e.dataTransfer.types.includes(this.dragType))
				e.preventDefault();
			
			e.stopPropagation();

			// column ID is null when dragOver on parent elm
			if(columnId === null) {
				if(this.dragPreviewIndex !== -1)
					return;

				return this.dragPreviewMoveTo(this.columns.length);
			}

			const rect = e.target.getBoundingClientRect();
			const leftSide = e.clientX < rect.left + (rect.width / 2);

			const ind = this.columns.filter(v => v.id !== this.dragPreviewIndex).findIndex(v => v.id === columnId);
			this.dragPreviewMoveTo(leftSide ? ind-1 : ind+1);
		},
		dragEnter(e) {
			if(!e.dataTransfer.types.includes(this.dragType))
				return e.stopPropagation();

			e.stopPropagation();
			this.dragEnterCounter++;
		},
		dragLeave(e) {
			if(!e.dataTransfer.types.includes(this.dragType))
				return e.stopPropagation();

			e.stopPropagation();
			this.dragEnterCounter--;
			if(this.dragEnterCounter === 0)
				this.dragPreviewRemove();
		},
		drop(e) {
			if(!e.dataTransfer.types.includes(this.dragType))
				return;
			
			e.stopPropagation();
			
			const column = JSON.parse(e.dataTransfer.getData('application/json'));
			const indEx  = this.columns.findIndex(v => v.id === column.id); // index of existing column (if there)

			// replace preview with new/existing column
			this.columns.splice(this.dragPreviewIndex,1,column);

			// delete existing column if there
			if(indEx !== -1)
				this.columns.splice(indEx,1);
			
			this.dragEnterCounter = 0;
			this.columnIdDragged = null;
			this.columnIdPreview = null;
		}
	}
};