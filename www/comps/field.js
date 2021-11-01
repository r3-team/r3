import MyCalendar                 from './calendar.js';
import MyChart                    from './chart.js';
import MyGantt                    from './gantt.js';
import MyInputDate                from './inputDate.js';
import MyInputFiles               from './inputFiles.js';
import MyInputLogin               from './inputLogin.js';
import MyInputRichtext            from './inputRichtext.js';
import MyList                     from './list.js';
import {hasAccessToAttribute}     from './shared/access.js';
import {getLinkMeta,openLink}     from './shared/generic.js';
import {getQueryFiltersProcessed} from './shared/query.js';
import {srcBase64}                from './shared/image.js';

import {
	getFlexStyle,
	getInputFieldName,
	setGetterArgs
} from './shared/form.js';

import {
	getIndexAttributeId,
	isAttributeBoolean,
	isAttributeDecimal,
	isAttributeFiles,
	isAttributeInteger,
	isAttributeRelationship,
	isAttributeString
} from './shared/attribute.js';

export {MyField as default};

let MyField = {
	name:'my-field',
	components:{
		'chrome-picker':VueColor.Chrome,
		MyCalendar,
		MyChart,
		MyGantt,
		MyInputDate,
		MyInputFiles,
		MyInputLogin,
		MyInputRichtext,
		MyList
	},
	template:`<div class="field"
		v-if="isActive"
		:class="domClass"
		:style="domStyle"
	>
		<template v-if="isData">
			
			<div class="input-box"
			 	v-click-outside="clickOutside"
				:class="{ hasCaption:value !== null, disabled:isReadonly }"
				:id="getInputFieldName(field.id)"
			>
				<div class="caption"
					v-if="focused || value !== null || isBoolean || isDateInput || isSlider || isRichtext || isCategory"
					:class="{ invalid:showInvalid }"
				>{{ caption }}</div>
				
				<div class="input-line">
					
					<!-- data field icon -->
					<img class="field-icon"
						v-if="iconId && !isRelationship && !isFiles"
						:src="srcBase64(iconIdMap[iconId].file)"
					/>
					
					<!-- regular text line input (numeric, strings, etc.) -->
					<input class="input" type="text"
						v-if="isLineInput"
						v-model="value"
						@blur="blur"
						@focus="focus"
						@click="click"
						:class="{ invalid:showInvalid }"
						:disabled="isReadonly"
						:placeholder="!focused ? caption : ''"
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
						
						<input class="input" type="text"
							@blur="blur"
							@focus="focus"
							v-model="value"
							:class="{ invalid:showInvalid }"
							:disabled="isReadonly"
							:placeholder="!focused ? caption : ''"
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
					<textarea class="input textarea"
						v-if="isTextarea"
						v-model="value"
						@blur="blur"
						@focus="focus"
						@click="click"
						:class="{ invalid:showInvalid }"
						:disabled="isReadonly"
						:placeholder="!focused ? caption : ''"
					></textarea>
					
					<!-- richtext input -->
					<my-input-richtext
						v-if="isRichtext"
						v-model="value"
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
						<input class="value"
							v-model="value"
							:disabled="isReadonly"
						/>
					</div>
					
					<!-- login input -->
					<my-input-login
						v-if="isLogin"
						v-model="value"
						@blurred="blur"
						@focused="focus"
						:placeholder="!focused ? caption : ''"
						:readonly="isReadonly"
					/>
					
					<!-- date / datetime / time input -->
					<my-input-date
						v-if="isDateInput"
						@blurred="blur"
						@focused="focus"
						@set-unix-from="value = $event"
						@set-unix-to="valueAlt = $event"
						:isDate="isDatetime || isDate"
						:isTime="isDatetime || isTime"
						:isRange="isDateRange"
						:isReadonly="isReadonly"
						:unixFrom="value"
						:unixTo="valueAlt"
					/>
					
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
						:attributeId="field.attributeId"
						:handleError="handleError"
						:readonly="isReadonly"
						:showGallery="field.display === 'gallery'"
						:showNew="logViewer"
					>
						<template #input-icon>
							<img class="field-icon"
								v-if="iconId"
								:src="srcBase64(iconIdMap[iconId].file)"
							/>
						</template>
						
						<template #input-empty>
							<input class="input" type="text"
								:disabled="true"
								:placeholder="caption"
							/>
						</template>
					</my-input-files>
					
					<!-- relationship input -->
					<my-list
						v-if="isRelationship"
						@blurred="blur"
						@focused="focus"
						@form-open="$emit('set-form-record',$event,field.formIdOpen)"
						@form-open-new="$emit('set-form-record',0,field.formIdOpen,addRecordAttributeArgs([]))"
						@record-selected="relationshipRecordSelected"
						@record-removed="relationshipRecordRemoved"
						:choices="choicesProcessed"
						:columns="columnsProcessed"
						:fieldId="field.id"
						:filterQuick="field.filterQuick"
						:filters="filtersProcessed"
						:formLoading="formLoading"
						:handleError="handleError"
						:header="false"
						:inputAsCategory="field.category"
						:inputAutoSelect="field.autoSelect"
						:inputCaption="caption"
						:inputIsNew="isNew"
						:inputIsReadonly="isReadonly"
						:inputMulti="isRelationship1N"
						:inputOpenForm="field.formIdOpen !== null"
						:inputRecordIds="relationshipRecordIds"
						:inputValid="!showInvalid"
						:isInput="true"
						:query="field.query"
						:rowSelect="true"
					>
						<template #input-icon>
							<img class="field-icon"
								v-if="iconId"
								:src="srcBase64(iconIdMap[iconId].file)"
							/>
						</template>
					</my-list>
				</div>
			</div>
			
			<!-- helper text -->
			<div class="captionSub" v-if="captionHelp !== '' && captionError === ''">
				{{ captionHelp }}
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
			:caption="caption"
			:imageBase64="iconId ? srcBase64(iconIdMap[iconId].file) : ''"
		/>
		
		<!-- header -->
		<div class="heading"
			v-if="field.content === 'header'"
			:class="'size'+field.size"
		>
			<img v-if="iconId" :src="srcBase64(iconIdMap[iconId].file)" />
			{{ caption }}
		</div>
		
		<!-- list -->
		<my-list
			v-if="isList"
			@record-selected="(...args) => $emit('set-form-record',args[0],field.formIdOpen,addRecordAttributeArgs([]),args[1])"
			@set-args="(...args) => $emit('set-form-args',...args)"
			:autoRenew="field.autoRenew"
			:choices="choicesProcessed"
			:columns="columnsProcessed"
			:csvExport="field.csvExport"
			:csvImport="field.csvImport"
			:fieldId="field.id"
			:filterQuick="field.filterQuick"
			:filters="filtersProcessed"
			:formLoading="formLoading"
			:handleError="handleError"
			:iconId="iconId ? iconId : null"
			:isFullPage="isFullPage"
			:layout="field.layout"
			:query="field.query"
			:resultLimit="field.resultLimit"
			:rowSelect="field.formIdOpen !== null"
		/>
		
		<!-- calendar -->
		<my-calendar
			v-if="isCalendar && !field.gantt"
			@form-open-new="(...args) => $emit('set-form-record',0,field.formIdOpen,addRecordAttributeArgs(args[0]),args[1])"
			@record-selected="(...args) => $emit('set-form-record',args[0],field.formIdOpen,args[1],args[2])"
			@set-args="(...args) => $emit('set-form-args',...args)"
			:attributeIdColor="field.attributeIdColor"
			:attributeIdDate0="field.attributeIdDate0"
			:attributeIdDate1="field.attributeIdDate1"
			:choices="choicesProcessed"
			:columns="columnsProcessed"
			:fieldId="field.id"
			:filters="filtersProcessed"
			:formLoading="formLoading"
			:handleError="handleError"
			:iconId="iconId ? iconId : null"
			:ics="field.ics"
			:indexColor="field.indexColor"
			:indexDate0="field.indexDate0"
			:indexDate1="field.indexDate1"
			:isFullPage="isFullPage"
			:query="field.query"
			:rowSelect="field.formIdOpen !== null"
		/>
		
		<!-- gantt -->
		<my-gantt
			v-if="isCalendar && field.gantt"
			@form-open-new="(...args) => $emit('set-form-record',0,field.formIdOpen,addRecordAttributeArgs(args[0]),args[1])"
			@record-selected="(...args) => $emit('set-form-record',args[0],field.formIdOpen,args[1],args[2])"
			@set-args="(...args) => $emit('set-form-args',...args)"
			:attributeIdColor="field.attributeIdColor"
			:attributeIdDate0="field.attributeIdDate0"
			:attributeIdDate1="field.attributeIdDate1"
			:choices="choicesProcessed"
			:columns="columnsProcessed"
			:fieldId="field.id"
			:days0="field.dateRange0 / 86400"
			:days1="field.dateRange1 / 86400"
			:filters="filtersProcessed"
			:formLoading="formLoading"
			:handleError="handleError"
			:iconId="iconId ? iconId : null"
			:indexColor="field.indexColor"
			:indexDate0="field.indexDate0"
			:indexDate1="field.indexDate1"
			:isFullPage="isFullPage"
			:rowSelect="field.formIdOpen !== null"
			:stepTypeDefault="field.ganttSteps"
			:stepTypeToggle="field.ganttStepsToggle"
			:query="field.query"
		/>
		
		<!-- chart -->
		<my-chart
			v-if="isChart"
			:choices="choicesProcessed"
			:columns="columnsProcessed"
			:filters="filtersProcessed"
			:formLoading="formLoading"
			:handleError="handleError"
			:isFullPage="isFullPage"
			:optionJson="field.chartOption"
			:query="field.query"
		/>
		
		<!-- container children -->
		<my-field
			v-if="isContainer"
			v-for="f in field.fields"
			@set-form-args="(...args) => $emit('set-form-args',...args)"
			@set-form-record="(...args) => $emit('set-form-record',...args)"
			@set-valid="(...args) => $emit('set-valid',...args)"
			@set-value="(...args) => $emit('set-value',...args)"
			:dataFieldMap="dataFieldMap"
			:field="f"
			:fieldIdMapState="fieldIdMapState"
			:formBadSave="formBadSave"
			:formLoading="formLoading"
			:flexDirParent="field.direction"
			:handleError="handleError"
			:isFullPage="isFullPage"
			:joinsIndexMap="joinsIndexMap"
			:key="f.id"
			:values="values"
		/>
	</div>`,
	props:{
		dataFieldMap:   { type:Object,  required:true },
		field:          { type:Object,  required:true },
		fieldIdMapState:{ type:Object,  required:false, default:() => { return {}} }, // overwritten states
		formBadSave:    { type:Boolean, required:true }, // attempted save with invalid inputs
		formLoading:    { type:Boolean, required:true },
		flexDirParent:  { type:String,  required:true }, // flex direction (row/column) of parent
		handleError:    { type:Function,required:true }, // function to handle errors
		isFullPage:     { type:Boolean, required:true },
		joinsIndexMap:  { type:Object,  required:true },
		logViewer:      { type:Boolean, required:false, default:false }, // is part of log viewer
		values:         { type:Object,  required:true }
	},
	emits:['set-form-args','set-form-record','set-valid','set-value'],
	data:function() {
		return {
			focused:false,
			notTouched:true, // data field was not touched by user
			showColorPickerInput:false
		};
	},
	watch:{
		formLoading:function(val) {
			if(!val) this.notTouched = true;
		},
		isValid:{ // inform parent form about field validity
			handler:function(v) { this.$emit('set-valid',v,this.field.id); },
			immediate:true
		}
	},
	computed:{
		attribute:function() {
			if(!this.isData || typeof this.attributeIdMap[this.field.attributeId] === 'undefined')
				return false;
			
			return this.attributeIdMap[this.field.attributeId];
		},
		caption:function() {
			let out = '';
			
			// 1st preference: dedicated field title
			if(typeof this.field.captions.fieldTitle[this.moduleLanguage] !== 'undefined') {
				out = this.field.captions.fieldTitle[this.moduleLanguage];
			}
			else if(this.attribute) {
				
				// 2nd / 3rd preference: dedicated attribute title / name
				if(typeof this.attribute.captions.attributeTitle[this.moduleLanguage] !== 'undefined')
					out = this.attribute.captions.attributeTitle[this.moduleLanguage];
				else
					out = this.attribute.name;
			}
			
			// if nothing else is available: mark as missing
			if(out === '')
				out = this.capGen.missingCaption;
			
			// required marker
			if(this.isRequired)
				out += '*';
			
			return out;
		},
		captionError:function() {
			if(!this.showInvalid) return '';
			
			if(!this.isValidMin) {
				if(this.isString) return this.capGen.inputShort;
				if(this.isFiles)  return this.capGen.inputTooFewFiles;
				
				return this.capGen.inputSmall;
			}
			
			if(!this.isValidMax) {
				if(this.isString) return this.capGen.inputLong;
				if(this.isFiles)  return this.capGen.inputTooManyFiles;
				
				return this.capGen.inputLarge;
			}
			
			if(this.isDecimal)
				return this.capGen.inputDecimal;
			
			if(this.isRequired)
				return this.capGen.inputRequired;
			
			// generic error, if nothing fits
			if(!this.isValidValue)
				return this.capGen.inputInvalid;
			
			return '';
		},
		captionHelp:function() {
			if(typeof this.field.captions.fieldHelp[this.moduleLanguage] !== 'undefined')
				return this.field.captions.fieldHelp[this.moduleLanguage];
			
			return '';
		},
		domClass:function() {
			let out = [];
			
			if(this.isHidden)
				out.push('hidden');
			
			if(this.isContainer) {
				out.push('container');
				out.push(this.field.direction);
			}
			
			if(this.isReadonly)
				out.push('readonly');
			
			if(this.isTextarea || this.isRichtext)
				out.push('top-aligned');
			
			if(this.isRichtext)
				out.push('richtext');
			
			return out;
		},
		domStyle:function() {
			if(!this.isContainer) return '';
			
			return this.getFlexStyle(this.flexDirParent,
				this.field.justifyContent,this.field.alignItems,
				this.field.alignContent,this.field.wrap,this.field.grow,
				this.field.shrink,this.field.basis,this.field.perMax,
				this.field.perMin);
		},
		fieldAttributeId:function() {
			if(!this.isData) return false;
			
			let atrIdNm = typeof this.field.attributeIdNm !== 'undefined' ?
				this.field.attributeIdNm : null;
			
			return this.getIndexAttributeId(this.field.index,
				this.field.attributeId,this.field.outsideIn === true,atrIdNm);
		},
		fieldAttributeIdAlt:function() {
			if(!this.isData || this.field.attributeIdAlt === null)
				return false;
			
			return this.getIndexAttributeId(this.field.index,
				this.field.attributeIdAlt,false,null);
		},
		columnsProcessed:function() {
			if(!this.isQuery) return [];
			
			let columns = JSON.parse(JSON.stringify(this.field.columns));
			for(let i = 0, j = columns.length; i < j; i++) {
				
				if(!columns[i].subQuery)
					continue;
				
				columns[i].query.filters = this.getQueryFiltersProcessed(
					columns[i].query.filters,
					this.dataFieldMap,
					this.joinsIndexMap,
					[],
					this.values
				);
			}
			return columns;
		},
		choicesProcessed:function() {
			if(!this.isQuery) return [];
			
			let choices = JSON.parse(JSON.stringify(this.field.query.choices));
			for(let i = 0, j = choices.length; i < j; i++) {
				choices[i].filters = this.getQueryFiltersProcessed(
					choices[i].filters,
					this.dataFieldMap,
					this.joinsIndexMap,
					[],
					this.values
				);
			}
			return choices;
		},
		filtersProcessed:function() {
			if(!this.isQuery) return [];
			
			return this.getQueryFiltersProcessed(
				this.field.query.filters,
				this.dataFieldMap,
				this.joinsIndexMap,
				[],
				this.values
			);
		},
		iconId:function() {
			if(this.field.iconId !== null)
				return this.field.iconId;
			
			if(this.isData && this.attribute.iconId !== null)
				return this.attribute.iconId;
			
			return false;
		},
		link:function() {
			if(!this.isData)
				return false;
			
			return this.getLinkMeta(this.field.display,this.value);
		},
		presetValue:function() {
			if(!this.isData) return false;
			
			let join = this.joinsIndexMap[this.field.index];
			let rel  = this.relationIdMap[join.relationId];
			
			for(let i = 0, j = rel.presets.length; i < j; i++) {
				
				let preset = rel.presets[i];
				
				if(this.presetIdMapRecordId[preset.id] === join.recordId) {
					
					for(let x = 0, y = preset.values.length; x < y; x++) {
						
						if(preset.values[x].attributeId === this.attribute.id)
							return preset.values[x];
					}
				}
			}
			return false;
		},
		relationshipRecordIds:function() {
			if(!this.isData || this.value === null) return [];
			
			if(this.isRelationship1N) {
				let ids = [];
				for(let i = 0, j = this.value.length; i < j; i++) {
					ids.push(this.value[i]);
				}
				return ids;
			}
			return [this.value];
		},
		stateFinal:function() {
			// field state has a default value, which can be overwritten by form states
			// hidden: field is not shown
			// default: field is shown, data field state is overwritten depending on circumstance
			//  (no permissions = readonly, NOT NULL attribute = required)
			// optional: data field only, input is optional
			// readonly: data field only, input is readonly
			// required: data field only, input is required
			let state = this.field.state;
			
			// apply form state if available
			if(typeof this.fieldIdMapState[this.field.id] !== 'undefined')
				state = this.fieldIdMapState[this.field.id];
			
			// overwrites for 'default' state for data fields
			if(this.isData && state === 'default') {
				if(!this.inputCanWrite)  state = 'readonly';
				if(this.inputIsRequired) state = 'required';
			}
			
			// overwrite in log viewer context, only hidden or readonly allowed
			if(this.logViewer && state !== 'hidden')
				state = 'readonly';
			
			return state;
		},
		
		// field value for data attribute
		value:{
			get:function() {
				if(!this.isData) return false;
				
				// if only alt attribute is set, field still needs primary attribute value (form log)
				return typeof this.values[this.fieldAttributeId] !== 'undefined'
					? this.values[this.fieldAttributeId] : null;
			},
			set:function(val,valOld) {
				if(this.isDecimal)
					val = val.replace(',','.');
				
				this.setValue(val,valOld,this.fieldAttributeId);
			}
		},
		
		// field value for alternative data attribute
		valueAlt:{
			get:function() {
				if(!this.isData) return false;
				
				// if only primary attribute is set, field still needs alt attribute value (form log)
				return typeof this.values[this.fieldAttributeIdAlt] !== 'undefined'
					? this.values[this.fieldAttributeIdAlt] : null;
			},
			set:function(val,valOld) {
				if(this.fieldAttributeIdAlt !== false)
					this.setValue(val,valOld,this.fieldAttributeIdAlt);
			}
		},
		
		// data input states
		inputCanWrite:function() {
			if(!this.isData) return false;
			
			// if field shows preset value and it is protected (set more than once)
			if(this.presetValue !== false && this.presetValue.protected)
				return false;
			
			// check SET(2) permission for attribute
			if(!this.hasAccessToAttribute(this.access,this.field.attributeId,
				this.attributeIdMap[this.field.attributeId].relationId,2)) {
				
				return false;
			}
			
			if(this.isRelationship && this.field.attributeIdNm !== null
				&& !this.hasAccessToAttribute(this.access,this.field.attributeIdNm,
				this.attributeIdMap[this.field.attributeIdNm].relationId,2)) {
				
				return false;
			}
			
			// field attribute relation join has record ID
			let r = this.joinsIndexMap[this.field.index];
			if(r.recordId !== 0)
				return r.applyUpdate; // is join allowed to update record?
			
			// field attribute relation has no record ID
			// collect relationship chain until source relation
			let indexChain = [r.index];
			for(let index = r.indexFrom; index !== -1; index = this.joinsIndexMap[index].indexFrom) {
				indexChain.push(index);
			}
			
			// check the chain from the beginning (source relation)
			// does every piece have a valid record ID or does it support creation of one?
			// if a single chain piece is broken, we cannot use this data field
			indexChain.sort();
			let chainBroken = false;
			for(let i = 0, j = indexChain.length; i < j; i++) {
				
				let relCheck = this.joinsIndexMap[indexChain[i]];
				if(relCheck.recordId === 0 && !relCheck.applyCreate) {
					chainBroken = true;
					break;
				}
			}
			return !chainBroken;
		},
		inputIsRequired:function() {
			if(!this.inputCanWrite)
				return false;
			
			// no data needed
			if(this.attribute.nullable)
				return false;
			
			// 0...n partners (ergo optional)
			if(this.isRelationship1N)
				return false;
			
			// new record with default value available
			if(this.isNew && this.attribute.def !== '')
				return false;
			
			// input is required
			return true;
		},
		inputCheckRegex:function() {
			if(!this.isData || this.field.regexCheck === null)
				return null;
			
			return new RegExp(this.field.regexCheck);
		},
		
		// bool states
		isLineInput:function() {
			return this.isData
				&& !this.isRelationship
				&& !this.isFiles
				&& !this.isBoolean
				&& !this.isDateInput
				&& !this.isLogin
				&& !this.isSlider
				&& !this.isTextarea
				&& !this.isRichtext
				&& !this.isColor
			;
		},
		isValid:function() {
			if(!this.isData || this.isReadonly)
				return true;
			
			if(this.value === null)
				return !this.isRequired;
			
			if(!this.isValidValue)
				return false;
			
			return true;
		},
		isValidValue:function() {
			if(!this.isData) return true;
			
			if(this.inputCheckRegex !== null && !this.inputCheckRegex.test(this.value))
				return false;
			
			if(this.isDecimal && !/^-?\d+\.?\d*$/.test(this.value))
				return false;
			
			if(this.isInteger && !/^-?\d+$/.test(this.value))
				return false;
			
			return this.isValidMin && this.isValidMax;
		},
		isValidMin:function() {
			if(!this.isData || this.value === null || this.field.min === null)
				return true;
			
			if((this.isDecimal || this.isInteger) && this.value < this.field.min)
				return false;
				
			if(this.isString && this.value.length < this.field.min)
				return false;
			
			if(this.isFiles)
				return this.value.files.length >= this.field.min;
			
			return true;
		},
		isValidMax:function() {
			if(!this.isData || this.value === null || this.field.max === null)
				return true;
			
			if((this.isDecimal || this.isInteger) && this.value > this.field.max)
				return false;
				
			if(this.isString && this.value.length > this.field.max)
				return false;
			
			if(this.isFiles)
				return this.value.files.length <= this.field.max;
			
			return true;
		},
		
		// content
		isButton:   function() { return this.field.content === 'button'; },
		isCalendar: function() { return this.field.content === 'calendar'; },
		isChart:    function() { return this.field.content === 'chart'; },
		isContainer:function() { return this.field.content === 'container'; },
		isData:     function() { return this.field.content === 'data'; },
		isList:     function() { return this.field.content === 'list'; },
		
		// display
		isHidden:  function() { return this.stateFinal === 'hidden'; },
		isReadonly:function() { return this.stateFinal === 'readonly'; },
		isRequired:function() { return this.stateFinal === 'required'; },
		
		// display options
		isColor:   function() { return this.isData && this.field.display === 'color'; },
		isDate:    function() { return this.isData && this.field.display === 'date'; },
		isDatetime:function() { return this.isData && this.field.display === 'datetime'; },
		isLogin:   function() { return this.isData && this.field.display === 'login'; },
		isSlider:  function() { return this.isData && this.field.display === 'slider'; },
		isTime:    function() { return this.isData && this.field.display === 'time'; },
		isTextarea:function() { return this.isData && this.field.display === 'textarea'; },
		isRichtext:function() { return this.isData && this.field.display === 'richtext'; },
		
		// composite
		showInvalid:function() { return !this.isValid && (this.formBadSave || !this.notTouched) },
		isActive:   function() { return !this.isMobile || this.field.onMobile; },
		isNew:      function() { return this.isData && this.joinsIndexMap[this.field.index].recordId === 0; },
		isBoolean:  function() { return this.isData && this.isAttributeBoolean(this.attribute.content); },
		isCategory: function() { return this.isData && this.isRelationship && this.field.category; },
		isDateInput:function() { return this.isData && this.isDatetime || this.isDate || this.isTime; },
		isDateRange:function() { return this.isDateInput && this.field.attributeIdAlt !== null; },
		isDecimal:  function() { return this.isData && this.isAttributeDecimal(this.attribute.content); },
		isFiles:    function() { return this.isData && this.isAttributeFiles(this.attribute.content); },
		isInteger:  function() { return this.isData && this.isAttributeInteger(this.attribute.content); },
		isQuery:    function() { return this.isCalendar || this.isChart || this.isList || this.isRelationship },
		isString:   function() { return this.isData && this.isAttributeString(this.attribute.content); },
		isRelationship:  function() { return this.isData && this.isAttributeRelationship(this.attribute.content); },
		isRelationship1N:function() { return this.isRelationship && this.field.outsideIn === true && this.attribute.content === 'n:1'; },
		
		// stores
		token:         function() { return this.$store.getters['local/token']; },
		relationIdMap: function() { return this.$store.getters['schema/relationIdMap']; },
		attributeIdMap:function() { return this.$store.getters['schema/attributeIdMap']; },
		iconIdMap:     function() { return this.$store.getters['schema/iconIdMap']; },
		presetIdMapRecordId:function() { return this.$store.getters['schema/presetIdMapRecordId']; },
		access:        function() { return this.$store.getters.access; },
		capApp:        function() { return this.$store.getters.captions.form; },
		capGen:        function() { return this.$store.getters.captions.generic; },
		isMobile:      function() { return this.$store.getters.isMobile; },
		moduleLanguage:function() { return this.$store.getters.moduleLanguage; },
	},
	methods:{
		// externals
		getFlexStyle,
		getIndexAttributeId,
		getInputFieldName,
		getLinkMeta,
		getQueryFiltersProcessed,
		hasAccessToAttribute,
		isAttributeBoolean,
		isAttributeDecimal,
		isAttributeFiles,
		isAttributeInteger,
		isAttributeRelationship,
		isAttributeString,
		openLink,
		setGetterArgs,
		srcBase64,
		
		// actions
		blur:function() {
			this.focused = false;
		},
		focus:function() {
			this.focused = true;
		},
		click:function() {
			if(this.field.display === 'color' && !this.isReadonly)
				this.showColorPickerInput = !this.showColorPickerInput;
		},
		clickOutside:function() {
			if(this.showColorPickerInput)
				this.showColorPickerInput = false;
		},
		triggerButton:function(middleClick) {
			if(this.field.formIdOpen !== null)
				this.$emit('set-form-record',0,this.field.formIdOpen,
					this.addRecordAttributeArgs([]),middleClick);
		},
		relationshipRecordSelected:function(recordId,middleClick) {
			if(recordId === null)
				return this.value = null;
			
			if(!this.isRelationship1N)
				return this.value = recordId;
			
			if(this.value === null)
				this.value = [];
			
			this.value.push(recordId);
		},
		relationshipRecordRemoved:function(recordId) {
			if(!this.isRelationship1N)
				return this.value = null;
			
			let valueNew = [];
			for(let i = 0, j = this.value.length; i < j; i++) {
				if(this.value[i] !== recordId)
					valueNew.push(this.value[i]);
			}
			this.value = valueNew.length !== 0 ? valueNew : null;
		},
		
		// helpers
		addRecordAttributeArgs:function(args) {
			if(this.field.attributeIdRecord === null
				|| typeof this.joinsIndexMap['0'] === 'undefined'
				|| this.joinsIndexMap['0'].recordId === 0
			) {
				return args;
			}
			
			// add record ID from primary relation join as default value for defined attribute
			let atr = this.attributeIdMap[this.field.attributeIdRecord].id;
			return this.setGetterArgs(args,'attributes',`${atr}_${this.joinsIndexMap['0'].recordId}`);
		},
		setValue:function(val,valOld,indexAttributeId) {
			if(val === '')
				val = null;
			
			// parse string input to integer if integer field and valid integer value
			if(this.isInteger && val !== null && /^\-?\d+$/.test(val))
				val = parseInt(val);
			
			if(val !== valOld)
				this.notTouched = false;
			
			this.$emit('set-value',indexAttributeId,val);
		}
	}
};