import MyBuilderAggregatorInput       from './builderAggregatorInput.js';
import MyBuilderCaption               from './builderCaption.js';
import MyBuilderDocSets               from './builderDocSets.js';
import MyBuilderQuery                 from './builderQuery.js';
import MyInputDecimal                 from '../inputDecimal.js';
import MyInputRange                   from '../inputRange.js';
import myTabs                         from '../tabs.js';
import {getIndexAttributeIdsByJoins}  from '../shared/attribute.js';
import {getTemplateDocColumn}         from '../shared/builderTemplate.js';
import {getCaptionByIndexAttributeId} from '../shared/query.js';
import {
	getDocColumnIcon,
	getDocColumnTitle
} from '../shared/builderDoc.js';

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
	template:`<div class="builder-doc-column" :class="classCss" :title="isDragPreview ? '' : title">
		<div class="builder-doc-column-title" v-if="!isDragPreview">
			<img :src="'images/' + icon" />
			<span>{{ title }}</span>
		</div>
		
		<teleport v-if="isOptionsShow" :to="elmOptions">
			<div class="top lower">
				<div class="area">
					<img class="icon" src="images/dash.png" />
					<img class="icon" :src="'images/' + icon" />
					<h2>{{ titleBar }}</h2>
				</div>
				<div class="area">
					<my-button image="cancel.png"
						@trigger="$emit('close')"
						:cancel="true"
						:captionTitle="capGen.button.close"
					/>
				</div>
			</div>

			<my-tabs
				v-if="isWithQuery"
				v-model="tabTarget"
				:entries="['properties','content']"
				:entriesIcon="['images/edit.png','images/database.png']"
				:entriesText="[capGen.properties,capGen.content]"
			/>
			
			<template v-if="tabTarget === 'content'">
				<div class="content grow">
					<my-builder-query
						v-if="column.subQuery"
						v-model="column.query"
						:allowChoices="false"
						:allowOrders="true"
						:builderLanguage
						:filtersDisable
						:joinsParents="[joinsParent]"
						:moduleId
					/>
				</div>
				<br />
				<table class="generic-table-vertical default-inputs">
					<tbody>
						<tr><td colspan="2"><b>{{ capGen.dataRetrieval }}</b></td></tr>
						<tr>
							<td>{{ capGen.attribute }}</td>
							<td>
								<select
									@input="setIndexAttribute($event.target.value)"
									:value="column.attributeIndex+'_'+column.attributeId"
								>
									<option value="0_null">-</option>
									<option v-for="ia in indexAttributeIds" :value="ia">
										{{ getCaptionByIndexAttributeId(ia) }}
									</option>
								</select>
							</td>
						</tr>
					</tbody>
				</table>
			</template>

			<template v-if="tabTarget === 'properties' || !isWithQuery">
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
							<td>
								<my-input-decimal class="short" v-if="column.length !== 0" v-model="column.length" :min="0" :allowNull="false" :lengthFract="0" :readonly />
								<my-button v-else @trigger="column.length = 50" :caption="capGen.noLimit" :naked="true" />
							</td>
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
						<tr><td colspan="2"><b>{{ capGen.dataRetrieval }}</b></td></tr>
						<tr>
							<td>{{ capGen.aggregator }}</td>
							<td><my-builder-aggregator-input v-model="column.aggregator" :readonly /></td>
						</tr>
						<tr>
							<td>{{ capGen.options }}</td>
							<td>
								<div class="row gap centered">
									<my-button-check v-model="column.distincted" :caption="capGen.distincted" :readonly />
									<my-button-check v-model="column.groupBy"    :caption="capGen.groupBy"    :readonly />
								</div>
							</td>
						</tr>
						<tr>
							<td>{{ capGen.resultRow }}</td>
							<td><my-builder-aggregator-input v-model="column.aggregatorRow" :itemsFilter="['record','list','array']" :readonly /></td>
						</tr>
					</tbody>
				</table>
				
				<div class="content grow">
					<div class="builder-doc-sub-settings">
						<my-tabs
							v-model="tabTargetArea"
							:entries="tabTargetAreaList.entries"
							:entriesText="tabTargetAreaList.labels"
						/>
						<my-builder-doc-sets
							v-if="tabTargetArea === 'body'"
							v-model="column.setsBody"
							:allowData="true"
							:allowValue="true"
							:joins
							:readonly
							:showFont="true"
						/>
						<my-builder-doc-sets
							v-if="tabTargetArea === 'header'"
							v-model="column.setsHeader"
							:allowData="true"
							:allowValue="true"
							:joins
							:readonly
							:showFont="true"
						/>
						<my-builder-doc-sets
							v-if="tabTargetArea === 'footer'"
							v-model="column.setsFooter"
							:allowData="true"
							:allowValue="true"
							:joins
							:readonly
							:showFont="true"
						/>
					</div>
				</div>
			</template>
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
		moduleId:       { type:String,  required:true },
		readonly:       { type:Boolean, required:true },
		sizeXMax:       { type:Number,  required:true }
	},
	emits:['close','update:modelValue'],
	data() {
		return {
			filtersDisable:[
				'collection','field','fieldChanged','fieldValid','formChanged',
				'formState','getter','globalSearch','javascript','recordMayCreate',
				'recordMayDelete','recordMayUpdate','recordNew','variable'
			],
			tabTarget:'properties',
			tabTargetArea:'body'
		};
	},
	computed:{
		classCss:s => {
			return { dragPreview:s.isDragPreview, dragSource:s.isDragSource, selected:s.isOptionsShow };
		},
		tabTargetAreaList:s => {
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
		icon:             s => s.getDocColumnIcon(s.column),
		isWithQuery:      s => s.column.subQuery,
		indexAttributeIds:s => !s.column.subQuery ? [] : s.getIndexAttributeIdsByJoins(s.column.query.joins,[]),
		title:            s => s.getDocColumnTitle(s.column),
		titleBar:         s => `${s.capGen.column}: ${s.title}`,

		// stores
		capApp:s => s.$store.getters.captions.builder.doc,
		capGen:s => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getCaptionByIndexAttributeId,
		getIndexAttributeIdsByJoins,
		getDocColumnIcon,
		getDocColumnTitle,

		// actions
		setIndexAttribute(indexAttributeId) {
			const p = indexAttributeId.split('_');
			if(p[1] === 'null') {
				this.column.attributeId    = null;
				this.column.attributeIndex = null;
			} else {
				this.column.attributeId    = p[1];
				this.column.attributeIndex = parseInt(p[0]);
			}
		}
	}
};

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
		moduleId:       { type:String,  required:true },
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