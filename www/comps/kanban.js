import MyInputCollection  from './inputCollection.js';
import MyForm             from './form.js';
import srcBase64Icon      from './shared/image.js';
import {getColumnBatches} from './shared/column.js';
import {getChoiceFilters} from './shared/form.js';
import {getCaption}       from './shared/language.js';
import {
	isAttributeBoolean,
	isAttributeFiles
} from './shared/attribute.js';
import {
	checkDataOptions,
	colorAdjustBg,
	colorMakeContrastFont
} from './shared/generic.js';
import {
	fillRelationRecordIds,
	getJoinIndexMap,
	getQueryExpressions,
	getRelationsJoined
} from './shared/query.js';
import {
	routeChangeFieldReload,
	routeParseParams
} from './shared/router.js';
export {MyKanban as default};

const MyKanbanCard = {
	name:'my-kanban-card',
	template:`<div class="kanban-card" :class="{ template:isTemplate }">
		<div class="kanban-card-header"
			v-if="!isTemplate"
			:class="{ dragAnchor:!isTemplate }"
			:style="headerStyle"
		></div>
		
		<div class="kanban-card-content"
			@click.ctrl.exact="$emit('click-middle')"
			@click.left.exact="$emit('click')"
			@click.middle.exact="$emit('click-middle')"
			:class="{ clickable:clickable, template:isTemplate }"
		>
			<span v-if="isTemplate">{{ capGen.button.new }}</span>
			
			<table v-if="!isTemplate">
				<tbody>
					<tr v-for="b in columnBatches">
						<td v-if="b.caption !== null" class="kanban-label">{{ b.caption }}</td>
						<td>
							<div class="columnBatch kanbanCards" :class="{ vertical:b.vertical }">
								<my-value-rich
									v-for="ind in b.columnIndexes.filter(v => values[v] !== null || columns[v].display === 'gallery')"
									@clipboard="$emit('clipboard')"
									:attributeId="columns[ind].attributeId"
									:basis="columns[ind].basis"
									:bold="columns[ind].flags.bold"
									:boolAtrIcon="columns[ind].flags.boolAtrIcon"
									:clipboard="columns[ind].flags.clipboard"
									:display="columns[ind].display"
									:italic="columns[ind].flags.italic"
									:key="ind"
									:length="columns[ind].length"
									:monospace="columns[ind].flags.monospace"
									:noShrink="columns[ind].flags.noShrink"
									:noThousandsSep="columns[ind].flags.noThousandsSep"
									:value="values[ind]"
									:wrap="columns[ind].flags.wrap"
								/>
							</div>
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>`,
	emits:['click','click-middle','clipboard'],
	props:{
		clickable:    { type:Boolean, required:true },
		columns:      { type:Array,   required:true },
		columnBatches:{ type:Array,   required:true },
		headerStyle:  { type:String,  required:true },
		isTemplate:   { type:Boolean, required:true },
		values:       { type:Array,   required:true }
	},
	computed:{
		capGen:(s) => s.$store.getters.captions.generic
	}
};

