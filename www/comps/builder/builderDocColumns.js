import {getDocColumnTitle}    from '../shared/builderDoc.js';
import {getTemplateDocColumn} from '../shared/builderTemplate.js';

export default {
	name:'my-builder-doc-columns',
	components:{},
	template:`<div class="builder-doc-columns"
		@dragenter="dragEnter($event,columns.length-1)"
		@dragleave="dragLeave"
		@dragover="dragOver"
		@drop="drop"
	>
		<div class="builder-doc-bg-text">{{ capGen.columns }}</div>
		<div class="builder-doc-column"
			v-for="(c,i) in columns"
			@dragenter="dragEnter($event,i)"
			@dragleave="dragLeave"
			@dragend.stop="dragEnd($event,c.id)"
			@dragstart.stop="dragStart($event,c)"
			:class="{ dragPreview:c.content === dragContent, dragSource:columnIdDragged === c.id }"
			:style="getStyle(c)"
			:draggable="!readonly"
			:key="c.id"
		>
			<div class="builder-doc-column-title" v-if="c.content !== dragContent">
				{{ getDocColumnTitle(c) }}
			</div>
		</div>
	</div>`,
	props:{
		builderLanguage:{ type:String, required:true },
		dragType:       { type:String, required:true },
		modelValue:     { type:Array,  required:true },
		parentSizeX:    { type:Number, required:true },
		readonly:       { type:Boolean,required:true },
		zoom:           { type:Number, required:true }
	},
	data() {
		return {
			columnIdDragged:null,
			dragEnterCounter:0
		};
	},
	emits:['update:modelValue'],
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

		// stores
		capApp:     s => s.$store.getters.captions.builder.doc,
		capGen:     s => s.$store.getters.captions.generic,
		dragContent:s => s.$store.getters.constants.dragColumnContent
	},
	methods:{
		// externals
		getDocColumnTitle,
		getTemplateDocColumn,

		// presentation
		getStyle(c) {
			return `width:${this.columnIdMapWidth[c.id] * this.zoom}mm;`;
		},

		// drag & drop
		dragPreviewGetIndex() {
			return this.columns.findIndex(v => v.content === this.dragContent);
		},
		dragPreviewRemove() {
			const ind = this.dragPreviewGetIndex();
			if(ind !== -1) this.columns.splice(ind,1);
		},
		dragPreviewUpdate(ind) {
			this.dragPreviewRemove();
			let column = this.getTemplateDocColumn(this.dragContent,null,null);
			column.content = this.dragContent;
			this.columns.splice(ind,0,column);
		},

		// drag source
		dragEnd(e,columnId) {
			this.columnIdDragged = null;

			const ind = this.columns.findIndex(v => v.id === columnId);
			if(ind !== -1) this.columns.splice(ind,1);
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
		dragOver(e) {
			if(e.dataTransfer.types.includes(this.dragType))
				e.preventDefault();
		},
		dragEnter(e,ind) {
			if(!e.dataTransfer.types.includes(this.dragType))
				return e.stopPropagation();

			e.stopPropagation();
			this.dragEnterCounter++;
			if(this.dragEnterCounter === 1)
				this.dragPreviewUpdate(ind);
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
			this.dragEnterCounter = 0;

			const column     = JSON.parse(e.dataTransfer.getData('application/json'));
			const indPreview = this.dragPreviewGetIndex();
			if(indPreview !== -1) this.columns.splice(indPreview,1,column);
			else                  this.columns.push(column);
		}
	}
};