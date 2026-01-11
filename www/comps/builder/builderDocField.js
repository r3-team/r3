import {getTemplateDocField} from '../shared/builderTemplate.js';

export default {
	name:'my-builder-doc-field',
	components:{},
	template:`<div class="builder-doc-field"
		:class="{ flow:isFlow, 'drag-preview':isDragPreview }"
		:style
		:key="field.id"
	>
		<div class="builder-doc-field-title" v-if="!hasChildren">{{ title }}</div>

		<span v-if="isDragPreview">PREV</span>

		<div class="builder-doc-fields" ref="fields"
			v-if="hasChildren"
			@dragenter.stop="dragEnter"
			@dragleave.stop="dragLeave"
			@dragover.prevent
			@drop.stop="drop"
			:class="{ 'layout-flow':isFlow, 'layout-grid':isGrid }"
			:data-is-parent="hasChildren"
			:style="styleChildren"
		>
			<my-builder-doc-field
				v-for="(f,i) in field.fields"
				v-model="f"
				draggable="true"
				@dragenter.stop="dragEnterField($event,i)"
				@dragleave.stop
				@dragend.stop="dragEnd"
				@dragstart.stop="dragStart($event,f)"
				:builderLanguage
				:class="{ 'drag-source':f.id === fieldIdDragged }"
				:entityIdMapRef
				:key="f.id"
				:parentGrid="isGrid"
			/>
		</div>
	</div>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		entityIdMapRef: { type:Object,  required:false, default:() => {return {}} },
		modelValue:     { type:Object,  required:true },
		parentGrid:     { type:Boolean, required:false, default:false }
	},
	data() {
		return {
			fieldIdDragged:null,        // ID of child field being dragged
			fieldIndexDragPreview:null, // index of child field that something is being dragged over
			fieldIndexDropped:null,     // index of child field that was just dropped (to block removal)
			gridFieldSizeMinX:10,
			gridFieldSizeMinY:5,
			gridSize:2,
			pixelToMm:25.4 / 96
		};
	},
	emits:['update:modelValue'],
	computed:{
		title:s => {
			switch(s.field.content) {
				case 'data': return `${s.field.attributeIndex} ${s.attribute.name}`; break;
				case 'flow': return 'FLOW';
				case 'grid': return 'GRID';
				case 'list': return 'LIST';
				case 'text': return 'TEXT';
			}
			return '';
		},

		// inputs
		field:{ // this method updates obj directly
			get()  { return this.modelValue; },
			set(v) { this.$emit('update:modelValue',v); }
		},

		// simple
		attribute:    s => s.isData ? s.attributeIdMap[s.field.attributeId] : null,
		isData:       s => s.field.content === 'data',
		isDragPreview:s => s.field.content === 'dragDropPreview',
		isFlow:       s => ['flow','flowBody'].includes(s.field.content),
		isGrid:       s => ['grid','gridFooter','gridHeader'].includes(s.field.content),
		hasChildren:  s => s.isFlow || s.isGrid,
		style:        s => s.isFlow ? '' : `height:${s.field.sizeY}mm;${s.styleGrid}`,
		styleChildren:s => s.isGrid ? `background-size:${s.gridSize}mm ${s.gridSize}mm;` : '',
		styleGrid:    s => s.parentGrid ? `position:absolute;top:${s.field.posY}mm;left:${s.field.posX}mm;width:${s.field.sizeX}mm;height:${s.field.sizeY}mm` : '',

		// stores
		attributeIdMap:s => s.$store.getters['schema/attributeIdMap'],
		capApp:        s => s.$store.getters.captions.builder.doc,
		capGen:        s => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getTemplateDocField,

		// helpers
		dragPreviewCreate(index) {
			if(this.isFlow && this.fieldIndexDragPreview === null) {
				this.field.fields.splice(index,0,this.getTemplateDocField('dragDropPreview',null,null));
				this.fieldIndexDragPreview = index;
			}
		},
		dragPreviewRemove() {
			if(this.isFlow && this.fieldIndexDragPreview !== null) {
				this.field.fields.splice(this.field.fields.findIndex(v => v.content === 'dragDropPreview'),1);
				this.fieldIndexDragPreview = null;
			}
		},

		// drag source
		dragEnd(e) {
			if(e.dataTransfer.dropEffect !== 'none' && this.fieldIdDragged !== null) {
				this.field.fields.splice(this.field.fields.findIndex((v,i) => i !== this.fieldIndexDropped && v.id === this.fieldIdDragged),1);
				this.fieldIdDragged    = null;
				this.fieldIndexDropped = null;
			}
		},
		dragStart(e,field) {
			// store field for later drop & adjust ghost image to start at mouse position
			e.dataTransfer.setData('application/json',JSON.stringify(field));
			e.dataTransfer.setDragImage(e.srcElement,0,0);

			// store field index for removal from the source on later drop
			// timeout serves to make sure that ghost image is taken before hidden CSS is applied
			setTimeout(() => this.fieldIdDragged = field.id,50);
		},

		// drag target
		dragEnter(e) {
			e.preventDefault(); // to allow drop on parent

			// generate preview if dragover occurs on this elm and preview does not exist yet
			if(e.target === e.currentTarget)
				this.dragPreviewCreate(this.field.fields.length);
		},
		dragEnterField(e,fieldIndex) {
			e.preventDefault(); // to allow drop on parent

			if(this.fieldIndexDragPreview !== null)
				this.dragPreviewRemove();

			this.dragPreviewCreate(fieldIndex);
		},
		dragLeave(e) {
			this.dragPreviewRemove();
		},
		drop(e) {
			const field         = JSON.parse(e.dataTransfer.getData('application/json'));
			const fieldsElm     = e.currentTarget; // the valid drop elm, ie. fields container
			const fieldsElmRect = fieldsElm.getBoundingClientRect();
			const gridSizeX     = fieldsElmRect.width  * this.pixelToMm;
			const gridSizeY     = fieldsElmRect.height * this.pixelToMm;

			if(this.isGrid) {
				// find position in grid
				field.posX  = (e.clientX - fieldsElmRect.left) * this.pixelToMm;
				field.posY  = (e.clientY - fieldsElmRect.top)  * this.pixelToMm;
	
				// snap position to grid
				field.posX = Math.round(field.posX / this.gridSize) * this.gridSize;
				field.posY = Math.round(field.posY / this.gridSize) * this.gridSize;

				// if field has no size, set to half of grid width
				if(field.sizeX === 0)
					field.sizeX = gridSizeX / 2;

				// limit size to grid size
				if(field.posX + field.sizeX > gridSizeX) field.sizeX = gridSizeX - field.posX;
				if(field.posY + field.sizeY > gridSizeY) field.sizeY = gridSizeY - field.posY;

				// force minimum field sizes
				if(field.sizeX < this.gridFieldSizeMinX) field.sizeX = this.gridFieldSizeMinX;
				if(field.sizeY < this.gridFieldSizeMinY) field.sizeY = this.gridFieldSizeMinY;
	
				// snap field sizes to grid
				field.sizeX = Math.max(this.gridSize, Math.round(field.sizeX / this.gridSize) * this.gridSize);
				field.sizeY = Math.max(this.gridSize, Math.round(field.sizeY / this.gridSize) * this.gridSize);
			}

			if(this.isFlow) {
				field.sizeX = 0;
			}

			if(this.fieldIndexDragPreview === null)
				return this.field.fields.push(field);
			
			this.field.fields.splice(this.fieldIndexDragPreview,1,field);
			this.fieldIndexDropped     = this.fieldIndexDragPreview;
			this.fieldIndexDragPreview = null;
		}
	}
};