const MyKanbanBox = {
	name:'my-kanban-box',
	components:{ MyKanbanCard },
	template:`<draggable class="kanban-box" handle=".dragAnchor" group="cards" itemKey="id" animation="150" direction="vertical"
		@change="changed"
		@end="$emit('drag-active',false)"
		@start="$emit('drag-active',true)"
		:class="{ dragActive:dragActive, hasCreate:hasCreate }"
		:list="cardsShown"
	>
		<template #item="{element,index}">
			<my-kanban-card
				@click="click(element,false,false)"
				@click-middle="click(element,false,true)"
				@clipboard="$emit('clipboard')"
				:clickable="hasUpdate"
				:columns="columns"
				:columnBatches="columnBatches"
				:headerStyle="headerStyle"
				:isTemplate="false"
				:values="element.values"
			/>
		</template>
		<template #footer>
			<my-kanban-card
				v-if="hasCreate && !dragActive"
				@click="click(null,true,false)"
				@click-middle="click(null,true,true)"
				:clickable="hasCreate"
				:columns="columns"
				:columnBatches="columnBatches"
				:headerStyle="headerStyle"
				:isTemplate="true"
				:values="[]"
			/>
		</template>
	</draggable>`,
	emits:['card-create','cards-changed','clipboard','drag-active','open-form'],
	props:{
		cards:            { type:Array,   required:true },
		columns:          { type:Array,   required:true },
		columnBatches:    { type:Array,   required:true },
		columnIndexesData:{ type:Array,   required:true },
		dragActive:       { type:Boolean, required:true },
		hasCreate:        { type:Boolean, required:true },
		hasUpdate:        { type:Boolean, required:true },
		headerStyle:      { type:String,  required:false, default:'' },
		relationIndexData:{ type:Number,  required:true },
		search:           { type:String,  required:true }
	},
	computed:{
		cardsShown:(s) => {
			let cards = JSON.parse(JSON.stringify(s.cards));
			
			// filter cards by active search
			if(s.search !== '') {
				for(let i = 0, j = cards.length; i < j; i++) {
					let searchStr = '';
					
					for(const colIndex of s.columnIndexesData) {
						if(cards[i].values[colIndex] === null)
							continue;
						
						const atr = s.attributeIdMap[s.columns[colIndex].attributeId];
						
						if(!s.isAttributeFiles(atr.content) && !s.isAttributeBoolean(atr.content))
							searchStr += cards[i].values[colIndex];
					}
					if(!searchStr.toLowerCase().includes(s.search.toLowerCase())) {
						cards.splice(i,1);
						i--; j--;
					}
				}
			}
			return cards;
		},
		
		// stores
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap']
	},
	methods:{
		// external
		isAttributeBoolean,
		isAttributeFiles,
		
		changed(e) {
			let event = '';
			if     (typeof e.added   !== 'undefined') event = 'added';
			else if(typeof e.moved   !== 'undefined') event = 'moved';
			else if(typeof e.removed !== 'undefined') event = 'removed';
			else return;
			
			this.$emit('cards-changed',
				e[event].element.indexRecordIds[this.relationIndexData],
				event,
				JSON.parse(JSON.stringify(this.cardsShown))
			);
		},
		click(element,isTemplate,middleClick) {
			if(isTemplate  && !this.hasCreate) return;
			if(!isTemplate && !this.hasUpdate) return;
			
			if(isTemplate)
				return this.$emit('card-create',middleClick);
			
			return this.$emit('open-form',element,middleClick);
		}
	}
};

