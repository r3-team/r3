import MyCalendar                 from './calendar.js';
import MyChart                    from './chart.js';
import MyGantt                    from './gantt.js';
import MyKanban                   from './kanban.js';
import MyInputDate                from './inputDate.js';
import MyInputDrawing             from './inputDrawing.js';
import MyInputFiles               from './inputFiles.js';
import MyInputIframe              from './inputIframe.js';
import MyInputLogin               from './inputLogin.js';
import MyInputRichtext            from './inputRichtext.js';
import MyInputSelect              from './inputSelect.js';
import MyInputUuid                from './inputUuid.js';
import MyList                     from './list.js';
import {hasAccessToAttribute}     from './shared/access.js';
import {getColumnsProcessed}      from './shared/column.js';
import {srcBase64}                from './shared/image.js';
import {getCaption}               from './shared/language.js';
import {getQueryFiltersProcessed} from './shared/query.js';
import {
	getLinkMeta,
	getNilUuid,
	openLink
} from './shared/generic.js';
import {
	fieldOptionGet,
	fieldOptionSet
} from './shared/field.js';
import {
	getFlexStyle,
	getFormPopUpConfig,
	setGetterArgs
} from './shared/form.js';
import {
	getIndexAttributeId,
	isAttributeBoolean,
	isAttributeDecimal,
	isAttributeFiles,
	isAttributeInteger,
	isAttributeRelationship,
	isAttributeRegconfig,
	isAttributeString,
	isAttributeUuid
} from './shared/attribute.js';
export {MyField as default};

