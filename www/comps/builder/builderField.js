import MyBuilderCaption       from './builderCaption.js';
import MyBuilderColumnOptions from './builderColumnOptions.js';
import MyBuilderFields        from './builderFields.js';
import MyBuilderFieldOptions  from './builderFieldOptions.js';
import MyBuilderQuery         from './builderQuery.js';
import {getTemplateQuery}     from '../shared/builderTemplate.js';
import {getColumnIcon}        from '../shared/column.js';
import {getFlexBasis}         from '../shared/form.js';
import {getJoinsIndexMap}     from '../shared/query.js';
import {
	MyBuilderColumns,
	MyBuilderColumnTemplates
} from './builderColumns.js';
import {
	getFieldHasQuery,
	getItemTitle,
	getItemTitleColumn,
	getSqlPreview
} from '../shared/builder.js';
import {
	isAttributeFiles,
	isAttributeRelationship
} from '../shared/attribute.js';
import {
	getFieldIcon,
	getFieldTitle
} from '../shared/field.js';

export default {
	name:'my-builder-field',
	components:{
		MyBuilderCaption,
		MyBuilderColumns,
		MyBuilderColumnOptions,
		MyBuilderColumnTemplates,
		MyBuilderFieldOptions,
		MyBuilderQuery
	},
	template:`<div class="builder-field"
		v-show="show"
		:class="cssClass"
		:key="field.id"
		:style="cssStyleParent"
	>
		<div class="builder-field-header" :class="{ dragAnchor:!moveActive && !noMovement && !readonly }">
			<!-- field icon -->
			<div class="builder-field-button"
				@click="openSettings('properties')"
				:class="{ clickable:!isTemplate && !moveActive, selected:isOptionsShow }"
				:title="capApp.fieldOptions"
			>
				<img :src="'images/' + getFieldIcon(field)" />
				<span>{{ reference }}</span>
			</div>
			
			<!-- warnings -->
			<img class="action warning clickable" src="images/warning.png"
				v-if="!isTemplate && !moveActive && warnings.length !== 0"
				@click="showWarnings"
				:title="capGen.warnings"
			/>
			
			<!-- container actions 1 -->
			<template v-if="!isTemplate && !moveActive && isContainer">
				<img class="action clickable"
					v-if="!readonly"
					@click="$emit('field-property-set','direction',toggleDir(field.direction))"
					@click.prevent.right="$emit('field-property-set','direction',toggleDir(field.direction))"
					:src="field.direction === 'row' ? 'images/flexRow.png' : 'images/flexColumn.png'"
					:title="capGen.direction+': '+field.direction"
				/>
				
				<img class="action clickable"
					v-if="field.fields.length > 1 && !readonly"
					@click="$emit('field-property-set','wrap',!field.wrap)"
					@click.prevent.right="$emit('field-property-set','wrap',!field.wrap)"
					:src="field.wrap ? 'images/wrap1.png' : 'images/wrap0.png'"
					:title="capApp.flexWrap+': '+field.wrap"
				/>
			</template>
			
			<!-- action: edit field content -->
			<img class="action clickable" src="images/database.png"
				v-if="!isTemplate && !moveActive && hasQuery"
				@click="openSettings('content')"
				:class="{ selected:isOptionsShow && tabTarget === 'content' }"
				:title="capApp.contentField"
			/>
			
			<!-- display: field is hidden -->
			<img class="action clickable" src="images/visible0.png"
				v-if="!isTemplate && !moveActive && field.state === 'hidden' && !readonly"
				@click="$emit('field-property-set','state','default')"
				:title="capApp.hidden"
			/>
			
			<!-- action: move this field -->
			<img class="action mover"
				v-if="!noMovement && (!moveActive || fieldMoveList[fieldMoveIndex].id === field.id || !isTemplate) && !readonly"
				@click="$emit('field-move',null,false)"
				:class="{ 'on-hover':!moveActive, selected:moveActive && fieldMoveList[fieldMoveIndex].id === field.id }"
				:src="!moveActive ? 'images/arrowRight.png' : 'images/arrowDown.png'"
				:title="!moveActive ? capApp.fieldMoveSource : capApp.fieldMoveTarget"
			/>
			
			<!-- action: move target inside container -->
			<img class="action clickable" src="images/arrowInside.png"
				v-if="!isTemplate && ['container','tabs'].includes(field.content) && moveActive && fieldMoveList[fieldMoveIndex].id !== field.id && !readonly"
				@click="$emit('field-move',parentChildren,true)"
				:title="capApp.fieldMoveInside"
			/>
			
			<!-- mouse over break out actions -->
			<div v-if="!isTemplate && !moveActive" class="break-out-wrap on-hover">
				<div class="break-out shade">
					
					<!-- toggle: show on mobile -->
					<img class="action clickable"
						v-if="!moveActive && !readonly"
						@click="$emit('field-property-set','onMobile',!field.onMobile)"
						:src="field.onMobile ? 'images/smartphone.png' : 'images/smartphoneOff.png'"
						:title="capApp.onMobile+': '+field.onMobile"
					/>
					
					<!-- container actions 2 -->
					<template v-if="!moveActive && isContainer">
						<div class="clickable"
							v-if="!readonly"
							@click="$emit('field-property-set','basis',toggleSize(field.basis,50,300))"
							@click.prevent.right="$emit('field-property-set','basis',toggleSize(field.basis,-50))"
							:title="capApp.flexSize"
						>
							<span>{{ getFlexBasis(field.basis) }}</span>
						</div>
						
						<div class="clickable"
							v-if="!readonly"
							@click="$emit('field-property-set','grow',toggleSize(field.grow,1,1))"
							@click.prevent.right="$emit('field-property-set','grow',toggleSize(field.grow,-1))"
							:title="capApp.flexSizeGrow"
						>
							<span>G{{ field.grow }}</span>
						</div>
						
						<div class="clickable"
							v-if="!readonly"
							@click="$emit('field-property-set','shrink',toggleSize(field.shrink,1,1))"
							@click.prevent.right="$emit('field-property-set','shrink',toggleSize(field.shrink,-1))"
							:title="capApp.flexSizeShrink"
						>
							<span>S{{ field.shrink }}</span>
						</div>
					</template>
					
					<!-- field title -->
					<my-builder-caption
						v-if="isButton || isChart || isData || isList || isTabs || isVariable || (isHeader && !field.richtext)"
						v-model="field.captions.fieldTitle"
						:contentName="title"
						:dynamicSize="true"
						:language="builderLanguage"
						:readonly
					/>
					
					<!-- action: remove field -->
					<img class="action on-hover end clickable" src="images/delete.png"
						v-if="!readonly"
						@click="$emit('field-remove',field.id)"
					/>
				</div>
			</div>
			
			<span class="title"
				v-if="isTemplate || !isContainer" :title="title"
				:class="{ 'no-hover':!isTemplate }"
			>{{ title }}</span>
		</div>
		
		<!-- tabs -->
		<div class="builder-tabs" v-if="!isTemplate && isTabs">
			<div class="entries">
				<div class="entry"
					v-for="(t,i) in field.tabs"
					@click="tabIndex = i"
					:class="{ active:tabIndexShown === i }"
				>
					T{{ typeof entityIdMapRef.tab[t.id] !== 'undefined' ? entityIdMapRef.tab[t.id] : '' }}
				</div>
			</div>
			<my-builder-fields class="fields-nested column"
				v-for="(t,i) in field.tabs.filter((v,i) => tabIndexShown === i )"
				@createNew="(...args) => $emit('createNew',...args)"
				@field-id-show="$emit('field-id-show',$event)"
				@field-remove="$emit('field-remove',$event)"
				@field-move-store="$emit('field-move-store',$event)"
				:builderLanguage
				:dataFields
				:elmOptions
				:entityIdMapRef
				:fieldIdMap
				:fieldIdShow
				:fieldMoveList
				:fieldMoveIndex
				:fields="t.fields"
				:flexDirParent="'column'"
				:formId="formId"
				:isTemplate="false"
				:joinsIndexMap
				:moduleId
				:readonly
				:uiScale
			/>
		</div>
		
		<!-- columns -->
		<my-builder-columns
			v-if="showColumns"
			@column-id-show="columnShowById"
			@columns-set="$emit('field-property-set','columns',$event)"
			:batchIndexTitle="columnBatchIndexTitle"
			:builderLanguage
			:columns="field.columns"
			:columnIdShow
			:groupName="field.id+'_columns'"
			:hasCaptions="isList || isKanban"
			:readonly
		/>
		
		<!-- nested fields in container -->
		<my-builder-fields class="fields-nested"
			v-if="!isTemplate && isContainer"
			@createNew="(...args) => $emit('createNew',...args)"
			@field-id-show="$emit('field-id-show',$event)"
			@field-remove="$emit('field-remove',$event)"
			@field-move-store="$emit('field-move-store',$event)"
			:builderLanguage
			:class="cssClassChildren"
			:dataFields
			:elmOptions
			:entityIdMapRef
			:fieldIdMap
			:fieldIdShow
			:fieldMoveList
			:fieldMoveIndex
			:fields="field.fields"
			:flexDirParent="field.direction"
			:formId
			:isTemplate
			:joinsIndexMap
			:moduleId
			:readonly
			:uiScale
		/>

		<teleport v-if="isOptionsShow" :to="elmOptions">
			<div class="top lower" :class="{ clickable:columnIdShow !== null }" @click="columnIdShow = null">
				<div class="area">
					<img class="icon" src="images/dash.png" />
					<img class="icon" :src="'images/' + getFieldIcon(field)" />
					<h2>{{ capGen.field + ': F' + entityIdMapRef.field[field.id] + ', ' + title }}</h2>
				</div>
				<div class="area">
					<my-button image="cancel.png"
						@trigger="$emit('field-id-show',null);columnIdShow = null"
						:blockBubble="true"
						:cancel="true"
						:captionTitle="capGen.button.close"
					/>
				</div>
			</div>
			<div class="top lower" v-if="columnShow !== false">
				<div class="area">
					<img class="icon" src="images/dash.png" />
					<img class="icon" :src="'images/' + getColumnIcon(columnShow)" />
					<h2>{{ capGen.column + ': ' + getItemTitleColumn(columnShow,false) }}</h2>
				</div>
				<div class="area">
					<my-button image="cancel.png"
						@trigger="columnIdShow = null"
						:cancel="true"
						:captionTitle="capGen.button.close"
					/>
				</div>
			</div>

			<!-- field properties -->
			<template v-if="columnIdShow === null">
				<my-tabs
					v-if="hasQuery"
					v-model="tabTarget"
					:entries="['properties','content']"
					:entriesIcon="['images/edit.png','images/database.png']"
					:entriesText="[capGen.properties,capGen.content]"
				/>
				<div class="content grow" :class="{ 'no-padding':tabTarget === 'properties' }">
					
					<!-- field options -->
					<my-builder-field-options
						v-if="tabTarget === 'properties'"
						@createNew="(...args) => $emit('createNew',...args)"
						@set="(...args) => $emit('field-property-set',args[0],args[1])"
						:builderLanguage
						:dataFields
						:entityIdMapRef
						:field
						:formId
						:joinsIndexMap
						:moduleId
						:readonly
					/>
					
					<!-- field query (relationship inputs, lists, calendars, charts, ...) -->
					<template v-if="hasQuery && tabTarget === 'content'">
						<my-builder-query
							@index-removed="queryRemoveIndex($event)"
							@update:modelValue="field.query = $event"
							:allowLookups="field.content === 'list' && field.csvImport"
							:allowOrders="true"
							:builderLanguage
							:entityIdMapRef
							:fieldIdMap
							:filtersDisable="['formState','getter','globalSearch']"
							:formId
							:modelValue="query"
							:moduleId
							:readonly
							:relationIdStart
						/>

						<!-- SQL preview -->
						<div class="row">
							<my-button image="code.png"
								@trigger="getSqlPreview(query,field.columns)"
								:caption="capGen.sqlPreview"
							/>
						</div>

						<br />
						<h2>{{ capGen.columnsAvailable }}</h2>
						<div class="columns shade">
							<my-builder-column-templates
								@column-add="columnAdd"
								:columns="field.columns"
								:groupName="'batches_' + field.id + '_columns'"
								:joins="query.joins"
								:readonly
							/>
						</div>
					</template>
				</div>
			</template>

			<!-- column properties -->
			<template v-if="columnShow !== false">
				<my-tabs
					v-if="columnShow.subQuery"
					v-model="tabTargetColumn"
					:entries="['properties','content']"
					:entriesIcon="['images/edit.png','images/database.png']"
					:entriesText="[capGen.properties,capGen.content]"
				/>
				<div class="content no-shrink" v-if="columnShow.subQuery && tabTargetColumn === 'content'">
					<my-builder-query
						@update:modelValue="columnShow.query = $event"
						:allowChoices="false"
						:allowOrders="true"
						:builderLanguage
						:entityIdMapRef
						:fieldIdMap
						:filtersDisable="['formState','getter','globalSearch']"
						:formId
						:joinsParents="[query.joins]"
						:modelValue="columnShowQuery"
						:moduleId
						:readonly
					/>
				</div>
				<my-builder-column-options
					v-if="!columnShow.subQuery || tabTargetColumn === 'properties'"
					@set="(...args) => columnPropertySet(args[0],args[1])"
					:builderLanguage
					:column="columnShow"
					:hasCaptions="field.content === 'list'"
					:moduleId
					:onlyData="false"
					:readonly
				/>
			</template>
		</teleport>
	</div>`,
	props:{
		builderLanguage:{ type:String,        required:true },
		dataFields:     { type:Array,         required:true },
		entityIdMapRef: { type:Object,        required:true },
		elmOptions:     { required:true },
		field:          { type:Object,        required:true },
		fieldIdMap:     { type:Object,        required:true },
		fieldIdShow:    { type:[String,null], required:true },
		fieldMoveList:  { type:[Array,null],  required:true },              
		fieldMoveIndex: { type:Number,        required:true },
		filterData:     { type:Boolean,       required:true },
		filterData1n:   { type:Boolean,       required:true },
		filterDataIndex:{ type:Number,        required:true },
		filterDataN1:   { type:Boolean,       required:true },
		filterDataNm:   { type:Boolean,       required:true },
		flexDirParent:  { type:String,        required:true },
		formId:         { type:String,        required:true },
		isTemplate:     { type:Boolean,       required:true },
		joinsIndexMap:  { type:Object,        required:true },
		moduleId:       { type:String,        required:true },
		noMovement:     { type:Boolean,       required:true },
		readonly:       { type:Boolean,       required:true },
		uiScale:        { type:Number,        required:true }
	},
	emits:['createNew','field-id-show','field-move','field-move-store','field-property-set','field-remove'],
	data() {
		return {
			columnIdShow:null,        // currently open column
			tabIndex:0,               // which tab index to show (tab fields)
			tabTarget:'content',      // sidebar tab target for column (content, properties)
			tabTargetColumn:'content' // sidebar tab target for field (content, properties)
		};
	},
	computed:{
		columnBatchIndexTitle:s => {
			if(s.isGantt) return [s.capApp.ganttBatch];
			if(s.isKanban) {
				const joinsIndexMap = s.getJoinsIndexMap(s.query.joins);
				const getCaption = function(relationIndex) {
					const j = joinsIndexMap[relationIndex];
					return `${relationIndex} ${s.relationIdMap[j.relationId].name}`;
				};
				
				let out = [];
				if(s.field.relationIndexAxisX !== null)
					out.push(s.capApp.kanban.columnBatchX.replace('{REL}',getCaption(s.field.relationIndexAxisX)));
				if(s.field.relationIndexAxisY !== null)
					out.push(s.capApp.kanban.columnBatchY.replace('{REL}',getCaption(s.field.relationIndexAxisY)));
				
				return out;
			}
			return [];
		},
		columnShow:s => {
			if(s.columnIdShow === null) return false;
			for(const c of s.field.columns) {
				if(c.id === s.columnIdShow)
					return c;
			}
			return false;
		},
		cssClass:s => {
			return {
				container:s.isContainer,
				isTemplate:s.isTemplate,
				notData:!s.isData,
				noGrow:s.flexDirParent === 'column' && (s.isHeader || s.isVariable || (
					s.isData && !s.isRelationship1N && !s.isRichtext && !s.isBarcode &&
					!s.isTextarea && !s.isDrawing && !s.isFiles && !s.isIframe)
				),
				selected:s.isOptionsShow,
				tabs:s.isTabs
			};
		},
		cssClassChildren:s => {
			if(s.isTemplate || !s.isContainer)
				return [];
			
			// default classed
			let out = [];
			if(s.field.fields.length === 0) out.push('empty');
			
			// draggable does not support styling the main element
			// use custom classes as fallback
			if(s.field.direction === 'column') out.push('column');
			if(s.field.wrap)                   out.push('wrap');
			
			out.push(`style-justify-content-${s.field.justifyContent}`);
			out.push(`style-align-content-${s.field.alignContent}`);
			out.push(`style-align-items-${s.field.alignItems}`);
			return out;
		},
		cssStyleParent:s => {
			if(typeof s.field.basis === 'undefined')
				return;
			
			let basis = s.field.basis;
			if(basis !== 0)
				basis = Math.floor(basis * s.uiScale / 100);
			
			let out = [`flex:${s.field.grow} ${s.field.shrink} ${s.getFlexBasis(basis)}`];
			if(basis !== 0) {
				let dirMax = s.flexDirParent === 'row' ? 'max-width' : 'max-height';
				let dirMin = s.flexDirParent === 'row' ? 'min-width' : 'min-height';
				out.push(`${dirMax}:${basis*s.field.perMax/100}px`);
				out.push(`${dirMin}:${basis*s.field.perMin/100}px`);
			}
			return out.join(';');
		},
		relationIdStart:s => {
			if(!s.isData) return null;
			
			if(!s.isAttributeRelationship(s.attribute.content))
				return null;
			
			if(s.field.attributeIdNm !== null)
				return s.attributeIdMap[s.field.attributeIdNm].relationshipId;
			
			if(s.joinsIndexMap[s.field.index].relationId === s.attribute.relationId)
				return s.attribute.relationshipId;
			
			return s.attribute.relationId;
		},
		show:s => {
			// filter only data fields
			if(!s.filterData || !s.isData) 
				return true;
			
			// filter by selected index (if set)
			if(s.filterDataIndex !== -1 && s.field.index !== s.filterDataIndex)
				return false;
			
			// filter by relationship type (show non-rel fields)
			if(!s.isRelationship)  return true;
			if(!s.field.outsideIn) return s.filterDataN1; 
			if(s.filterData1n && s.field.attributeIdNm === null) return true;
			if(s.filterDataNm && s.field.attributeIdNm !== null) return true;
			return false;
		},
		warnings:s => {
			let out = [];
			if(s.hasQuery) {
				if(s.query.relationId === null) out.push(s.capApp.warning.queryRelationNotSet);
				if(s.field.columns.length   === 0)    out.push(s.capApp.warning.queryColumnsNotSet);
				
				for(let c of s.field.columns) {
					if(c.subQuery && c.attributeId === null) {
						out.push(s.capApp.warning.columnNoSubQueryAttribute);
						break;
					}
				}
			}
			if(s.isCalendar) {
				if(s.field.attributeIdDate0 === null || s.field.attributeIdDate1 === null)
					out.push(s.capApp.warning.calendarNoDateFromTo);
			}
			return out;
		},
		
		// simple
		columnShowQuery: s => s.columnShow !== false && s.columnShow.subQuery && s.columnShow.query !== null ? s.columnShow.query : s.getTemplateQuery(),
		hasQuery:        s => s.getFieldHasQuery(s.field),
		isBarcode:       s => s.isData && s.attribute.contentUse === 'barcode',
		isButton:        s => s.field.content === 'button',
		isCalendar:      s => s.field.content === 'calendar',
		isChart:         s => s.field.content === 'chart',
		isContainer:     s => s.field.content === 'container',
		isData:          s => s.field.content === 'data',
		isDrawing:       s => s.isData && s.attribute.contentUse === 'drawing',
		isFiles:         s => s.isData && s.isAttributeFiles(s.attribute.content),
		isGantt:         s => s.isCalendar && s.field.gantt,
		isHeader:        s => s.field.content === 'header',
		isIframe:        s => s.isData && s.attribute.contentUse === 'iframe',
		isKanban:        s => s.field.content === 'kanban',
		isList:          s => s.field.content === 'list',
		isOptionsShow:   s => s.fieldIdShow === s.field.id,
		isRichtext:      s => s.isData && s.attribute.contentUse === 'richtext',
		isTabs:          s => s.field.content === 'tabs',
		isTextarea:      s => s.isData && s.attribute.contentUse === 'textarea',
		isRelationship:  s => s.isData && s.isAttributeRelationship(s.attribute.content),
		isRelationship1N:s => s.isRelationship && s.field.outsideIn === true && s.attribute.content === 'n:1',
		isVariable:      s => s.field.content === 'variable',
		moveActive:      s => s.fieldMoveList !== null,
		parentChildren:  s => s.isContainer ? s.field.fields : (s.isTabs ? s.field.tabs[s.tabIndex].fields : []),
		query:           s => s.hasQuery && s.field.query !== null ? s.field.query : s.getTemplateQuery(),
		reference:       s => s.isTemplate ? '' : 'F' + s.entityIdMapRef.field[s.field.id],
		showColumns:     s => !s.isTemplate && s.hasQuery && s.fieldIdShow === s.field.id && s.tabTarget === 'content',
		tabIndexShown:   s => s.isTabs && s.field.tabs.length > s.tabIndex ? s.tabIndex : 0,
		title:           s => s.getFieldTitle(s.field),
		
		// stores
		relationIdMap: s => s.$store.getters['schema/relationIdMap'],
		attributeIdMap:s => s.$store.getters['schema/attributeIdMap'],
		attribute:     s => !s.isData ? false : s.attributeIdMap[s.field.attributeId],
		capApp:        s => s.$store.getters.captions.builder.form,
		capGen:        s => s.$store.getters.captions.generic
	},
	beforeCreate() {
		// import at runtime due to circular dependencies
		this.$options.components.MyBuilderFields = MyBuilderFields;
	},
	methods:{
		// externals
		getColumnIcon,
		getFieldHasQuery,
		getFieldIcon,
		getFieldTitle,
		getFlexBasis,
		getItemTitle,
		getItemTitleColumn,
		getJoinsIndexMap,
		getSqlPreview,
		getTemplateQuery,
		isAttributeFiles,
		isAttributeRelationship,
		
		// actions
		columnAdd(column) {
			let colsCloned = JSON.parse(JSON.stringify(this.field.columns));
			colsCloned.push(column);
			this.$emit('field-property-set','columns',colsCloned);
		},
		columnPropertySet(name,value) {
			this.columnShow[name] = value;
		},
		columnShowById(id,tabTarget) {
			if(this.columnIdShow === id && this.tabTargetColumn === tabTarget)
				return this.columnIdShow = null;

			this.columnIdShow    = id;
			this.tabTargetColumn = tabTarget;
		},
		openSettings(tabTarget) {
			if(this.fieldIdShow === this.field.id && tabTarget !== this.tabTarget)
				return this.tabTarget = tabTarget;

			this.$emit('field-id-show',this.field.id);
			this.tabTarget = tabTarget;
		},
		queryRemoveIndex(index) {
			let colsCloned = JSON.parse(JSON.stringify(this.field.columns));
			for(let i = 0, j = colsCloned.length; i < j; i++) {
				if(!colsCloned[i].subQuery && colsCloned[i].index === index) {
					colsCloned.splice(i,1);
					i--; j--;
				}
			}
			this.$emit('field-property-set','columns',colsCloned);
		},
		showWarnings() {
			this.$store.commit('dialog',{
				captionBody:`<ul><li>${this.warnings.join('</li><li>')}</li></ul>`,
				captionTop:this.capGen.warnings,
				image:'warning.png'
			});
		},
		toggleDir(oldDir) {
			return oldDir === 'row' ? 'column' : 'row';
		},
		toggleSize(oldVal,change,startSize) {
			if(oldVal+change < 0) return 0;
			if(oldVal === 0)      return startSize;
			
			return oldVal+change;
		}
	}
};