const MyKanban = {
	name:'my-kanban',
	components:{
		MyInputCollection,
		MyKanbanBox
	},
	template:`<div class="kanban" :class="{ isSingleField:isSingleField }">
		
		<!-- header -->
		<div class="top lower">
			<div class="area nowrap"></div>
			<div class="area nowrap">
				<img class="icon"
					v-if="iconId !== null"
					:src="srcBase64Icon(iconId)"
				/>
				<my-button image="search.png"
					v-if="!isMobile"
					@trigger="$emit('set-login-option','kanbanZoom',zoomDefault)"
					:active="zoom !== zoomDefault"
					:captionTitle="capGen.button.zoomReset"
					:naked="true"
				/>
				<input class="zoom-factor clickable" type="range" min="1" max="10"
					v-if="!isMobile"
					@change="$emit('set-login-option','kanbanZoom',parseInt($event.target.value))"
					:value="zoom"
				/>
			</div>
			<div class="area nowrap default-inputs">
				<my-button image="refresh.png"
					@trigger="get"
					:caption="capGen.refresh"
					:naked="true"
				/>
				<input class="short"
					v-model="searchInput"
					@keyup.enter="search = searchInput"
					:placeholder="capGen.threeDots"
				/>
				<my-input-collection class="selector"
					v-for="c in collections"
					@update:modelValue="$emit('set-collection-indexes',c.collectionId,$event)"
					:collectionId="c.collectionId"
					:columnIdDisplay="c.columnIdDisplay"
					:key="c.collectionId"
					:modelValue="collectionIdMapIndexes[c.collectionId]"
					:multiValue="c.flags.includes('multiValue')"
					:previewCount="isMobile ? 0 : 2"
				/>
				<select class="selector"
					v-if="hasChoices"
					@change="$emit('set-login-option','choiceId',$event.target.value)"
					:value="choiceId"
				>
					<option v-for="c in choices" :value="c.id">
						{{ getCaption('queryChoiceTitle',moduleId,c.id,c.captions,c.name) }}
					</option>
				</select>
				<my-button
					@trigger="$emit('set-login-option','kanbanShowCaptions',!showCaptions)"
					:caption="capGen.label"
					:image="showCaptions ? 'visible1.png' : 'visible0.png'"
				/>
			</div>
		</div>
		
		<!-- content -->
		<div class="kanban-wrap">
			<div class="kanban-content">
				<table class="kanban-table" :style="columnStyleVars">
					<thead>
						<!-- X axis labels -->
						<tr>
							<th class="kanban-table-label top-left" v-if="relationIndexAxisY !== null"></th>
							
							<!-- label for NULL assignment -->
							<th class="kanban-table-label" v-if="hasNullsInX">
								<div class="kanban-table-label-line unassigned">
									{{ capGen.unassigned }}
								</div>
							</th>
							
							<!-- labels for X assignment -->
							<th class="kanban-table-label" v-for="x in axisEntriesX"
								:class="{ clickable: hasCreate }"
								:style="x.style"
								@click.left="cardCreate(x.id,null,null)"
							>
								<div class="kanban-table-label-line">
									<my-value-rich
										v-for="v in x.values.filter(v => v.value !== null)"
										:attributeId="columns[v.columnIndex].attributeId"
										:basis="columns[v.columnIndex].basis"
										:bold="columns[v.columnIndex].flags.bold"
										:boolAtrIcon="columns[v.columnIndex].flags.boolAtrIcon"
										:display="columns[v.columnIndex].display"
										:italic="columns[v.columnIndex].flags.italic"
										:key="v.columnIndex"
										:length="columns[v.columnIndex].length"
										:monospace="columns[v.columnIndex].flags.monospace"
										:noShrink="columns[v.columnIndex].flags.noShrink"
										:noThousandsSep="columns[v.columnIndex].flags.noThousandsSep"
										:value="v.value"
										:wrap="columns[v.columnIndex].flags.wrap"
									/>
								</div>
							</th>
						</tr>
					</thead>
					<tbody v-if="dataReady">
						<!-- Y axis -->
						
						<!-- line for NULL Y assignment / or no Y axis at all -->
						<tr v-if="hasNullsInY || relationIndexAxisY === null">
							<td class="kanban-table-label" v-if="relationIndexAxisY !== null">
								<div class="kanban-table-label-line unassigned">
									{{ capGen.unassigned }}
								</div>
							</td>
							<td v-if="hasNullsInX">
								<my-kanban-box
									@clipboard="$emit('clipboard')"
									@card-create="cardCreate(null,null,$event)"
									@cards-changed="(...args) => set(null,null,args[0],args[1],args[2])"
									@drag-active="dragActive = $event"
									@open-form="openForm"
									:cards="recordIdMapAxisXY['null']['null']"
									:columns="columns"
									:columnBatches="columnBatches"
									:columnIndexesData="columnIndexesData"
									:dragActive="dragActive"
									:hasCreate="hasCreate"
									:hasUpdate="hasUpdate"
									:relationIndexData="relationIndexData"
									:search="search"
								/>
							</td>
							<td v-for="x in axisEntriesX">
								<my-kanban-box
									@clipboard="$emit('clipboard')"
									@card-create="cardCreate(x.id,null,$event)"
									@cards-changed="(...args) => set(x.id,null,args[0],args[1],args[2])"
									@drag-active="dragActive = $event"
									@open-form="openForm"
									:cards="recordIdMapAxisXY[x.id]['null']"
									:columns="columns"
									:columnBatches="columnBatches"
									:columnIndexesData="columnIndexesData"
									:dragActive="dragActive"
									:hasCreate="hasCreate"
									:hasUpdate="hasUpdate"
									:headerStyle="x.style"
									:relationIndexData="relationIndexData"
									:search="search"
								/>
							</td>
						</tr>
						
						<!-- lines for XY assignment -->
						<tr v-for="y in axisEntriesY">
							<!-- label for Y assignment -->
							<td class="kanban-table-label"
								:class="{ clickable: hasCreate }"
								:style="y.style"
								@click.left="cardCreate(null,y.id,null)"
							>
								<div class="kanban-table-label-line">
									<my-value-rich
										v-for="v in y.values.filter(v => v.value !== null)"
										:attributeId="columns[v.columnIndex].attributeId"
										:basis="columns[v.columnIndex].basis"
										:bold="columns[v.columnIndex].flags.bold"
										:boolAtrIcon="columns[v.columnIndex].flags.boolAtrIcon"
										:display="columns[v.columnIndex].display"
										:italic="columns[v.columnIndex].flags.italic"
										:key="v.columnIndex"
										:length="columns[v.columnIndex].length"
										:monospace="columns[v.columnIndex].flags.monospace"
										:noShrink="columns[v.columnIndex].flags.noShrink"
										:noThousandsSep="columns[v.columnIndex].flags.noThousandsSep"
										:value="v.value"
										:wrap="columns[v.columnIndex].flags.wrap"
									/>
								</div>
							</td>
							
							<!-- X axis NULL data field -->
							<td v-if="hasNullsInX">
								<my-kanban-box
									@clipboard="$emit('clipboard')"
									@card-create="cardCreate(null,y.id,$event)"
									@cards-changed="(...args) => set(null,y.id,args[0],args[1],args[2])"
									@drag-active="dragActive = $event"
									@open-form="openForm"
									:cards="recordIdMapAxisXY['null'][y.id]"
									:columns="columns"
									:columnBatches="columnBatches"
									:columnIndexesData="columnIndexesData"
									:dragActive="dragActive"
									:hasCreate="hasCreate"
									:hasUpdate="hasUpdate"
									:headerStyle="y.style"
									:relationIndexData="relationIndexData"
									:search="search"
								/>
							</td>
							
							<!-- X axis data fields -->
							<td v-for="x in axisEntriesX">
								<my-kanban-box
									@clipboard="$emit('clipboard')"
									@card-create="cardCreate(x.id,y.id,$event)"
									@cards-changed="(...args) => set(x.id,y.id,args[0],args[1],args[2])"
									@drag-active="dragActive = $event"
									@open-form="openForm"
									:cards="recordIdMapAxisXY[x.id][y.id]"
									:columns="columns"
									:columnBatches="columnBatches"
									:columnIndexesData="columnIndexesData"
									:dragActive="dragActive"
									:hasCreate="hasCreate"
									:hasUpdate="hasUpdate"
									:headerStyle="x.style !== '' ? x.style : y.style"
									:relationIndexData="relationIndexData"
									:search="search"
								/>
							</td>
						</tr>
					</tbody>
					<tfoot>
						<tr>
							<td class="kanban-table-label" v-if="relationIndexAxisY !== null"></td>
							<td class="kanban-table-label" v-if="hasNullsInX"></td>
							<td class="kanban-table-label" v-for="x in axisEntriesX"></td>
						</tr>
					</tfoot>
				</table>
			</div>
			
			<!-- inline form -->
			<my-form class="inline"
				v-if="popUpFormInline !== null"
				@close="$emit('close-inline')"
				@record-deleted="get"
				@record-updated="get"
				@records-open="popUpFormInline.recordIds = $event"
				:attributeIdMapDef="popUpFormInline.attributeIdMapDef"
				:formId="popUpFormInline.formId"
				:hasHelp="false"
				:hasLog="false"
				:isPopUp="true"
				:isPopUpFloating="false"
				:moduleId="popUpFormInline.moduleId"
				:recordIds="popUpFormInline.recordIds"
				:style="popUpFormInline.style"
			/>
		</div>
	</div>`,
	props:{
		attributeIdSort:    { required:true },
		choices:            { type:Array,   required:false, default:() => [] },
		columns:            { type:Array,   required:true }, // processed list columns
		collections:        { type:Array,   required:true },
		collectionIdMapIndexes:{ type:Object, required:false, default:() => {return {}} },
		dataOptions:        { type:Number,  required:false, default:0 },
		fieldId:            { type:String,  required:true },
		filters:            { type:Array,   required:true }, // processed query filters
		formLoading:        { type:Boolean, required:true }, // block GET while form is still loading (avoid redundant GET calls)
		hasOpenForm:        { type:Boolean, required:true },
		iconId:             { required:true },
		isHidden:           { type:Boolean, required:false, default:false },
		isSingleField:      { type:Boolean, required:false, default:false },
		loadWhileHidden:    { type:Boolean, required:false, default:false },
		loginOptions:       { type:Object,  required:true },
		moduleId:           { type:String,  required:true },
		popUpFormInline:    { required:false, default:null },
		query:              { type:Object,  required:true },
		relationIndexData:  { type:Number,  required:true },               // relation by index, serving as base for data (cards)
		relationIndexAxisX: { type:Number,  required:true },               // relation by index, serving as base for X axis (columns)
		relationIndexAxisY: { type:Number,  required:false, default:null } // relation by index, serving as base for Y axis (rows), multi-axis kanban
	},
	emits:['clipboard','close-inline','open-form','record-count-change','set-args','set-collection-indexes','set-login-option'],
	data() {
		return {
			axisEntriesX:[],      // entries for the X axis (columns)
			axisEntriesY:[],      // entries for the Y axis (rows)
			dragActive:false,
			recordIdMapAxisXY:[], // 2-level map of axis data (cards), keys: record ID of X axis entry, record ID of Y axis entry
			search:'',
			searchInput:'',
			zoomDefault:5
		};
	},
	computed:{
		columnIndexesData:(s) => {
			let out = [];
			for(let i = 0, j = s.columns.length; i < j; i++) {
				if(!s.columnIndexesAxisX.includes(i) && !s.columnIndexesAxisY.includes(i))
					out.push(i);
			}
			return out;
		},
		
		// simple
		attributeIdAxisX:  (s) => s.getAttributeIdFromAxisJoin(s.relationIndexData,s.relationIndexAxisX),
		attributeIdAxisY:  (s) => s.getAttributeIdFromAxisJoin(s.relationIndexData,s.relationIndexAxisY),
		choiceFilters:     (s) => s.getChoiceFilters(s.choices,s.choiceId),
		columnBatches:     (s) => s.getColumnBatches(s.moduleId,s.columns,s.columnIndexesAxisX.concat(s.columnIndexesAxisY),[],[],s.showCaptions),
		columnIndexesAxisX:(s) => s.getAxisColumnIndexes([]),
		columnIndexesAxisY:(s) => s.relationIndexAxisY === null ? [] : s.getAxisColumnIndexes(s.columnIndexesAxisX),
		columnStyleVars:   (s) => `--kanban-width-min:${s.columnWidthMin}px;--kanban-width-max:${s.columnWidthMax}px;`,
		columnWidthMin:    (s) => s.zoom * 40,
		columnWidthMax:    (s) => s.columnWidthMin * 1.5,
		dataReady:         (s) => typeof s.recordIdMapAxisXY.null !== 'undefined',
		expressions:       (s) => s.getQueryExpressions(s.columns),
		hasChoices:        (s) => s.choices.length > 1,
		hasCreate:         (s) => s.checkDataOptions(4,s.dataOptions) && s.query.joins.length !== 0 && s.query.joins[0].applyCreate && s.hasOpenForm,
		hasUpdate:         (s) => s.checkDataOptions(2,s.dataOptions) && s.query.joins.length !== 0 && s.query.joins[0].applyUpdate && s.hasOpenForm,
		hasNullsInX:       (s) => s.attributeIdMap[s.attributeIdAxisX].nullable,
		hasNullsInY:       (s) => s.attributeIdAxisY !== null && s.attributeIdMap[s.attributeIdAxisY].nullable,
		joins:             (s) => s.fillRelationRecordIds(s.query.joins),
		joinsIndexMap:     (s) => s.getJoinIndexMap(s.joins),

		// login options
		choiceId:    (s) => s.$root.getOrFallback(s.loginOptions,'choiceId',s.choices.length === 0 ? null : s.choices[0].id),
		showCaptions:(s) => s.$root.getOrFallback(s.loginOptions,'kanbanShowCaptions',false),
		zoom:        (s) => s.$root.getOrFallback(s.loginOptions,'kanbanZoom',s.zoomDefault),
		
		// stores
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		iconIdMap:     (s) => s.$store.getters['schema/iconIdMap'],
		isMobile:      (s) => s.$store.getters.isMobile,
		capApp:        (s) => s.$store.getters.captions.calendar,
		capGen:        (s) => s.$store.getters.captions.generic
	},
	beforeCreate() {
		// import at runtime due to circular dependencies
		this.$options.components.MyForm = MyForm;
	},
	mounted() {
		// setup watchers
		this.$watch('columns',(valOld,valNew) => {
			if(JSON.stringify(valOld) !== JSON.stringify(valNew)) {
				this.axisEntriesX      = [];
				this.axisEntriesY      = [];
				this.recordIdMapAxisXY = [];
				this.get();
			}
		});
		this.$watch('formLoading',v => {
			if(!v) this.get();
		});
		this.$watch('isHidden',v => {
			if(!v) this.$nextTick(() => this.get());
		});
		this.$watch(() => [this.choices,this.filters],(newVals, oldVals) => {
			for(let i = 0, j = newVals.length; i < j; i++) {
				if(JSON.stringify(newVals[i]) !== JSON.stringify(oldVals[i]))
					return this.get();
			}
		});
		this.get();
	},
	methods:{
		// external
		checkDataOptions,
		colorAdjustBg,
		colorMakeContrastFont,
		fillRelationRecordIds,
		getCaption,
		getChoiceFilters,
		getColumnBatches,
		getJoinIndexMap,
		getQueryExpressions,
		getRelationsJoined,
		routeChangeFieldReload,
		routeParseParams,
		srcBase64Icon,
		
		// actions
		cardCreate(recordIdX,recordIdY,middleClick) {
			if(!this.hasCreate)
				return;

			let attributes = [];
			if(recordIdX !== null) attributes.push(`${this.attributeIdAxisX}_${recordIdX}`);
			if(recordIdY !== null) attributes.push(`${this.attributeIdAxisY}_${recordIdY}`);
			
			const args = attributes.length === 0 ? [] : [`attributes=${attributes.join(',')}`];
			this.$emit('open-form',[],args,middleClick);
		},
		openForm(row,middleClick) {
			this.$emit('open-form',[row],[],middleClick);
		},
		
		// presentation
		displayColorColumn(color) {
			if(color === null) return '';
			
			let bg   = this.colorAdjustBg(color);
			let font = this.colorMakeContrastFont(bg);
			return `background-color:${bg};color:${font};`;
		},
		
		// processing
		getAttributeIdFromAxisJoin(relIndexData,relIndexAxis) {
			if(relIndexAxis === null || typeof this.joinsIndexMap[relIndexAxis] === undefined)
				return null;

			const joinAxis = this.joinsIndexMap[relIndexAxis];
			const joinData = this.joinsIndexMap[relIndexData];
			return joinAxis.indexFrom === joinData.index ? joinAxis.attributeId : joinData.attributeId;
		},
		getAxisColumnIndexes(columnIndexesIgnore) {
			let out = [];
			let batchIndexUsed = null;
			for(let i = 0, j = this.columns.length; i < j; i++) {
				if(columnIndexesIgnore.includes(i))
					continue;
				
				const c = this.columns[i];
				
				if(batchIndexUsed === null) {
					batchIndexUsed = c.batch;
					out.push(i);
					
					// if column is not part of a batch, use first column only
					if(batchIndexUsed === null)
						return out;
				}
				else if(c.batch === batchIndexUsed) {
					out.push(i);
				}
			}
			return out;
		},
		getAxisEntries(relationIndex,columnIndexes,rows) {
			if(relationIndex === null || columnIndexes.length === 0)
				return [];
			
			let recordIds         = [];
			let recordIdMapColors = {};
			let recordIdMapValues = {};
			let columnIndexColor  = -1;
			
			for(const columnIndex of columnIndexes) {
				const atr = this.attributeIdMap[this.columns[columnIndex].attributeId];
				if(atr.contentUse === 'color') {
					columnIndexColor = columnIndex;
					break;
				}
			}
			
			for(let r of rows) {
				const recordId = r.indexRecordIds[relationIndex];
				if(typeof recordId === 'undefined')
					return [];
				
				// store first occurrence of record only
				if(recordId === null || typeof recordIdMapValues[recordId] !== 'undefined')
					continue;
				
				let values = [];
				for(const columnIndex of columnIndexes) {
					if(columnIndex === columnIndexColor)
						continue;
					
					const column = this.columns[columnIndex];
					
					if(column.hidden || (this.isMobile && !column.onMobile))
						continue;
					
					values.push({
						columnIndex:columnIndex,
						value:r.values[columnIndex]
					});
				}
				recordIdMapColors[recordId] = columnIndexColor !== -1
					? r.values[columnIndexColor] : null;
				recordIdMapValues[recordId] = values;
				recordIds.push(recordId);
			}
			
			// add entries in order of appearance to keep sort order of results
			let out = [];
			for(let id of recordIds) {
				out.push({
					id:id,
					style:this.displayColorColumn(recordIdMapColors[id]),
					values:recordIdMapValues[id]
				});
			}
			return out;
		},
		
		// backend calls
		get() {
			if(this.formLoading || (this.isHidden && !this.loadWhileHidden))
				return;
			
			ws.send('data','get',{
				relationId:this.query.relationId,
				joins:this.getRelationsJoined(this.joins),
				expressions:this.expressions,
				filters:this.filters.concat(this.choiceFilters),
				orders:this.query.orders
			},true).then(
				res => {
					this.axisEntriesX = this.getAxisEntries(
						this.relationIndexAxisX,this.columnIndexesAxisX,res.payload.rows);
					this.axisEntriesY = this.getAxisEntries(
						this.relationIndexAxisY,this.columnIndexesAxisY,res.payload.rows);
					
					// prepare record ID map for both axis (X/Y)
					this.recordIdMapAxisXY = { null:{ null:[] } };
					for(const x of this.axisEntriesX) {
						this.recordIdMapAxisXY[x.id] = { null:[] };
					}
					for(const v in this.recordIdMapAxisXY) {
						for(const y of this.axisEntriesY) {
							this.recordIdMapAxisXY[v][y.id] = [];
						}
					}
					
					// stop if no rows or relation indexes for either axis is invalid
					if(res.payload.rows.length === 0 ||
						res.payload.rows[0].indexRecordIds[this.relationIndexAxisX] === 'undefined' ||
						(
							this.relationIndexAxisY !== null &&
							res.payload.rows[0].indexRecordIds[this.relationIndexAxisY] === 'undefined'
						)
					) {
						this.$emit('record-count-change',0);
						return;
					}
					
					// fill row values into prepared map
					let rowCount = 0;
					for(const r of res.payload.rows) {
						if(r.indexRecordIds[this.relationIndexData] === null)
							continue;
						
						const keyY = this.relationIndexAxisY === null
							? 'null' : r.indexRecordIds[this.relationIndexAxisY];
						
						this.recordIdMapAxisXY[r.indexRecordIds[this.relationIndexAxisX]][keyY].push(r);
						rowCount++;
					}
					this.$emit('record-count-change',rowCount);
				},
				this.$root.genericError
			);
		},
		set(recordIdX,recordIdY,recordIdData,event,newCards) {
			const relationIdCards = this.joinsIndexMap[this.relationIndexData].relationId;
			let requests = [];
			
			// update cards values
			this.recordIdMapAxisXY[recordIdX][recordIdY] = newCards;
			
			if(event === 'added') {
				// update card values if added to another kanban box
				let attributes = [{
					attributeId:this.attributeIdAxisX,
					attributeIdNm:null,
					outsideIn:false,
					value:recordIdX
				}];
				if(this.attributeIdAxisY !== null) {
					attributes.push({
						attributeId:this.attributeIdAxisY,
						attributeIdNm:null,
						outsideIn:false,
						value:recordIdY
					});
				}
				requests.push(ws.prepare('data','set',{'0':{
					relationId:relationIdCards,
					attributeId:null,
					indexFrom:-1,
					recordId:recordIdData,
					attributes:attributes
				}}));
			}
			
			if(this.attributeIdSort !== null && ['added','moved'].includes(event)) {
				// update card sort values within same kanban box
				for(let i = 0, j = this.recordIdMapAxisXY[recordIdX][recordIdY].length; i < j; i++) {
					const row = this.recordIdMapAxisXY[recordIdX][recordIdY][i];
					requests.push(ws.prepare('data','set',{'0':{
						relationId:relationIdCards,
						attributeId:null,
						indexFrom:-1,
						recordId:row.indexRecordIds[this.relationIndexData],
						attributes:[{
							attributeId:this.attributeIdSort,
							attributeIdNm:null,
							outsideIn:false,
							value:i
						}]
					}}));
				}
			}
			
			if(requests.length !== 0) {
				ws.sendMultiple(requests,true).then(
					() => {},
					this.$root.genericError
				);
			}
		}
	}
};