let MyField = {
	name:'my-field',
	components:{
		'chrome-picker':VueColor.Chrome,
		MyCalendar,
		MyChart,
		MyGantt,
		MyKanban,
		MyInputDate,
		MyInputDrawing,
		MyInputFiles,
		MyInputIframe,
		MyInputLogin,
		MyInputRichtext,
		MyInputSelect,
		MyInputUuid,
		MyList
	},
	template:`<div class="field"
		v-if="isActive"
		:class="domClass"
		:data-field-id="field.id"
		:data-field-is-valid="isValid ? '1' : '0'"
		:style="domStyle"
	>
		<template v-if="isData || isList || isTabs || isCalendar || isKanban || isChart">
			
			<div class="field-caption"
				v-if="hasCaption"
				:class="{ invalid:showInvalid }"
			>
				<img src="images/lock.png" v-if="isEncrypted" :title="capApp.dialog.encrypted" />
				<span>{{ caption }}</span>
			</div>
			
			<div class="field-content"
				:class="{ data:isData, disabled:isReadonly, isSingleField:isAlone, intent:hasIntent }"
		 		v-click-outside="clickOutside"
			>
				<!-- data field icon -->
				<div class="field-icon" v-if="iconId && isData && !isRelationship && !isDrawing && !isFiles && !isRichtext && !isTextarea">
					<img :src="srcBase64(iconIdMap[iconId].file)" />
				</div>
				
				<!-- calendar -->
				<my-calendar
					v-if="isCalendar && !field.gantt"
					@clipboard="$emit('clipboard')"
					@close-inline="closeInline"
					@open-form="(...args) => openForm(args[0],args[1],args[2],null)"
					@record-count-change="$emit('set-counter',field.id,$event)"
					@set-args="(...args) => $emit('set-form-args',...args)"
					@set-collection-indexes="setCollectionIndexes"
					:attributeIdColor="field.attributeIdColor"
					:attributeIdDate0="field.attributeIdDate0"
					:attributeIdDate1="field.attributeIdDate1"
					:choices="choicesProcessed"
					:columns="columnsProcessed"
					:collections="field.collections"
					:collectionIdMapIndexes="collectionIdMapIndexes"
					:daysShowDef="field.days"
					:daysShowToggle="field.daysToggle"
					:fieldId="field.id"
					:filters="filtersProcessed"
					:formLoading="formLoading"
					:hasOpenForm="field.openForm !== null"
					:iconId="iconId ? iconId : null"
					:ics="field.ics"
					:indexColor="field.indexColor"
					:indexDate0="field.indexDate0"
					:indexDate1="field.indexDate1"
					:isHidden="isHidden"
					:isSingleField="isAlone"
					:loadWhileHidden="parentIsCounting"
					:moduleId="moduleId"
					:popUpFormInline="popUpFormInline"
					:query="field.query"
					:usesPageHistory="isAloneInForm && !formIsEmbedded"
				/>
				
				<!-- gantt -->
				<my-gantt
					v-if="isCalendar && field.gantt"
					@close-inline="closeInline"
					@open-form="(...args) => openForm(args[0],args[1],args[2],null)"
					@set-args="(...args) => $emit('set-form-args',...args)"
					@set-collection-indexes="setCollectionIndexes"
					:attributeIdColor="field.attributeIdColor"
					:attributeIdDate0="field.attributeIdDate0"
					:attributeIdDate1="field.attributeIdDate1"
					:choices="choicesProcessed"
					:columns="columnsProcessed"
					:collections="field.collections"
					:collectionIdMapIndexes="collectionIdMapIndexes"
					:fieldId="field.id"
					:days0="field.dateRange0 / 86400"
					:days1="field.dateRange1 / 86400"
					:filters="filtersProcessed"
					:formLoading="formLoading"
					:hasOpenForm="field.openForm !== null"
					:iconId="iconId ? iconId : null"
					:indexColor="field.indexColor"
					:indexDate0="field.indexDate0"
					:indexDate1="field.indexDate1"
					:isHidden="isHidden"
					:isSingleField="isAlone"
					:moduleId="moduleId"
					:popUpFormInline="popUpFormInline"
					:stepTypeDefault="field.ganttSteps"
					:stepTypeToggle="field.ganttStepsToggle"
					:query="field.query"
					:usesPageHistory="isAloneInForm && !formIsEmbedded"
				/>
				
				<!-- kanban -->
				<my-kanban
					v-if="isKanban"
					@clipboard="$emit('clipboard')"
					@close-inline="closeInline"
					@open-form="(...args) => openForm(args[0],args[1],args[2],null)"
					@record-count-change="$emit('set-counter',field.id,$event)"
					@set-args="(...args) => $emit('set-form-args',...args)"
					@set-collection-indexes="setCollectionIndexes"
					:attributeIdSort="field.attributeIdSort"
					:choices="choicesProcessed"
					:columns="columnsProcessed"
					:collections="field.collections"
					:collectionIdMapIndexes="collectionIdMapIndexes"
					:fieldId="field.id"
					:filters="filtersProcessed"
					:formLoading="formLoading"
					:hasOpenForm="field.openForm !== null"
					:iconId="iconId ? iconId : null"
					:isHidden="isHidden"
					:isSingleField="isAlone"
					:loadWhileHidden="parentIsCounting"
					:moduleId="moduleId"
					:popUpFormInline="popUpFormInline"
					:relationIndexData="field.relationIndexData"
					:relationIndexAxisX="field.relationIndexAxisX"
					:relationIndexAxisY="field.relationIndexAxisY"
					:query="field.query"
					:usesPageHistory="isAloneInForm && !formIsEmbedded"
				/>
				
				<!-- chart -->
				<my-chart
					v-if="isChart"
					:choices="choicesProcessed"
					:columns="columnsProcessed"
					:filters="filtersProcessed"
					:formLoading="formLoading"
					:isHidden="isHidden"
					:limit="field.query.fixedLimit"
					:moduleId="moduleId"
					:needsHeader="isAlone"
					:optionJson="field.chartOption"
					:optionOverwrite="fieldIdMapOverwrite.chart[field.id]"
					:query="field.query"
				/>
				
				<!-- list -->
				<my-list
					v-if="isList"
					@clipboard="$emit('clipboard')"
					@close-inline="closeInline"
					@open-form="(...args) => openForm(args[0],[],args[1],null)"
					@open-form-bulk="(...args) => openForm(args[0],[],args[1],'bulk')"
					@record-count-change="$emit('set-counter',field.id,$event)"
					@set-args="(...args) => $emit('set-form-args',...args)"
					@set-column-ids-by-user="setColumnIdsByUser"
					@set-collection-indexes="setCollectionIndexes"
					:autoRenew="field.autoRenew"
					:caption="isAlone ? caption : ''"
					:choices="choicesProcessed"
					:collections="field.collections"
					:collectionIdMapIndexes="collectionIdMapIndexes"
					:columns="columnsProcessed"
					:columnsAll="field.columns"
					:csvExport="field.csvExport"
					:csvImport="field.csvImport"
					:fieldId="field.id"
					:filterQuick="field.filterQuick"
					:filters="filtersProcessed"
					:formLoading="formLoading"
					:hasOpenForm="field.openForm !== null"
					:hasOpenFormBulk="field.openFormBulk !== null"
					:isHidden="isHidden"
					:isSingleField="isAlone"
					:layoutDefault="field.layout"
					:limitDefault="field.query.fixedLimit === 0 ? field.resultLimit : field.query.fixedLimit"
					:loadWhileHidden="parentIsCounting"
					:moduleId="moduleId"
					:popUpFormInline="popUpFormInline"
					:query="field.query"
					:usesPageHistory="isAloneInForm && !formIsEmbedded"
				>
					<template #input-icon>
						<div class="field-icon" v-if="iconId">
							<img :src="srcBase64(iconIdMap[iconId].file)" />
						</div>
					</template>
				</my-list>
				
				<!-- tabs -->
				<div class="tabs" v-if="isTabs" :class="{ isSingleField:isAlone }">
					<div class="tabs-entries">
						<div class="tabs-icon" v-if="iconId">
							<img :src="srcBase64(iconIdMap[iconId].file)" />
						</div>
						<div class="tabs-entry clickable"
							v-if="!isMobile"
							v-for="(t,i) in field.tabs"
							v-show="!tabIndexesHidden.includes(i)"
							@click="setTab(i)"
							:class="getTabClasses(i)"
						>
							{{ tabIndexesTitle[i] }}
						</div>
						<select v-if="isMobile" @change="setTab(parseInt($event.target.value))" :value="tabIndexShow">
							<template v-for="(t,i) in field.tabs">
								<option v-if="!tabIndexesHidden.includes(i)" :value="i">
									{{ tabIndexesTitle[i] }}
								</option>
							</template>
						</select>
					</div>
					<div class="fields"
						v-for="(t,i) in field.tabs"
						v-show="i === tabIndexShow"
						:class="{ onlyOne:t.fields.length === 1 && t.fields[0].content !== 'container' }"
					>
						<!-- tab children -->
						<my-field flexDirParent="column" :ref="'tabField_'+f.id"
							v-for="f in t.fields"
							@clipboard="$emit('clipboard')"
							@execute-function="$emit('execute-function',$event)"
							@hotkey="$emit('hotkey',$event)"
							@open-form="(...args) => $emit('open-form',...args)"
							@set-counter="(...args) => setTabCounter(i,args[0],args[1])"
							@set-form-args="(...args) => $emit('set-form-args',...args)"
							@set-touched="(...args) => $emit('set-touched',...args)"
							@set-valid="(...args) => $emit('set-valid',...args)"
							@set-value="(...args) => $emit('set-value',...args)"
							@set-value-init="(...args) => $emit('set-value-init',...args)"
							:dataFieldMap="dataFieldMap"
							:entityIdMapState="entityIdMapState"
							:field="f"
							:fieldIdsChanged="fieldIdsChanged"
							:fieldIdsInvalid="fieldIdsInvalid"
							:fieldIdMapOverwrite="fieldIdMapOverwrite"
							:formBadSave="formBadSave"
							:formIsEmbedded="formIsEmbedded"
							:formLoading="formLoading"
							:formReadonly="formReadonly"
							:isAloneInTab="t.fields.length === 1"
							:isAloneInForm="false"
							:isBulkUpdate="isBulkUpdate"
							:joinsIndexMap="joinsIndexMap"
							:key="f.id"
							:moduleId="moduleId"
							:parentIsCounting="t.contentCounter"
							:parentIsHidden="isHidden || i !== tabIndexShow"
							:values="values"
							:variableIdMapLocal="variableIdMapLocal"
						/>
					</div>
				</div>
				
				<!-- regular text line input (numeric, strings, etc.) -->
				<input class="input" data-is-input="1"
					v-if="isLineInput"
					v-model="value"
					@click="click"
					:class="{ invalid:showInvalid }"
					:disabled="isReadonly"
					:placeholder="capGen.threeDots"
					:type="lineInputType"
				/>
				
				<!-- iframe input -->
				<my-input-iframe
					v-if="isIframe"
					v-model="value"
					@copyToClipboard="copyToClipboard"
					:clipboard="isClipboard"
					:formLoading="formLoading"
					:isHidden="isHidden"
					:readonly="isReadonly"
				/>
				
				<!-- UUID input -->
				<my-input-uuid
					v-if="isUuid"
					v-model="value"
					:readonly="isReadonly"
				/>
				
				<!-- regconfig input -->
				<my-input-select
					v-if="isRegconfig"
					@updated-text-input="regconfigInput = $event"
					@update:selected="value = $event;regconfigInput = ''"
					:inputTextSet="value"
					:nakedIcons="true"
					:options="regconfigOptions"
					:placeholder="capGen.threeDots"
					:selected="value"
				/>
				
				<!-- password show action -->
				<my-button
					v-if="isPassword"
					@trigger="showPassword = !showPassword"
					:image="showPassword ? 'visible0.png' : 'visible1.png'"
					:naked="true"
				/>
				
				<!-- link open action -->
				<my-button
					v-if="link !== false"
					@trigger="openLink(link.href,link.blank)"
					:active="value !== null"
					:image="link.image"
					:naked="true"
				/>
				
				<!-- color input -->
				<div class="color-input" v-if="isColor">
					<input class="input" data-is-input="1" type="text"
						v-model="value"
						:class="{ invalid:showInvalid }"
						:disabled="isReadonly"
					/>
					
					<!-- preview -->
					<div class="preview"
						@click="click"
						:class="{ clickable:!isReadonly }"
						:style="value !== null ? 'background-color:#'+value : ''"
					></div>
				</div>
				<div class="input-dropdown-wrap" v-if="showColorPickerInput">
					<chrome-picker class="input-dropdown"
						@update:modelValue="value = $event.hex.substr(1)"
						:disable-alpha="true"
						:disable-fields="true"
						:modelValue="value !== null ? value : '000000'"
					/>
				</div>
				
				<!-- textarea input -->
				<textarea class="input textarea" data-is-input="1"
					v-if="isTextarea"
					v-model="value"
					@click="click"
					:class="{ invalid:showInvalid }"
					:disabled="isReadonly"
				></textarea>
				
				<!-- richtext input -->
				<my-input-richtext
					v-if="isRichtext"
					v-model="value"
					@hotkey="$emit('hotkey',$event)"
					:attributeIdFile="field.attributeIdAlt"
					:readonly="isReadonly"
					:valueFiles="valueAlt"
				/>
				
				<!-- slider input -->
				<div class="slider-input" v-if="isSlider">
					<input class="range" type="range"
						v-model="value"
						:disabled="isReadonly"
						:min="field.min"
						:max="field.max"
					/>
					<input class="value" data-is-input="1"
						v-model="value"
						:disabled="isReadonly"
					/>
				</div>
				
				<!-- login input -->
				<my-input-login
					v-if="isLogin"
					v-model="value"
					:readonly="isReadonly"
					:placeholder="capGen.threeDots"
				/>
				
				<!-- date / datetime / time input -->
				<my-input-date
					v-if="isDateInput"
					@set-unix-from="value = $event"
					@set-unix-to="valueAlt = $event"
					:isDate="isDatetime || isDate"
					:isTime="isDatetime || isTime"
					:isRange="isDateRange"
					:isReadonly="isReadonly"
					:unixFrom="value"
					:unixTo="valueAlt"
				/>
				
				<!-- drawing input -->
				<my-input-drawing
					v-if="isDrawing"
					v-model="value"
					:formLoading="formLoading"
					:isHidden="isHidden"
					:readonly="isReadonly"
				>
					<template #input-icon>
						<div class="field-icon" v-if="iconId">
							<img :src="srcBase64(iconIdMap[iconId].file)" />
						</div>
					</template>
				</my-input-drawing>
				
				<!-- boolean input -->
				<my-bool
					v-if="isBoolean"
					v-model="value"
					:readonly="isReadonly"
				/>
				
				<!-- files input -->
				<my-input-files
					v-if="isFiles"
					v-model="value"
					@file-count-change="$emit('set-counter',field.id,$event)"
					:attributeId="field.attributeId"
					:countAllowed="field.max !== null ? field.max : 0"
					:fieldId="field.id"
					:formLoading="formLoading"
					:isHidden="isHidden"
					:readonly="isReadonly"
					:recordId="joinsIndexMap[field.index].recordId"
					:showGallery="field.display === 'gallery'"
				>
					<template #input-icon>
						<div class="field-icon" v-if="iconId">
							<img :src="srcBase64(iconIdMap[iconId].file)" />
						</div>
					</template>
				</my-input-files>
				
				<!-- relationship input -->
				<my-list
					v-if="isRelationship"
					@open-form="(...args) => openForm(args[0],[],args[1],null)"
					@records-selected="relationshipRecordsSelected"
					@record-removed="relationshipRecordRemoved"
					@records-selected-init="$emit('set-value-init',fieldAttributeId,$event,true,true)"
					:choices="choicesProcessed"
					:columns="columnsProcessed"
					:fieldId="field.id"
					:filterQuick="field.filterQuick"
					:filters="filtersProcessed"
					:formLoading="formLoading"
					:hasOpenForm="!isVariable && field.openForm !== null"
					:header="false"
					:inputAsCategory="field.category"
					:inputAutoSelect="field.autoSelect"
					:inputIsNew="isNew"
					:inputIsReadonly="isReadonly"
					:inputMulti="isRelationship1N"
					:inputRecordIds="relationshipRecordIds"
					:inputValid="!showInvalid"
					:isInput="true"
					:moduleId="moduleId"
					:query="field.query"
				>
					<template #input-icon>
						<div class="field-icon inList" v-if="iconId">
							<img :src="srcBase64(iconIdMap[iconId].file)" />
						</div>
					</template>
				</my-list>
				
				<!-- copy to clipboard action -->
				<my-button image="copyClipboard.png"
					v-if="isClipboard && !isFiles && !isIframe"
					@trigger="copyToClipboard"
					:active="value !== null"
					:captionTitle="capGen.button.copyClipboard"
					:naked="true"
				/>
			</div>
			
			<!-- helper text -->
			<div class="captionSub" v-if="captionHelp !== '' && captionError === ''">
				{{ captionHelp }}
			</div>
			
			<!-- bulk notice -->
			<div class="captionSub" v-if="isBulkUpdate && !notTouched">
				{{ capApp.bulkTouched }}
			</div>
			
			<!-- error text -->
			<div class="captionSub invalid" v-if="captionError !== ''">
				{{ captionError }}
			</div>
		</template>
		
		<!-- button -->
		<my-button
			v-if="isButton"
			@trigger="triggerButton(false)"
			@trigger-middle="triggerButton(true)"
			:active="!isReadonly"
			:caption="caption"
			:imageBase64="iconId ? srcBase64(iconIdMap[iconId].file) : ''"
		/>
		
		<!-- header -->
		<div class="header-label" v-if="isHeader">
			<div class="heading"
				v-if="!field.richtext"
				:class="'size'+field.size"
			>
				<img v-if="iconId" :src="srcBase64(iconIdMap[iconId].file)" />
				{{ caption }}
			</div>
			<div class="richtext" v-if="field.richtext" v-html="caption" />
		</div>
		
		<!-- container children -->
		<my-field
			v-if="isContainer"
			v-for="f in field.fields"
			@clipboard="$emit('clipboard')"
			@execute-function="$emit('execute-function',$event)"
			@hotkey="$emit('hotkey',$event)"
			@open-form="(...args) => $emit('open-form',...args)"
			@set-counter="(...args) => $emit('set-counter',...args)"
			@set-form-args="(...args) => $emit('set-form-args',...args)"
			@set-touched="(...args) => $emit('set-touched',...args)"
			@set-valid="(...args) => $emit('set-valid',...args)"
			@set-value="(...args) => $emit('set-value',...args)"
			@set-value-init="(...args) => $emit('set-value-init',...args)"
			:isBulkUpdate="isBulkUpdate"
			:dataFieldMap="dataFieldMap"
			:entityIdMapState="entityIdMapState"
			:field="f"
			:fieldIdsChanged="fieldIdsChanged"
			:fieldIdsInvalid="fieldIdsInvalid"
			:fieldIdMapOverwrite="fieldIdMapOverwrite"
			:formBadSave="formBadSave"
			:formIsEmbedded="formIsEmbedded"
			:formLoading="formLoading"
			:formReadonly="formReadonly"
			:flexDirParent="field.direction"
			:isAloneInForm="isAloneInForm"
			:joinsIndexMap="joinsIndexMap"
			:key="f.id"
			:moduleId="moduleId"
			:parentIsCounting="parentIsCounting"
			:parentIsHidden="isHidden"
			:values="values"
			:variableIdMapLocal="variableIdMapLocal"
		/>
	</div>`,
	props:{
		dataFieldMap:       { type:Object,  required:true },
		entityIdMapState:   { type:Object,  required:false, default:() => {return {}} }, // overwritten states
		field:              { type:Object,  required:true },
		fieldIdsChanged:    { type:Array,   required:false, default:() => {return []} },
		fieldIdsInvalid:    { type:Array,   required:false, default:() => {return []} },
		fieldIdMapOverwrite:{ type:Object,  required:true },
		formBadSave:        { type:Boolean, required:true },                 // attempted save with invalid inputs
		formIsEmbedded:     { type:Boolean, required:true },                 // parent form is embedded (pop-up, inline, widget)
		formLoading:        { type:Boolean, required:true },
		formReadonly:       { type:Boolean, required:true },                 // form is read only
		flexDirParent:      { type:String,  required:true },                 // flex direction (row/column) of parent
		isAloneInForm:      { type:Boolean, required:true },                 // parent form contains only this field
		isAloneInTab:       { type:Boolean, required:false, default:false }, // parent tab only contains this field
		isBulkUpdate:       { type:Boolean, required:false, default:false }, // form is in bulk update mode
		joinsIndexMap:      { type:Object,  required:true },
		logViewer:          { type:Boolean, required:false, default:false }, // is part of log viewer
		moduleId:           { type:String,  required:true },
		parentIsCounting:   { type:Boolean, required:false, default:false }, // field parent is counting records (tab counter)
		parentIsHidden:     { type:Boolean, required:false, default:false }, // field parent has its content hidden (tab/container)
		values:             { type:Object,  required:true },
		variableIdMapLocal: { type:Object,  required:true }                  // variable values by ID (variables assigned to form)
	},
	emits:[
		'clipboard','execute-function','hotkey','open-form','set-form-args',
		'set-counter','set-touched','set-valid','set-value','set-value-init'
	],
	data() {
		return {
			collectionIdMapIndexes:{},    // selected record indexes of collection, used to filter with
			columnIdsByUser:[],
			notTouched:true,              // data field was not touched by user
			popUpFormInline:null,         // inline form for some field types (list)
			regconfigInput:'',
			showColorPickerInput:false,   // for color picker fields
			showPassword:false,           // for password fields
			tabIndexFieldIdMapCounter:{}, // tabs only: counter (by tab index + field ID) of child values (like combined list row counts)
			tabIndexShow:0                // tabs only: which tab is shown
		};
	},
	watch:{
		formLoading(val) {
			if(!val) this.notTouched = true;
		},
		isValid:{ // inform parent form about field validity
			handler(v) { this.$emit('set-valid',v,this.field.id); },
			immediate:true
		},
		tabIndexesHidden:{
			handler(v) {
				if(this.isTabs && v.includes(this.tabIndexShow))
					this.setTabToValid();
			},
			immediate:true
		}
	},
	computed:{
		// field value for data attribute
		value:{
			get() {
				if(!this.isData) return false;

				if(this.isVariable) {
					if(this.variable === false)
						return null;

					if(this.variable.formId !== null)
						return this.variableIdMapLocal[this.variable.id] !== undefined ? this.variableIdMapLocal[this.variable.id] : null;
					
					return this.variableIdMapGlobal[this.variable.id] !== undefined ? this.variableIdMapGlobal[this.variable.id] : null;
				}
				
				// if only alt attribute is set, field still needs primary attribute value (form log)
				if(this.values[this.fieldAttributeId] === undefined)
					return null;
				
				// apply fixed decimal length to newly loaded decimal numbers
				if(this.notTouched && this.isDecimal && typeof this.values[this.fieldAttributeId] === 'number' && (
					this.attribute.length !== 0 || this.attribute.lengthFract !== 0
				)) {
					return this.values[this.fieldAttributeId].toFixed(this.attribute.lengthFract);
				}
				return this.values[this.fieldAttributeId];
			},
			set(val,valOld) {
				this.setValue(val,valOld,this.fieldAttributeId);
			}
		},
		
		// field value for alternative data attribute (not available for variables)
		valueAlt:{
			get() {
				if(!this.isData)    return false;
				if(this.isVariable) return false;
				
				// if only primary attribute is set, field still needs alt attribute value (form log)
				return this.values[this.fieldAttributeIdAlt] !== undefined
					? this.values[this.fieldAttributeIdAlt] : null;
			},
			set(val,valOld) {
				if(this.fieldAttributeIdAlt !== false)
					this.setValue(val,valOld,this.fieldAttributeIdAlt);
			}
		},
		
		caption:(s) => {
			let out = '';
			if(s.fieldIdMapOverwrite.caption[s.field.id] !== undefined) {
				out = s.fieldIdMapOverwrite.caption[s.field.id];
			}
			else {
				const title = s.getCaption('fieldTitle',s.moduleId,s.field.id,s.field.captions);
				if(title !== '') {
					out = title;
				}
				else if(s.attribute) {
					out = s.getCaption('attributeTitle',s.moduleId,s.attribute.id,s.attribute.captions,s.attribute.name);
				}
			}
			return s.isRequired ? out + '*' : out;
		},
		captionError:(s) => {
			if(s.customErr !== null) return s.customErr; // custom error is always shown
			if(!s.showInvalid)       return '';
			
			if(!s.isValidMin) {
				if(s.isString) return s.capGen.inputShort.replace('{MIN}',s.field.min);
				if(s.isFiles)  return s.capGen.inputTooFewFiles;
				return s.capGen.inputSmall.replace('{MIN}',s.field.min);
			}
			if(!s.isValidMax) {
				if(s.isString) return s.capGen.inputLong.replace('{MAX}',s.field.max);
				if(s.isFiles)  return s.capGen.inputTooManyFiles;
				return s.capGen.inputLarge.replace('{MAX}',s.field.max);
			}
			
			if(s.isDecimal)     return s.capGen.inputDecimal;
			if(s.isRequired)    return s.capGen.inputRequired;
			if(!s.isValidValue) return s.capGen.inputInvalid; // generic error
			return '';
		},
		captionHelp:(s) => s.getCaption('fieldHelp',s.moduleId,s.field.id,s.field.captions),
		domClass:(s) => {
			let out = [];
			if(s.isDropdown) out.push('dropdown');
			if(s.isHidden)   out.push('hidden');
			if(s.isIframe)   out.push('iframe');
			if(s.isReadonly) out.push('readonly');
			if(s.isRichtext) out.push('richtext');

			// for CSS overwrites for number fields
			if(s.isInteger) out.push('integer');
			if(s.isDecimal) out.push('decimal');
			
			if(s.isTextarea || s.isRichtext)   out.push('top-aligned');
			if(s.isHeader && s.field.richtext) out.push('headerRichtext');
			
			if(s.isContainer)
				out.push('container', s.field.direction);
			
			if(s.flexDirParent === 'column' && (s.isHeader || s.isLineSingle))
				out.push('noGrow');
			
			return out;
		},
		domStyle:(s) => {
			let out = [];
			if(s.isContainer) {
				out.push(s.getFlexStyle(
					s.flexDirParent,s.field.justifyContent,s.field.alignItems,
					s.field.alignContent,s.field.wrap,s.field.grow,s.field.shrink,
					s.field.basis,s.field.perMax,s.field.perMin));
			}
			if(s.fieldIdMapOverwrite.order[s.field.id] !== undefined)
				out.push(`order:${s.fieldIdMapOverwrite.order[s.field.id]}`);
			
			return out.join(';');
		},
		fieldAttributeId:(s) => {
			if(!s.isData || s.isVariable) return false;
			
			const atrIdNm = s.field.attributeIdNm !== undefined ? s.field.attributeIdNm : null;
			return s.getIndexAttributeId(s.field.index,
				s.field.attributeId,s.field.outsideIn === true,atrIdNm);
		},
		fieldAttributeIdAlt:(s) => !s.isData || s.isVariable || s.field.attributeIdAlt === null ? false
			: s.getIndexAttributeId(s.field.index,s.field.attributeIdAlt,false,null),
		columnsProcessed:(s) => !s.isQuery ? [] : s.getColumnsProcessed(
			s.field.columns,s.columnIdsByUser,s.joinsIndexMap,s.dataFieldMap,
			s.fieldIdsChanged,s.fieldIdsInvalid,s.values),
		choicesProcessed:(s) => {
			if(!s.isQuery) return [];
			
			let choices = JSON.parse(JSON.stringify(s.field.query.choices));
			for(let i = 0, j = choices.length; i < j; i++) {
				choices[i].filters = s.getQueryFiltersProcessed(
					choices[i].filters,s.joinsIndexMap,s.dataFieldMap,
					s.fieldIdsChanged,s.fieldIdsInvalid,s.values,
					s.collectionIdMapIndexes,s.variableIdMapLocal
				);
			}
			return choices;
		},
		filtersProcessed:(s) => !s.isQuery ? [] : s.getQueryFiltersProcessed(
			s.field.query.filters,s.joinsIndexMap,s.dataFieldMap,
			s.fieldIdsChanged,s.fieldIdsInvalid,s.values,
			s.collectionIdMapIndexes,s.variableIdMapLocal
		),
		iconId:(s) => {
			if(s.field.iconId !== null) return s.field.iconId;

			return s.isData && !s.isVariable && s.attribute.iconId !== null ? s.attribute.iconId : false;
		},
		lineInputType:(s) => {
			if(s.isMobile && (s.isDecimal || s.isInteger)) return 'number';
			return !s.isPassword || s.showPassword ? 'text' : 'password';
		},
		presetValue:(s) => {
			if(!s.isData) return false;
			
			const join = s.joinsIndexMap[s.field.index];
			const rel  = s.relationIdMap[join.relationId];
			for(let preset of rel.presets) {
				if(s.presetIdMapRecordId[preset.id] !== join.recordId)
					continue;
				
				for(let value of preset.values) {
					if(value.attributeId === s.attribute.id)
						return value;
				}
			}
			return false;
		},
		regconfigOptions:(s) => {
			let out = [];
			for(let d of s.searchDictionaries) {
				if((s.regconfigInput === '' || d.startsWith(s.regconfigInput)) && d !== 'simple' && s.value !== d)
					out.push({id:d,name:d});
			}
			return out;
		},
		relationshipRecordIds:(s) => {
			if(!s.isData || s.value === null) return [];
			if(!s.isRelationship1N)           return [s.value];
			
			let ids = [];
			for(let i = 0, j = s.value.length; i < j; i++) {
				ids.push(s.value[i]);
			}
			return ids;
		},
		stateFinal:(s) => {
			// field state has a default value, which can be overwritten by form states
			// hidden: field is not shown
			// default: field is shown, data field state is overwritten depending on circumstance
			// optional: data field only, input is optional
			// required: data field only, input is required
			// readonly: data or button field, input is readonly
			let state = s.field.state;
			
			// apply form state if available
			if(typeof s.entityIdMapState.field[s.field.id] !== 'undefined')
				state = s.entityIdMapState.field[s.field.id];
			
			// overwrites for 'default' state for data fields
			if(s.isData && !s.isVariable && state === 'default') {
				if(!s.inputCanWrite) state = 'readonly';
				
				if(s.inputCanWrite                          // can write
					&& !s.isBulkUpdate                      // bulk update is always optional
					&& !s.attribute.nullable                // value not optional
					&& !s.isRelationship1N                  // not 0...n partners
					&& (!s.isNew || s.attribute.def === '') // existing record or new one with no defaults
				) state = 'required';
			}

			if(state !== 'hidden') {
				// overwrite in log viewer context, only hidden or readonly allowed
				if(s.logViewer)
					state = 'readonly';

				// overwrite visible data/button/variable field to readonly if form is readonly
				if(s.formReadonly && (s.isData || s.isButton || s.isVariable))
					state = 'readonly';
			}
			return state;
		},
		tabIndexesHidden:(s) => {
			if(!s.isTabs) return [];
			let out = [];
			for(let i = 0, j = s.field.tabs.length; i < j; i++) {
				let t     = s.field.tabs[i];
				let state = typeof s.entityIdMapState.tab[t.id] !== 'undefined'
					? s.entityIdMapState.tab[t.id] : t.state;
				
				if(state === 'hidden')
					out.push(i);
			}
			return out;
		},
		tabIndexesInvalidFields:(s) => {
			if(!s.isTabs) return [];
			let hasAnyInvalid = (fields) => {
				for(let f of fields) {
					switch(f.content) {
						case 'data':      if(s.fieldIdsInvalid.includes(f.id)) return true; break;
						case 'container': if(hasAnyInvalid(f.fields))          return true; break;
						case 'tabs':
							for(let t of f.tabs) {
								if(hasAnyInvalid(t.fields)) return true;
							}
						break;
					}
				}
				return false;
			};
			
			let out = [];
			for(let i = 0, j = s.field.tabs.length; i < j; i++) {
				if(hasAnyInvalid(s.field.tabs[i].fields))
					out.push(i);
			}
			return out;
		},
		tabIndexesTitle:(s) => {
			let out = [];
			for(let i = 0, j = s.field.tabs.length; i < j; i++) {
				const tab = s.field.tabs[i];
				out.push(s.getCaption('tabTitle',s.moduleId,tab.id,tab.captions,'-'));
				
				if(typeof s.tabIndexFieldIdMapCounter[String(i)] === 'undefined')
					continue;
				
				// aggregate tab counters
				let ctr = 0;
				for(let fieldId in s.tabIndexFieldIdMapCounter[String(i)]) {
					ctr += s.tabIndexFieldIdMapCounter[String(i)][fieldId];
				}
				out[out.length-1] += ` (${ctr})`;
			}
			return out;
		},
		
		// data input states
		inputCanWrite:(s) => {
			if(!s.isData)    return false;
			if(s.isVariable) return true;
			
			// if field shows preset value and it is protected (set more than once)
			if(s.presetValue !== false && s.presetValue.protected)
				return false;
			
			// check SET(2) permission for attribute
			if(!s.hasAccessToAttribute(s.access,s.field.attributeId,
				s.attributeIdMap[s.field.attributeId].relationId,2)) {
				
				return false;
			}
			
			if(s.isRelationship && s.field.attributeIdNm !== null
				&& !s.hasAccessToAttribute(s.access,s.field.attributeIdNm,
				s.attributeIdMap[s.field.attributeIdNm].relationId,2)) {
				
				return false;
			}
			
			// check join of field attribute
			let join = s.joinsIndexMap[s.field.index];
			
			// SET denied on join due to relation policy
			if(join.recordNoSet)
				return false;
			
			// SET dependent on join allowing record update
			if(join.recordId !== 0 || s.isBulkUpdate)
				return join.applyUpdate;
			
			// field attribute relation has no record ID
			// collect relationship chain until source relation
			let indexChain = [join.index];
			for(let index = join.indexFrom; index !== -1; index = s.joinsIndexMap[index].indexFrom) {
				indexChain.push(index);
			}
			
			// check the chain from the beginning (source relation)
			// does every piece have a valid record ID or does it support creation of one?
			// if a single chain piece is broken, we cannot use this data field
			indexChain.sort();
			let chainBroken = false;
			for(let i = 0, j = indexChain.length; i < j; i++) {
				
				let relCheck = s.joinsIndexMap[indexChain[i]];
				if(relCheck.recordId === 0 && !relCheck.applyCreate) {
					chainBroken = true;
					break;
				}
			}
			return !chainBroken;
		},
		
		// bool states
		isLineInput:(s) => s.isData
			&& !s.isBoolean      && !s.isColor
			&& !s.isDateInput    && !s.isDrawing
			&& !s.isFiles        && !s.isIframe
			&& !s.isLogin        && !s.isSlider
			&& !s.isTextarea     && !s.isRegconfig
			&& !s.isRelationship && !s.isRichtext
			&& !s.isUuid,
		isLineSingle:(s) => s.isData && (
			s.isLineInput || s.isBoolean || s.isColor || s.isDateInput || s.isSlider ||
			s.isLogin || s.isRegconfig || s.isUuid || (s.isRelationship && !s.isRelationship1N)
		),
		isValid:(s) => {
			if(!s.isData || s.isReadonly) return true;
			if(s.value === null)          return !s.isRequired;
			if(!s.isValidValue)           return false;
			return true;
		},
		isValidMax:(s) => {
			if(!s.isData || s.isVariable || s.value === null || s.field.max === null) return true;
			if((s.isDecimal || s.isInteger) && s.value > s.field.max)                 return false;
			if(s.isString && s.value.length > s.field.max)                            return false;
			
			if(s.isFiles) return typeof s.value.fileCount !== 'undefined'
				? s.value.fileCount <= s.field.max : s.value.length <= s.field.max;
			
			return true;
		},
		isValidMin:(s) => {
			if(!s.isData || s.isVariable || s.value === null || s.field.min === null) return true;
			if((s.isDecimal || s.isInteger) && s.value < s.field.min)                 return false;
			if(s.isString && s.value.length < s.field.min)                            return false;
			
			if(s.isFiles) return typeof s.value.fileCount !== 'undefined'
				? s.value.fileCount >= s.field.min : s.value.length >= s.field.min;
			
			return true;
		},
		isValidValue:(s) => {
			if(!s.isData)                                            return true;
			if(s.customErr !== null)                                 return false;
			if(s.inputRegex !== null && !s.inputRegex.test(s.value)) return false;

			if(typeof s.value === 'string') {
				if(s.isDecimal && !/^-?\d+[\.\,]?\d*$/.test(s.value)) return false;
				if(s.isInteger && !/^-?\d+$/.test(s.value))           return false;
			}
			
			if(s.isUuid && !/^[0-9a-f]{8}\-[0-9a-f]{4}\-[0-9a-f]{4}\-[0-9a-f]{4}\-[0-9a-f]{12}$/i.test(s.value))
				return false;
			
			return s.isValidMin && s.isValidMax;
		},
		
		// simple
		attribute:  (s) => s.isData && !s.isVariable ? s.attributeIdMap[s.field.attributeId] : false ,
		content:    (s) => s.isVariable ? 'data' : s.field.content,
		contentData:(s) => s.isData && !s.isVariable ? s.attribute.content    : s.variable.content,
		contentUse: (s) => s.isData && !s.isVariable ? s.attribute.contentUse : s.variable.contentUse,
		customErr:  (s) => s.fieldIdMapOverwrite.error[s.field.id] !== undefined
			&& s.fieldIdMapOverwrite.error[s.field.id] !== null ? s.fieldIdMapOverwrite.error[s.field.id] : null,
		hasCaption: (s) => !s.isKanban && !s.isCalendar && !s.isAlone && s.caption !== '',
		hasIntent:  (s) => !s.isChart && !s.isKanban && !s.isCalendar && !s.isTabs && !s.isList && !s.isDrawing && !s.isFiles,
		inputRegex: (s) => !s.isData || s.isVariable || s.field.regexCheck === null ? null : new RegExp(s.field.regexCheck),
		link:       (s) => !s.isData ? false : s.getLinkMeta(s.field.display,s.value),
		showInvalid:(s) => !s.isValid && (s.formBadSave || !s.notTouched),
		variable:   (s) => (!s.isVariable || s.field.variableId === null) ? false : s.variableIdMap[s.field.variableId],
		
		// content types
		isButton:   (s) => s.content === 'button',
		isCalendar: (s) => s.content === 'calendar',
		isChart:    (s) => s.content === 'chart',
		isContainer:(s) => s.content === 'container',
		isData:     (s) => s.content === 'data',
		isHeader:   (s) => s.content === 'header',
		isKanban:   (s) => s.content === 'kanban',
		isList:     (s) => s.content === 'list',
		isTabs:     (s) => s.content === 'tabs',
		isVariable: (s) => s.field.content === 'variable',
		
		// states
		isAlone:   (s) => s.isAloneInForm || s.isAloneInTab,
		isHidden:  (s) => s.stateFinal === 'hidden' || s.parentIsHidden,
		isReadonly:(s) => s.stateFinal === 'readonly',
		isRequired:(s) => s.stateFinal === 'required',
		
		// display options
		isLogin:   (s) => s.isData && s.field.display === 'login',
		isPassword:(s) => s.isData && s.field.display === 'password',
		isSlider:  (s) => s.isData && s.field.display === 'slider',
		
		// composite
		isActive:        (s) => (!s.isMobile || s.field.onMobile) && (!s.isVariable || s.field.variableId !== null),
		isEncrypted:     (s) => s.isData && s.attribute.encrypted,
		isNew:           (s) => s.isData && !s.isVariable && s.joinsIndexMap[s.field.index].recordId === 0,
		isBoolean:       (s) => s.isData && s.isAttributeBoolean(s.contentData),
		isCategory:      (s) => s.isData && s.isRelationship && s.field.category,
		isClipboard:     (s) => s.isData && s.field.clipboard && !s.isFiles && !s.isRelationship,
		isColor:         (s) => s.isData && s.contentUse === 'color',
		isDate:          (s) => s.isData && s.contentUse === 'date',
		isDatetime:      (s) => s.isData && s.contentUse === 'datetime',
		isDateInput:     (s) => s.isData && s.isDatetime || s.isDate || s.isTime,
		isDateRange:     (s) => s.isDateInput && !s.isVariable && s.field.attributeIdAlt !== null,
		isDecimal:       (s) => s.isData && s.isAttributeDecimal(s.contentData),
		isDrawing:       (s) => s.isData && s.contentUse === 'drawing',
		isDropdown:      (s) => s.isData && (s.isRelationship || s.isDateInput || s.isLogin || s.isColor || s.isRegconfig),
		isFiles:         (s) => s.isData && s.isAttributeFiles(s.contentData),
		isIframe:        (s) => s.isData && s.contentUse === 'iframe',
		isInteger:       (s) => s.isData && s.isAttributeInteger(s.contentData),
		isQuery:         (s) => s.isCalendar || s.isChart || s.isKanban || s.isList || s.isRelationship,
		isRegconfig:     (s) => s.isData && s.isAttributeRegconfig(s.contentData),
		isRichtext:      (s) => s.isData && s.contentUse === 'richtext',
		isString:        (s) => s.isData && s.isAttributeString(s.contentData),
		isTextarea:      (s) => s.isData && s.contentUse === 'textarea',
		isTime:          (s) => s.isData && s.contentUse === 'time',
		isUuid:          (s) => s.isData && s.isAttributeUuid(s.contentData),
		isRelationship:  (s) => s.isData && s.isAttributeRelationship(s.contentData),
		isRelationship1N:(s) => s.isRelationship && (s.contentData === '1:n' || (s.field.outsideIn === true && s.contentData === 'n:1')),
		
		// stores
		relationIdMap:      (s) => s.$store.getters['schema/relationIdMap'],
		attributeIdMap:     (s) => s.$store.getters['schema/attributeIdMap'],
		iconIdMap:          (s) => s.$store.getters['schema/iconIdMap'],
		presetIdMapRecordId:(s) => s.$store.getters['schema/presetIdMapRecordId'],
		variableIdMap:      (s) => s.$store.getters['schema/variableIdMap'],
		access:             (s) => s.$store.getters.access,
		capApp:             (s) => s.$store.getters.captions.form,
		capGen:             (s) => s.$store.getters.captions.generic,
		isMobile:           (s) => s.$store.getters.isMobile,
		searchDictionaries: (s) => s.$store.getters.searchDictionaries,
		settings:           (s) => s.$store.getters.settings,
		variableIdMapGlobal:(s) => s.$store.getters.variableIdMapGlobal,
	},
	mounted() {
		if(this.isTabs)
			this.setTabToValid();

		this.columnIdsByUser = this.fieldOptionGet(this.field.id,'columnIdsByUser',[]);

		// fill stored collection row indexes
		this.collectionIdMapIndexes = this.fieldOptionGet(this.field.id,'collectionIdMapIndexes',{});
	},
	methods:{
		// externals
		fieldOptionGet,
		fieldOptionSet,
		getCaption,
		getColumnsProcessed,
		getFlexStyle,
		getFormPopUpConfig,
		getIndexAttributeId,
		getLinkMeta,
		getNilUuid,
		getQueryFiltersProcessed,
		hasAccessToAttribute,
		isAttributeBoolean,
		isAttributeDecimal,
		isAttributeFiles,
		isAttributeInteger,
		isAttributeRelationship,
		isAttributeRegconfig,
		isAttributeString,
		isAttributeUuid,
		openLink,
		setGetterArgs,
		srcBase64,
		
		// presentation
		getTabClasses(tabIndex) {
			if(!this.isTabs) return {};
			const active   = tabIndex === this.tabIndexShow;
			const fields   = this.field.tabs[tabIndex].fields;
			const oneField = fields.length === 1 ? fields[0] : false;
			let   readonly = false;
			let   drawing  = false;
			let   files    = false;
			
			if(oneField && typeof this.$refs['tabField_'+oneField.id] !== 'undefined')
				readonly = this.$refs['tabField_'+oneField.id]['0'].isReadonly;
			
			if(oneField && oneField.content === 'data') {
				const atr = this.attributeIdMap[oneField.attributeId];
				drawing = atr.contentUse === 'drawing';
				files   = atr.content    === 'files';
			}
			
			return {
				active:  tabIndex === this.tabIndexShow,
				error:   this.formBadSave && this.tabIndexesInvalidFields.includes(tabIndex),
				inputBg: active && oneField && !files && !drawing && oneField.content === 'data',
				readonly:active && oneField && readonly
			};
		},
		
		// actions
		copyToClipboard() {
			navigator.clipboard.writeText(this.value);
			this.$emit('clipboard');
		},
		click() {
			if(this.isColor && !this.isReadonly)
				this.showColorPickerInput = !this.showColorPickerInput;
		},
		clickOutside() {
			if(this.showColorPickerInput)
				this.showColorPickerInput = false;
		},
		closeInline() {
			this.popUpFormInline = null;
		},
		openForm(rows,getterArgs,newTab,openFormContext) {
			// set defaults
			if(typeof rows            === 'undefined') rows            = [];
			if(typeof getterArgs      === 'undefined') getterArgs      = [];
			if(typeof newTab          === 'undefined') newTab          = false;
			if(typeof openFormContext === 'undefined') openFormContext = null;
			
			// form open context
			let openForm = JSON.parse(JSON.stringify(
				openFormContext === 'bulk' ? this.field.openFormBulk : this.field.openForm
			));
			
			let recordIds = [];
			for(let row of rows) {
				const id = row.indexRecordIds[openForm.relationIndexOpen];
				
				if(typeof id !== 'undefined' && id !== null)
					recordIds.push(id);
			}
			
			// apply relationship default attribute value via getter
			// apply for existing records also, default values are needed for parent reference when clicking 'new' after opening existing record
			if(openForm.attributeIdApply !== null
				&& this.joinsIndexMap[openForm.relationIndexApply] !== undefined
				&& this.joinsIndexMap[openForm.relationIndexApply].recordId !== 0) {
				
				const atrId    = openForm.attributeIdApply;
				const recordId = this.joinsIndexMap[openForm.relationIndexApply].recordId;
				
				getterArgs = this.setGetterArgs(getterArgs,'attributes',`${atrId}_${recordId}`);
			}
			
			// pop-up inline form (only inside none-inputs fields) and never on mobile
			// pop-up float forms are sent upwards to the parent form to deal with
			if(openForm.popUpType === 'inline' && !this.isMobile && !newTab)
				return this.popUpFormInline = this.getFormPopUpConfig(
					recordIds,openForm,getterArgs,'attributes');
			
			this.$emit('open-form',recordIds,openForm,getterArgs,newTab,this.field.id);
		},
		relationshipRecordsSelected(recordIds) {
			if(recordIds === null)     return this.value = null;
			if(!this.isRelationship1N) return this.value = recordIds[0];
			if(this.value === null)    return this.value = recordIds;
			
			this.value = this.value.concat(recordIds);
		},
		relationshipRecordRemoved(recordId) {
			if(!this.isRelationship1N)
				return this.value = null;
			
			let valueNew = [];
			for(let i = 0, j = this.value.length; i < j; i++) {
				if(this.value[i] !== recordId)
					valueNew.push(this.value[i]);
			}
			this.value = valueNew.length !== 0 ? valueNew : null;
		},
		setColumnIdsByUser(ids) {
			this.columnIdsByUser = ids;
			this.fieldOptionSet(this.field.id,'columnIdsByUser',ids);
		},
		setCollectionIndexes(collectionId,indexes) {
			this.collectionIdMapIndexes[collectionId] = indexes;
			this.fieldOptionSet(this.field.id,'collectionIdMapIndexes',this.collectionIdMapIndexes);
		},
		setTab(tabIndex) {
			this.fieldOptionSet(this.field.id,'tabIndex',tabIndex);
			this.tabIndexShow = tabIndex;
		},
		setTabCounter(tabIndex,fieldId,value) {
			if(!this.field.tabs[tabIndex].contentCounter)
				return;
			
			if(typeof this.tabIndexFieldIdMapCounter[String(tabIndex)] === 'undefined')
				this.tabIndexFieldIdMapCounter[String(tabIndex)] = {};
			
			this.tabIndexFieldIdMapCounter[String(tabIndex)][fieldId] = value;
		},
		setTabToValid() {
			// set tab to valid one, either last remembered or first valid
			if(this.settings.tabRemember) {
				const tabIndex = this.fieldOptionGet(this.field.id,'tabIndex',0);
				if(this.field.tabs.length > tabIndex && !this.tabIndexesHidden.includes(tabIndex))
					return this.tabIndexShow = tabIndex;
			}
			for(let i = 0, j = this.field.tabs.length; i < j; i++) {
				if(!this.tabIndexesHidden.includes(i))
					return this.tabIndexShow = i;
			}
		},
		setValue(val,valOld,indexAttributeId) {
			// clean inputs
			if(val === '')
				val = null;

			if(val !== null && typeof val === 'string') {
				if(this.isInteger && /^\-?\d+$/.test(val))
					val = parseInt(val);

				if(this.isDecimal)
					val = val.replace(',','.');
			}
			
			if(!this.isVariable) {
				// regular field, send changes up to the form
				if(this.notTouched && val !== valOld) {
					this.notTouched = false;
					this.$emit('set-touched',this.field.id);
				}
				this.$emit('set-value',indexAttributeId,val);
			} else {
				// variable field, send changes to the variable
				if(this.notTouched)
					this.notTouched = false;

				if(this.variable.formId !== null)
					this.variableIdMapLocal[this.variable.id] = val;
				else
					this.$store.commit('variableStoreValueById',{id:this.variable.id,value:val});
			}
			
			if(this.field.jsFunctionId !== null)
				this.$emit('execute-function',this.field.jsFunctionId);
		},
		triggerButton(middleClick) {
			if(this.field.openForm !== null)
				this.openForm([],[],middleClick,null);
			
			if(this.field.jsFunctionId !== null)
				this.$emit('execute-function',this.field.jsFunctionId);
		}
	}
};