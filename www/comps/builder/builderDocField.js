import {getTemplateDocField} from '../shared/builderTemplate.js';
import MyInputDecimal        from '../inputDecimal.js';
import MyInputRange          from '../inputRange.js';
import MyBuilderDocSets      from './builderDocSets.js';

export default {
	name:'my-builder-doc-field',
	components:{
		MyBuilderDocSets,
		MyInputDecimal,
		MyInputRange
	},
	template:`<div class="builder-doc-field" ref="field"
		@mousedown.stop="$emit('setFieldIdOptions',field.id)"
		:class="{ flow:isFlow, 'drag-preview':isDragPreview, 'resizable-both':isChildGrid, 'resizable-height':isChildFlow, selected:isOptionsShow }"
		:style
		:key="field.id"
	>
		<div class="builder-doc-field-title" v-if="!isParent">{{ title }}</div>

		<span v-if="isDragPreview">PREV</span>

		<div class="builder-doc-fields"
			v-if="isParent"
			@dragenter.stop="dragEnter"
			@dragleave.stop="dragLeave"
			@dragover.prevent
			@drop.stop="drop"
			:class="{ 'layout-flow':isFlow, 'layout-grid':isGrid }"
			:data-is-parent="isParent"
			:style="styleChildren"
		>
			<my-builder-doc-field
				v-for="(f,i) in field.fields"
				v-model="f"
				draggable="true"
				@setFieldIdOptions="$emit('setFieldIdOptions',$event)"
				@dragenter.stop="dragEnterField($event,i)"
				@dragleave.stop
				@dragend.stop="dragEnd"
				@dragstart.stop="dragStart($event,f)"
				:builderLanguage
				:class="{ 'drag-source':f.id === fieldIdDragged }"
				:elmFieldOptions
				:entityIdMapRef
				:fieldIdOptions
				:parentSizeX="field.sizeX !== 0 ? field.sizeX : parentSizeX"
				:parentSizeY="field.sizeY !== 0 ? field.sizeY : parentSizeY"
				:gridParentSnap="isGrid ? field.sizeSnap : 0"
				:joins
				:key="f.id"
				:isChildFlow="isFlow"
				:isChildGrid="isGrid"
				:readonly
			/>
		</div>

		<!-- options -->
		<teleport v-if="isOptionsShow" :to="elmFieldOptions">
			<table class="generic-table-vertical default-inputs">
				<tbody>
					<tr>
						<td>{{ capGen.showDefault1 }}</td>
						<td><my-bool v-model="field.state" :readonly /></td>
					</tr>
					
					<template v-if="isGrid || isChildGrid">
						<tr v-if="isChildGrid">
							<td>{{ capGen.sizeX }}</td>
							<td>
								<div class="row gap centered">
									<my-input-range   class="short" v-model="field.sizeX" :readonly :min="gridParentSnap" :max="sizeXMax" :step="gridParentSnap" />
									<my-input-decimal class="short" v-model="field.sizeX" :readonly :min="gridParentSnap" :max="sizeXMax" :allowNull="false" :length="5" :lengthFract="2" />
								</div>
							</td>
						</tr>
						<tr>
							<td>{{ capGen.sizeY }}</td>
							<td>
								<div class="row gap centered">
									<my-input-range   class="short" v-model="field.sizeY" :readonly :min="gridParentSnap" :max="sizeYMax" :step="gridParentSnap" />
									<my-input-decimal class="short" v-model="field.sizeY" :readonly :min="gridParentSnap" :max="sizeYMax" :allowNull="false" :length="5" :lengthFract="2" />
								</div>
							</td>
						</tr>
					</template>

					<template v-if="isGrid">
						<tr>
							<td>{{ capApp.grid.sizeSnap }}</td>
							<td>
								<div class="row gap centered">
									<my-input-range   class="short" v-model="field.sizeSnap" :readonly :min="0.5" :max="10" :step="0.1" />
									<my-input-decimal class="short" v-model="field.sizeSnap" :readonly :min="0.5" :max="10" :allowNull="false" :length="4" :lengthFract="2" />
								</div>
							</td>
						</tr>
						<tr>
							<td>{{ capApp.grid.shrink }}</td>
							<td><my-bool v-model="field.shrink" :readonly /></td>
						</tr>
					</template>
					
					<my-builder-doc-sets
						v-model="field.sets"
						:allowData="true"
						:allowValue="true"
						:joins
						:readonly
						:targetsFont="true"
					/>
				</tbody>
			</table>
		</teleport>
	</div>`,
	props:{
		builderLanguage:{ type:String,        required:true },
		elmFieldOptions:{ required:true },
		entityIdMapRef: { type:Object,        required:true },
		fieldIdOptions: { type:[String,null], required:true },
		gridParentSnap: { type:Number,        required:false, default:0 },
		joins:          { type:Array,         required:true },
		modelValue:     { type:Object,        required:true },
		parentSizeX:    { type:Number,        required:true },
		parentSizeY:    { type:Number,        required:true },
		isChildGrid:    { type:Boolean,       required:false, default:false },
		isChildFlow:    { type:Boolean,       required:false, default:false },
		readonly:       { type:Boolean,       required:true }
	},
	data() {
		return {
			fieldIdDragged:null,        // ID of child field being dragged
			fieldIndexDragPreview:null, // index of child field that something is being dragged over
			fieldIndexDropped:null,     // index of child field that was just dropped (to block removal)
			gridFieldSizeMinX:0,
			gridFieldSizeMinY:5,
			pixelToMm:25.4 / 96,
			sizeObserver:null,          // for HTML resize actions without custom drag&drop
			timerAdjustSize:null
		};
	},
	emits:['setFieldIdOptions','update:modelValue'],
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
		styleChildren:s => s.isGrid ? `
			background-image:radial-gradient(var(--color-border) ${s.styleDotSize}mm, transparent ${s.styleDotSize}mm);
			background-size:${s.sizeSnap}mm ${s.sizeSnap}mm;
			background-position:${s.styleDotPos}mm ${s.styleDotPos}mm` : '',

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
		isParent:     s => s.isFlow || s.isGrid,
		isOptionsShow:s => s.fieldIdOptions === s.field.id,
		sizeSnap:     s => s.isGrid ? s.field.sizeSnap : s.gridParentSnap,
		sizeXMax:     s => s.parentSizeX - s.field.posX,
		sizeYMax:     s => s.parentSizeY - s.field.posY,
		style:        s => s.isGrid || s.isChildGrid ? `height:${s.field.sizeY}mm;${s.styleGrid}` : '',
		styleDotPos:  s => (s.sizeSnap / 2) - s.sizeSnap,
		styleDotSize: s => s.sizeSnap / 5,
		styleGrid:    s => s.isChildGrid ? `position:absolute;top:${s.field.posY}mm;left:${s.field.posX}mm;width:${s.field.sizeX}mm;height:${s.field.sizeY}mm` : '',

		// stores
		attributeIdMap:s => s.$store.getters['schema/attributeIdMap'],
		capApp:        s => s.$store.getters.captions.builder.doc,
		capGen:        s => s.$store.getters.captions.generic
	},
	mounted() {
		this.sizeObserver = new ResizeObserver(entries => {
			requestAnimationFrame(() => {
				const entry = entries[0];
				const rect  = entry.contentRect;
				const sizeX = rect.width  * this.pixelToMm;
				const sizeY = rect.height * this.pixelToMm;
				clearTimeout(this.timerAdjustSize);

				if(sizeX !== 0 && sizeY !== 0)
					this.timerAdjustSize = setTimeout(() => this.adjustSizeToSnap(sizeX,sizeY),50);
			});
		});
		this.sizeObserver.observe(this.$refs.field);
	},
	unmounted() {
		if(this.sizeObserver) this.sizeObserver.disconnect();
	},
	methods:{
		// externals
		getTemplateDocField,

		// presentation
		adjustSizeToSnap(sizeX,sizeY) {
			const sizeXClean = this.getSizeClean(this.field.posX,sizeX,this.parentSizeX,this.gridFieldSizeMinX);
			const sizeYClean = this.getSizeClean(this.field.posY,sizeY,this.parentSizeY,this.gridFieldSizeMinY);

			if(sizeXClean !== sizeX || sizeYClean !== sizeY) {
				this.field.sizeX = sizeXClean;
				this.field.sizeY = sizeYClean;
			}
		},
		getSizeClean(posChild,sizeChild,sizeParent,sizeMin) {
			// limit size to parent size
			if(this.isChildGrid && posChild + sizeChild > sizeParent)
				sizeChild = sizeParent - posChild;

			// force minimum sizes
			if(sizeChild < sizeMin)
				sizeChild = sizeMin;

			// snap size to grid
			if(this.isChildGrid)
				sizeChild = Math.max(this.sizeSnap, Math.round(sizeChild / this.sizeSnap) * this.sizeSnap);

			return sizeChild;
		},

		// drag & drop
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

			if(this.isGrid) {
				// find position in grid
				field.posX = (e.clientX - fieldsElmRect.left) * this.pixelToMm;
				field.posY = (e.clientY - fieldsElmRect.top)  * this.pixelToMm;
	
				// snap position to grid
				field.posX = Math.round(field.posX / this.sizeSnap) * this.sizeSnap;
				field.posY = Math.round(field.posY / this.sizeSnap) * this.sizeSnap;

				// if field has no size, set to half of grid width
				if(field.sizeX === 0) field.sizeX = gridSizeX / 2;
				if(field.sizeY === 0) field.sizeY = this.gridFieldSizeMinY;
			}

			if(this.isFlow) {
				field.sizeX = 0;

				if(field.sizeY === 0)
					field.sizeY = 6;
			}

			if(this.fieldIndexDragPreview === null)
				return this.field.fields.push(field);
			
			this.field.fields.splice(this.fieldIndexDragPreview,1,field);
			this.fieldIndexDropped     = this.fieldIndexDragPreview;
			this.fieldIndexDragPreview = null;
		}
	}
};