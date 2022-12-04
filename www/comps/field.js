import MyCalendar             from './calendar.js';
import MyChart                from './chart.js';
import MyGantt                from './gantt.js';
import MyInputDate            from './inputDate.js';
import MyInputFiles           from './inputFiles.js';
import MyInputLogin           from './inputLogin.js';
import MyInputRichtext        from './inputRichtext.js';
import MyList                 from './list.js';
import {hasAccessToAttribute} from './shared/access.js';
import {srcBase64}            from './shared/image.js';
import {
	getLinkMeta,
	getNilUuid,
	openLink
} from './shared/generic.js';
import {
	getFlexStyle,
	getInputFieldName,
	setGetterArgs
} from './shared/form.js';
import {
	getQueryColumnsProcessed,
	getQueryFiltersProcessed
} from './shared/query.js';
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
					v-if="focused || value !== null || isBoolean || isDateInput || isSlider || isRichtext || isCategory || isRelationship || isFiles"
					:class="{ invalid:showInvalid }"
				>{{ caption }}</div>
				
				<div class="input-line">
					
					<!-- data field icon -->
					<img class="field-icon"
						v-if="iconId && !isRelationship && !isFiles"
						:src="srcBase64(iconIdMap[iconId].file)"
					/>
					
					<!-- encryption indicator -->
					<img class="field-icon" src="images/lock.png"
						v-if="isEncrypted"
						:title="capApp.dialog.encrypted"
					/>
					
					<!-- regular text line input (numeric, strings, etc.) -->
					<input class="input"
						v-if="isLineInput"
						v-model="value"
						@blur="blur"
						@focus="focus"
						@click="click"
						:class="{ invalid:showInvalid }"
						:disabled="isReadonly"
						:placeholder="!focused ? caption : ''"
						:type="!isPassword || showPassword ? 'text' : 'password'"
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
						:countAllowed="field.max !== null ? field.max : 0"
						:fieldId="field.id"
						:formLoading="formLoading"
						:readonly="isReadonly"
						:recordId="joinsIndexMap[field.index].recordId"
						:showGallery="field.display === 'gallery'"
					>
						<template #input-icon>
							<img class="field-icon"
								v-if="iconId"
								:src="srcBase64(iconIdMap[iconId].file)"
							/>
						</template>
					</my-input-files>
					
					<!-- relationship input -->
					<my-list
						v-if="isRelationship"
						@blurred="blur"
						@focused="focus"
						@open-form="(...args) => openForm(args[0],[],args[1])"
						@record-selected="relationshipRecordSelected"
						@record-removed="relationshipRecordRemoved"
						@records-selected-init="$emit('set-value-init',fieldAttributeId,$event,true,true)"
						:choices="choicesProcessed"
						:columns="columnsProcessed"
						:fieldId="field.id"
						:filterQuick="field.filterQuick"
						:filters="filtersProcessed"
						:formLoading="formLoading"
						:header="false"
						:inputAsCategory="field.category"
						:inputAutoSelect="field.autoSelect"
						:inputIsNew="isNew"
						:inputIsReadonly="isReadonly"
						:inputMulti="isRelationship1N"
						:inputOpenForm="field.openForm !== null"
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
					
					<!-- copy to clipboard action -->
					<my-button image="copyClipboard.png"
						v-if="isClipboard && !isFiles"
						@trigger="copyToClipboard"
						:active="value !== null"
						:captionTitle="capGen.button.copyClipboard"
						:naked="true"
					/>
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
			:active="!isReadonly"
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
			@clipboard="$emit('clipboard')"
			@open-form="(...args) => openForm(args[0],[],args[1])"
			@record-selected="(...args) => openForm(args[0],[],args[1])"
			@set-args="(...args) => $emit('set-form-args',...args)"
			@set-collection-indexes="setCollectionIndexes"
			:allowPaging="field.query.fixedLimit === 0"
			:autoRenew="field.autoRenew"
			:choices="choicesProcessed"
			:collections="field.collections"
			:columns="columnsProcessed"
			:csvExport="field.csvExport"
			:csvImport="field.csvImport"
			:fieldId="field.id"
			:filterQuick="field.filterQuick"
			:filters="filtersProcessed"
			:formLoading="formLoading"
			:iconId="iconId ? iconId : null"
			:isSingleField="formIsSingleField"
			:layout="field.layout"
			:limitDefault="field.query.fixedLimit === 0 ? field.resultLimit : field.query.fixedLimit"
			:query="field.query"
			:rowSelect="field.openForm !== null"
			:usesPageHistory="formIsSingleField && !formIsPopUp"
		/>
		
		<!-- calendar -->
		<my-calendar
			v-if="isCalendar && !field.gantt"
			@open-form="(...args) => openForm(args[0],args[1],args[2])"
			@record-selected="(...args) => openForm(args[0],args[1],args[2])"
			@set-args="(...args) => $emit('set-form-args',...args)"
			@set-collection-indexes="setCollectionIndexes"
			:attributeIdColor="field.attributeIdColor"
			:attributeIdDate0="field.attributeIdDate0"
			:attributeIdDate1="field.attributeIdDate1"
			:choices="choicesProcessed"
			:columns="columnsProcessed"
			:collections="field.collections"
			:fieldId="field.id"
			:filters="filtersProcessed"
			:formLoading="formLoading"
			:iconId="iconId ? iconId : null"
			:ics="field.ics"
			:indexColor="field.indexColor"
			:indexDate0="field.indexDate0"
			:indexDate1="field.indexDate1"
			:query="field.query"
			:rowSelect="field.openForm !== null"
			:usesPageHistory="formIsSingleField && !formIsPopUp"
		/>
		
		<!-- gantt -->
		<my-gantt
			v-if="isCalendar && field.gantt"
			@open-form="(...args) => openForm(args[0],args[1],args[2])"
			@record-selected="(...args) => openForm(args[0],args[1],args[2])"
			@set-args="(...args) => $emit('set-form-args',...args)"
			@set-collection-indexes="setCollectionIndexes"
			:attributeIdColor="field.attributeIdColor"
			:attributeIdDate0="field.attributeIdDate0"
			:attributeIdDate1="field.attributeIdDate1"
			:choices="choicesProcessed"
			:columns="columnsProcessed"
			:collections="field.collections"
			:fieldId="field.id"
			:days0="field.dateRange0 / 86400"
			:days1="field.dateRange1 / 86400"
			:filters="filtersProcessed"
			:formLoading="formLoading"
			:iconId="iconId ? iconId : null"
			:indexColor="field.indexColor"
			:indexDate0="field.indexDate0"
			:indexDate1="field.indexDate1"
			:rowSelect="field.openForm !== null"
			:stepTypeDefault="field.ganttSteps"
			:stepTypeToggle="field.ganttStepsToggle"
			:query="field.query"
			:usesPageHistory="formIsSingleField && !formIsPopUp"
		/>
		
		<!-- chart -->
		<my-chart
			v-if="isChart"
			:choices="choicesProcessed"
			:columns="columnsProcessed"
			:filters="filtersProcessed"
			:formLoading="formLoading"
			:isSingleField="formIsSingleField"
			:limit="field.query.fixedLimit"
			:optionJson="field.chartOption"
			:query="field.query"
		/>
		
		<!-- tabs -->
		<div class="tabs" v-if="isTabs">
			<div class="tabs-entries">
				<div class="tabs-entry" v-for="(t,i) in field.tabs" @click="tabIndexShow = i">
					{{ t.captions.tabTitle[this.moduleLanguage] }}
				</div>
			</div>
			<template v-for="(t,i) in field.tabs.filter((v,i) => i === tabIndexShow)">
				<my-field
					v-for="f in t.fields"
					@clipboard="$emit('clipboard')"
					@execute-function="$emit('execute-function',$event)"
					@hotkey="$emit('hotkey',$event)"
					@open-form="(...args) => $emit('open-form',...args)"
					@set-form-args="(...args) => $emit('set-form-args',...args)"
					@set-valid="(...args) => $emit('set-valid',...args)"
					@set-value="(...args) => $emit('set-value',...args)"
					@set-value-init="(...args) => $emit('set-value-init',...args)"
					:dataFieldMap="dataFieldMap"
					:field="f"
					:fieldIdMapCaption="fieldIdMapCaption"
					:fieldIdMapState="fieldIdMapState"
					:formBadSave="formBadSave"
					:formIsPopUp="formIsPopUp"
					:formIsSingleField="formIsSingleField"
					:formLoading="formLoading"
					:formReadonly="formReadonly"
					:flexDirParent="'column'"
					:joinsIndexMap="joinsIndexMap"
					:key="f.id"
					:values="values"
				/>
			</template>
		</div>
		
		<!-- container children -->
		<my-field
			v-if="isContainer"
			v-for="f in field.fields"
			@clipboard="$emit('clipboard')"
			@execute-function="$emit('execute-function',$event)"
			@hotkey="$emit('hotkey',$event)"
			@open-form="(...args) => $emit('open-form',...args)"
			@set-form-args="(...args) => $emit('set-form-args',...args)"
			@set-valid="(...args) => $emit('set-valid',...args)"
			@set-value="(...args) => $emit('set-value',...args)"
			@set-value-init="(...args) => $emit('set-value-init',...args)"
			:dataFieldMap="dataFieldMap"
			:field="f"
			:fieldIdMapCaption="fieldIdMapCaption"
			:fieldIdMapState="fieldIdMapState"
			:formBadSave="formBadSave"
			:formIsPopUp="formIsPopUp"
			:formIsSingleField="formIsSingleField"
			:formLoading="formLoading"
			:formReadonly="formReadonly"
			:flexDirParent="field.direction"
			:joinsIndexMap="joinsIndexMap"
			:key="f.id"
			:values="values"
		/>
	</div>`,
	props:{
		dataFieldMap:     { type:Object,  required:true },
		field:            { type:Object,  required:true },
		fieldIdMapCaption:{ type:Object,  required:false, default:() => {return {}} }, // overwritten captions
		fieldIdMapState:  { type:Object,  required:false, default:() => {return {}} }, // overwritten states
		formBadSave:      { type:Boolean, required:true }, // attempted save with invalid inputs
		formIsPopUp:      { type:Boolean, required:true }, // parent form is a pop-up form
		formIsSingleField:{ type:Boolean, required:true }, // parent form contains a single field
		formLoading:      { type:Boolean, required:true },
		formReadonly:     { type:Boolean, required:true }, // form is read only, disable all inputs
		flexDirParent:    { type:String,  required:true }, // flex direction (row/column) of parent
		joinsIndexMap:    { type:Object,  required:true },
		logViewer:        { type:Boolean, required:false, default:false }, // is part of log viewer
		values:           { type:Object,  required:true }
	},
	emits:[
		'clipboard','execute-function','hotkey','open-form','set-form-args',
		'set-valid','set-value','set-value-init'
	],
	data:function() {
		return {
			collectionIdMapIndexes:{},  // active record indexes of collection, used to filter with
			focused:false,
			notTouched:true,            // data field was not touched by user
			showColorPickerInput:false, // for color picker fields
			showPassword:false,         // for password fields
			tabIndexShow:0
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
			return !this.isData || typeof this.attributeIdMap[this.field.attributeId] === 'undefined'
				? false : this.attributeIdMap[this.field.attributeId];
		},
		caption:function() {
			let out = '';
			
			if(typeof this.fieldIdMapCaption[this.field.id] !== 'undefined') {
				// 1st preference: field caption overwrite
				out = this.fieldIdMapCaption[this.field.id];
			}
			else if(typeof this.field.captions.fieldTitle[this.moduleLanguage] !== 'undefined') {
				// 2nd preference: field caption
				out = this.field.captions.fieldTitle[this.moduleLanguage];
			}
			else if(this.attribute) {
				// 3rd / 4th preference: dedicated attribute title / name
				if(typeof this.attribute.captions.attributeTitle[this.moduleLanguage] !== 'undefined')
					out = this.attribute.captions.attributeTitle[this.moduleLanguage];
				else
					out = this.attribute.name;
			}
			
			// if empty: mark as missing
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
				if(this.isString) return this.capGen.inputShort.replace('{MIN}',this.field.min);
				if(this.isFiles)  return this.capGen.inputTooFewFiles;
				return this.capGen.inputSmall.replace('{MIN}',this.field.min);
			}
			if(!this.isValidMax) {
				if(this.isString) return this.capGen.inputLong.replace('{MAX}',this.field.max);
				if(this.isFiles)  return this.capGen.inputTooManyFiles;
				return this.capGen.inputLarge.replace('{MAX}',this.field.max);
			}
			
			if(this.isDecimal)     return this.capGen.inputDecimal;
			if(this.isRequired)    return this.capGen.inputRequired;
			if(!this.isValidValue) return this.capGen.inputInvalid; // generic error
			return '';
		},
		captionHelp:function() {
			return typeof this.field.captions.fieldHelp[this.moduleLanguage] !== 'undefined'
				? this.field.captions.fieldHelp[this.moduleLanguage] : '';
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
			
			if(this.isTextarea || this.isRichtext || this.isFiles)
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
			
			return this.getQueryColumnsProcessed(this.field.columns,
				this.dataFieldMap,this.joinsIndexMap,this.values);
		},
		choicesProcessed:function() {
			if(!this.isQuery) return [];
			
			let choices = JSON.parse(JSON.stringify(this.field.query.choices));
			for(let i = 0, j = choices.length; i < j; i++) {
				choices[i].filters = this.getQueryFiltersProcessed(
					choices[i].filters,
					this.dataFieldMap,
					this.joinsIndexMap,
					this.values,
					[],
					this.collectionIdMapIndexes
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
				this.values,
				[],
				this.collectionIdMapIndexes
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
			return !this.isData
				? false : this.getLinkMeta(this.field.display,this.value);
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
			// optional: data field only, input is optional
			// required: data field only, input is required
			// readonly: data or button field, input is readonly
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
			
			// overwrite visible data field to readonly if form could not load record
			if(this.isData && this.formReadonly && state !== 'hidden')
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
			
			// check join of field attribute
			let join = this.joinsIndexMap[this.field.index];
			if(join.recordNoSet)    return false;            // SET denied on join due to relation policy
			if(join.recordId !== 0) return join.applyUpdate; // SET dependent on join allowing record update
			
			// field attribute relation has no record ID
			// collect relationship chain until source relation
			let indexChain = [join.index];
			for(let index = join.indexFrom; index !== -1; index = this.joinsIndexMap[index].indexFrom) {
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
			if(!this.inputCanWrite                           // cannot write
				|| this.attribute.nullable                   // value optional
				|| this.isRelationship1N                     // 0...n partners (optional)
				|| (this.isNew && this.attribute.def !== '') // new record and has defaults
			) return false;
			
			return true;
		},
		inputCheckRegex:function() {
			return !this.isData || this.field.regexCheck === null
				? null : new RegExp(this.field.regexCheck);
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
			
			if(this.isFiles && typeof this.value.fileCount !== 'undefined')
				return this.value.fileCount >= this.field.min;
			
			if(this.isFiles)
				return this.value.length >= this.field.min;
			
			return true;
		},
		isValidMax:function() {
			if(!this.isData || this.value === null || this.field.max === null)
				return true;
			
			if((this.isDecimal || this.isInteger) && this.value > this.field.max)
				return false;
				
			if(this.isString && this.value.length > this.field.max)
				return false;
			
			if(this.isFiles && typeof this.value.fileCount !== 'undefined')
				return this.value.fileCount <= this.field.max;
			
			if(this.isFiles)
				return this.value.length <= this.field.max;
			
			return true;
		},
		
		// simple
		showInvalid:function() { return !this.isValid && (this.formBadSave || !this.notTouched) },
		
		// content
		isButton:   function() { return this.field.content === 'button'; },
		isCalendar: function() { return this.field.content === 'calendar'; },
		isChart:    function() { return this.field.content === 'chart'; },
		isContainer:function() { return this.field.content === 'container'; },
		isData:     function() { return this.field.content === 'data'; },
		isList:     function() { return this.field.content === 'list'; },
		isTabs:     function() { return this.field.content === 'tabs'; },
		
		// display
		isHidden:  function() { return this.stateFinal === 'hidden'; },
		isReadonly:function() { return this.stateFinal === 'readonly'; },
		isRequired:function() { return this.stateFinal === 'required'; },
		
		// display options
		isColor:   function() { return this.isData && this.field.display === 'color'; },
		isDate:    function() { return this.isData && this.field.display === 'date'; },
		isDatetime:function() { return this.isData && this.field.display === 'datetime'; },
		isLogin:   function() { return this.isData && this.field.display === 'login'; },
		isPassword:function() { return this.isData && this.field.display === 'password'; },
		isSlider:  function() { return this.isData && this.field.display === 'slider'; },
		isTime:    function() { return this.isData && this.field.display === 'time'; },
		isTextarea:function() { return this.isData && this.field.display === 'textarea'; },
		isRichtext:function() { return this.isData && this.field.display === 'richtext'; },
		
		// composite
		isActive:   function() { return !this.isMobile || this.field.onMobile; },
		isEncrypted:function() { return this.isData && this.attribute.encrypted; },
		isNew:      function() { return this.isData && this.joinsIndexMap[this.field.index].recordId === 0; },
		isBoolean:  function() { return this.isData && this.isAttributeBoolean(this.attribute.content); },
		isCategory: function() { return this.isData && this.isRelationship && this.field.category; },
		isClipboard:function() { return this.isData && this.field.clipboard && !this.isFiles && !this.isRelationship; },
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
		moduleLanguage:function() { return this.$store.getters.moduleLanguage; }
	},
	methods:{
		// externals
		getFlexStyle,
		getIndexAttributeId,
		getInputFieldName,
		getLinkMeta,
		getNilUuid,
		getQueryColumnsProcessed,
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
		copyToClipboard:function() {
			navigator.clipboard.writeText(this.value);
			this.$emit('clipboard');
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
		openForm:function(recordId,getters,middleClick) {
			
			// set defaults
			if(typeof recordId    === 'undefined') recordId    = 0;
			if(typeof getters     === 'undefined') getters     = [];
			if(typeof middleClick === 'undefined') middleClick = false;
			
			// apply record from defined relation index as attribute value via getter
			if(this.field.openForm.attributeIdApply !== null
				&& typeof this.joinsIndexMap[this.field.openForm.relationIndex] !== 'undefined'
				&& this.joinsIndexMap[this.field.openForm.relationIndex].recordId !== 0) {
				
				let atrId    = this.field.openForm.attributeIdApply;
				let recordId = this.joinsIndexMap[this.field.openForm.relationIndex].recordId;
				
				getters = this.setGetterArgs(getters,'attributes',`${atrId}_${recordId}`);
			}
			
			// apply source field ID
			let options = JSON.parse(JSON.stringify(this.field.openForm));
			options.fieldId = this.field.id;
			
			this.$emit('open-form',recordId,options,getters,middleClick);
		},
		relationshipRecordSelected:function(recordId,middleClick) {
			if(recordId === null)
				return this.value = null;
			
			if(!this.isRelationship1N)
				return this.value = recordId;
			
			let v = this.value === null ? [] : this.value;
			v.push(recordId);
			this.value = v;
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
		setCollectionIndexes:function(collectionId,indexes) {
			if(indexes.length === 0) delete(this.collectionIdMapIndexes[collectionId]);
			else                     this.collectionIdMapIndexes[collectionId] = indexes;
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
			
			if(this.field.jsFunctionId !== null)
				this.$emit('execute-function',this.field.jsFunctionId);
		},
		triggerButton:function(middleClick) {
			if(this.field.openForm !== null)
				this.openForm(0,[],middleClick);
			
			if(this.field.jsFunctionId !== null)
				this.$emit('execute-function',this.field.jsFunctionId);
		}
	}
};