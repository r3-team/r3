export default {
	name:'my-builder-doc-field',
	components:{},
	template:`<div class="builder-doc-field"
		@dragover.stop
		:class="{ flow:isFlow }"
		:style
		:key="field.id"
	>
		<div class="builder-doc-field-title">{{ title }}</div>

		<div class="builder-doc-fields"
			v-if="hasChildren"
			@dragover.prevent
			@drop.stop="drop"
			:class="{ 'layout-flow':isFlow, 'layout-grid':isGrid }"
			:style="styleChildren"
		>
			<my-builder-doc-field
				v-for="(f,i) in field.fields"
				v-model="f"
				draggable="true"
				@dragend.stop="dragEnd"
				@dragstart.stop="dragStart($event,f,i)"
				:builderLanguage
				:class="{ 'being-dragged':i === fieldIndexDragged }"
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
			fieldIndexDragged:null,
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
		dragEnd(e) {
			if(e.dataTransfer.dropEffect !== 'none' && this.fieldIndexDragged !== null) {
				this.field.fields.splice(this.fieldIndexDragged,1);
				this.fieldIndexDragged = null;
			}
		},
		dragStart(e,field,fieldIndex) {
			// store field for later drop & adjust ghost image to start at mouse position
			e.dataTransfer.setData('application/json',JSON.stringify(field));
			e.dataTransfer.setDragImage(e.srcElement,0,0);

			// store field index for removal from the source on later drop
			// timeout serves to make sure that ghost image is taken before hidden CSS is applied
			setTimeout(() => { this.fieldIndexDragged = fieldIndex; },50);
		},
		drop(e) {
			const rect      = e.target.getBoundingClientRect();
			const gridSizeX = rect.width  * this.pixelToMm;
			const gridSizeY = rect.height * this.pixelToMm;

			const field = JSON.parse(e.dataTransfer.getData('application/json'));

			if(this.isGrid) {
				// find position in grid
				field.posX  = (e.clientX - rect.left) * this.pixelToMm;
				field.posY  = (e.clientY - rect.top)  * this.pixelToMm;
	
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
			} else {
				field.sizeX = 0;
			}
			this.field.fields.push(field);
		}
	}
};