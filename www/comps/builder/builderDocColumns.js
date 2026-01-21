import MyBuilderAggregatorInput from './builderAggregatorInput.js';
import MyBuilderCaption         from './builderCaption.js';
import MyBuilderDocSets         from './builderDocSets.js';
import MyBuilderQuery           from './builderQuery.js';
import MyInputDecimal           from '../inputDecimal.js';
import MyInputRange             from '../inputRange.js';
import myTabs                   from '../tabs.js';
import {getDocColumnTitle}      from '../shared/builderDoc.js';
import {getTemplateDocColumn}   from '../shared/builderTemplate.js';

const MyBuilderDocColumn = {
	name:'my-builder-doc-column',
	components:{
		MyBuilderAggregatorInput,
		MyBuilderCaption,
		MyBuilderDocSets,
		MyBuilderQuery,
		MyInputDecimal,
		MyInputRange,
		myTabs
	},
	template:`<div class="builder-doc-column" :class="classCss">
		<div class="builder-doc-column-title" v-if="!isDragPreview">{{ title }}</div>
		
		<teleport v-if="isOptionsShow" :to="elmOptions">
			
			<my-builder-query
				v-if="false"
				v-model="column.query"
				:allowChoices="false"
				:allowOrders="true"
				:builderLanguage
				:filtersDisable
				:joinsParents="[joinsParent]"
				:moduleId
			/>

			<table class="generic-table-vertical default-inputs">
				<tbody>
					<tr>
						<td>{{ capGen.title }}</td>
						<td>
							<my-builder-caption
								v-model="column.captions.docColumnTitle"
								:contentName="capGen.title"
								:language="builderLanguage"
								:longInput="true"
								:readonly
							/>
						</td>
					</tr>
					<tr>
						<td>{{ capGen.lengthChars }}</td>
						<td><my-input-decimal class="short" v-model="column.length" :min="0" :allowNull="false" :length="9" :lengthFract="0" :readonly /></td>
					</tr>
					<tr>
						<td>{{ capGen.sizeX }}</td>
						<td>
							<div class="row gap centered" v-if="column.sizeX !== 0">
								<my-input-range   class="short" v-model="column.sizeX" :min="0" :max="sizeXMax" :readonly :step="0.1" />
								<my-input-decimal class="short" v-model="column.sizeX" :min="0" :max="sizeXMax" :readonly :allowNull="false" :length="5" :lengthFract="2" />
								<span>mm</span>
							</div>
							<my-button
								v-else
								@trigger="column.sizeX = 50"
								:caption="capGen.automatic"
								:naked="true"
							/>
						</td>
					</tr>
					<tr>
						<td>{{ capGen.resultRow }}</td>
						<td><my-builder-aggregator-input v-model="column.aggregator" :readonly /></td>
					</tr>
					<tr><td colspan="2"><b>{{ capGen.dataRetrieval }}</b></td></tr>
					<tr>
						<td>{{ capGen.options }}</td>
						<td>
							<div class="row gap centered">
								<my-button-check v-model="column.distincted" :caption="capGen.distincted" :readonly />
								<my-button-check v-model="column.groupBy"    :caption="capGen.groupBy"    :readonly />
							</div>
						</td>
					</tr>
				</tbody>
			</table>
			
			<div class="content grow">
				<div class="builder-doc-sub-settings">
					<my-tabs
						v-model="tabTarget"
						:entries="tabTargetList.entries"
						:entriesText="tabTargetList.labels"
					/>
					<my-builder-doc-sets
						v-if="tabTarget === 'body'"
						v-model="column.setsBody"
						:allowData="true"
						:allowValue="true"
						:joins
						:readonly
						:targetsFont="true"
					/>
					<my-builder-doc-sets
						v-if="tabTarget === 'header'"
						v-model="column.setsHeader"
						:allowData="true"
						:allowValue="true"
						:joins
						:readonly
						:targetsFont="true"
					/>
					<my-builder-doc-sets
						v-if="tabTarget === 'footer'"
						v-model="column.setsFooter"
						:allowData="true"
						:allowValue="true"
						:joins
						:readonly
						:targetsFont="true"
					/>
				</div>
			</div>
		</teleport>
	</div>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		elmOptions:     { required:true },
		isDragPreview:  { type:Boolean, required:true },
		isDragSource:   { type:Boolean, required:true },
		isOptionsShow:  { type:Boolean, required:true },
		joins:          { type:Array,   required:true },
		joinsParent:    { type:Array,   required:true },
		modelValue:     { type:Object,  required:true },
		readonly:       { type:Boolean, required:true },
		sizeXMax:       { type:Number,  required:true }
	},
	emits:['update:modelValue'],
	data() {
		return {
			filtersDisable:[
				'collection','field','fieldChanged','fieldValid','formChanged',
				'formState','getter','globalSearch','javascript','recordMayCreate',
				'recordMayDelete','recordMayUpdate','recordNew','variable'
			],
			tabTarget:'body'
		};
	},
	computed:{
		classCss:s => {
			return { dragPreview:s.isDragPreview, dragSource:s.isDragSource, selected:s.isOptionsShow };
		},
		tabTargetList:s => {
			return {
				entries:['body','header','footer'],
				labels:[s.capGen.content,s.capGen.header,s.capGen.footer]
			}
		},

		// inputs
		column:{ // this method updates obj directly
			get()  { return this.modelValue; },
			set(v) { this.$emit('update:modelValue',v); }
		},

		// simple
		title:s => getDocColumnTitle(s.column),

		// stores
		capApp:s => s.$store.getters.captions.builder.doc,
		capGen:s => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getDocColumnTitle
	}
};

export default {
	name:'my-builder-doc-columns',
	components:{MyBuilderDocColumn},
	template:`<div class="builder-doc-columns"
		@dragenter="dragEnter($event,columns.length-1)"
		@dragleave="dragLeave"
		@dragover="dragOver"
		@drop="drop"
	>
		<div class="builder-doc-bg-text">{{ capGen.columns }}</div>

		<my-builder-doc-column
			v-model="c"
			v-for="(c,i) in columns"
			@click.stop="$emit('setColumnIdOptions',c.id)"
			@dragenter="dragEnter($event,i)"
			@dragleave="dragLeave"
			@dragend.stop="dragEnd($event,c.id)"
			@dragstart.stop="dragStart($event,c)"
			:builderLanguage
			:elmOptions
			:isDragPreview="c.content === dragContent"
			:isDragSource="columnIdDragged === c.id"
			:isOptionsShow="columnIdOptions === c.id"
			:joins
			:joinsParent
			:style="getStyle(c)"
			:draggable="!readonly"
			:key="c.id"
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
		parentSizeX:    { type:Number,        required:true },
		readonly:       { type:Boolean,       required:true },
		sizeXMax:       { type:Number,        required:true },
		zoom:           { type:Number,        required:true }
	},
	data() {
		return {
			columnIdDragged:null,
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

		// stores
		capApp:     s => s.$store.getters.captions.builder.doc,
		capGen:     s => s.$store.getters.captions.generic,
		dragContent:s => s.$store.getters.constants.dragColumnContent
	},
	methods:{
		// externals
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