import MyArticles                    from './articles.js';
import MyField                       from './field.js';
import MyFormActions                 from './formActions.js';
import MyFormLog                     from './formLog.js';
import {getAttributeFileVersionHref} from './shared/attribute.js';
import {getCollectionValues}         from './shared/collection.js';
import {getColumnsProcessed}         from './shared/column.js';
import {dialogCloseAsk}              from './shared/dialog.js';
import {consoleError}                from './shared/error.js';
import {jsFunctionRun}               from './shared/jsFunction.js';
import {srcBase64}                   from './shared/image.js';
import {getCaption}                  from './shared/language.js';
import {layoutSettleSpace}           from './shared/layout.js';
import {
	isAttributeRelationship,
	isAttributeRelationshipN1,
	getAttributeValueFromString,
	getDetailsFromIndexAttributeId,
	getGetterFromAttributeValues,
	getIndexAttributeId,
	getIndexAttributeIdByField
} from './shared/attribute.js';
import {
	aesGcmDecryptBase64WithPhrase,
	aesGcmEncryptBase64WithPhrase,
	getRandomString,
	pemImport,
	rsaDecrypt,
	rsaEncrypt
} from './shared/crypto.js';
import {
	getFieldOverwriteDefault,
	getFieldProcessedDefault
} from './shared/field.js';
import {
	filterIsCorrect,
	filterOperatorIsSingleValue,
	openLink
} from './shared/generic.js';
import {
	getDataFieldMap,
	getFormPopUpConfig,
	getFormRoute,
	getFormStateIdMap,
	getResolvedPlaceholders,
	getRowsDecrypted
} from './shared/form.js';
import {
	fillRelationRecordIds,
	getJoinIndexMapExpanded,
	getQueryAttributePkFilter,
	getQueryFiltersProcessed,
	getRelationsJoined
} from './shared/query.js';
import {
	variableValueGet,
	variableValueSet
} from './shared/variable.js';

export default {
	name:'my-form',
	components:{
		MyArticles,
		MyField,
		MyFormActions,
		MyFormLog
	},
	template:`<div class="form-wrap"
		:class="{ float:isPopUpFloating, fullscreen:popUpFullscreen, popUp:isPopUp }"
		:key="form.id"
		:style="bgStyle"
	>
		<!-- pop-up form -->
		<div class="app-sub-window under-header"
			v-if="popUp !== null"
			@mousedown.left.self="$refs.popUpForm.closeAsk()"
		>
			<my-form ref="popUpForm"
				@close="closePopUp"
				@pop-up-replace="popUpReplace"
				@refresh-parent="popUpFormUpdate('nothing',null)"
				@record-deleted="popUpFormUpdate('deleted',$event)"
				@record-updated="popUpFormUpdate('updated',$event)"
				@records-open="popUp.recordIds = $event"
				:attributeIdMapDef="popUp.attributeIdMapDef"
				:formId="popUp.formId"
				:isPopUp="true"
				:isPopUpFloating="true"
				:moduleId="popUp.moduleId"
				:recordIds="popUp.recordIds"
				:style="popUp.style"
			/>
		</div>
		
		<!-- form proper -->
		<div class="form contentBox grow scroll"
			v-if="!isMobile || (!showLog && !showHelp)"
			:class="{ float:isPopUpFloating }"
		>
			<!-- title bar upper -->
			<div class="top nowrap" :class="{ lower:!hasBarLower && !isSingleField }" v-if="!isWidget">
				<div class="area nowrap form-title-wrap">
					<my-button image="upward.png"
						v-if="buttonGoBackShown"
						@trigger="openPrevAsk"
						:active="buttonGoBackUsable"
						:captionTitle="capGen.button.goBack"
					/>
					<img class="icon" :src="iconSrc" />
					
					<!-- form title / message -->
					<transition name="fade" mode="out-in">
						<h1 v-if="title !== '' && message === null" class="title">{{ title }}</h1>
						<h1 class="form-message" v-else-if="message !== null">{{ message }}</h1>
					</transition>
				</div>

				<my-form-actions
					v-if="!hasBarLower && hasFormActions"
					@execute-function="jsFunctionRun($event,[],exposedFunctions)"
					:entityIdMapEffect="entityIdMapEffect"
					:formActions="form.actions"
					:formId
					:moduleId
					:noSpace="!layoutElements.includes('formActions')"
				/>
				
				<div class="form-bar-layout-check" ref="formBarUpperCheck" />
				<div class="area nowrap">
					<template v-if="isData && !isBulkUpdate">
						<my-button image="refresh.png"
							v-if="!isMobile"
							@trigger="get"
							@trigger-middle="openForm(recordIds,null,null,true)"
							:active="!isNew"
							:captionTitle="capGen.button.refreshHint"
						/>
						<my-button image="time.png"
							v-if="hasLog"
							@trigger="toggleLog"
							:active="!isNew"
							:captionTitle="capApp.button.logHint"
						/>
					</template>
					
					<my-button image="star1.png"
						v-if="!isBulkUpdate && !isNoAuth"
						@trigger="makeFavorite"
						:active="!isAtFavoritesEdit"
						:captionTitle="capApp.button.favorite"
					/>
					<my-button image="link.png"
						v-if="isPopUp && !isBulkUpdate && !isMobile"
						@trigger="copyFormUrlToClipboard(false)"
						@trigger-middle="copyFormUrlToClipboard(true)"
						:captionTitle="capApp.button.urlHint"
					/>
					<my-button image="question.png"
						v-if="hasHelp"
						@trigger="toggleHelp"
						:active="helpAvailable"
						:captionTitle="capApp.button.helpHint"
					/>
					<my-button
						v-if="isPopUp && !isMobile"
						@trigger="popUpFullscreen = !popUpFullscreen"
						:captionTitle="capApp.button.fullscreenHint"
						:image="popUpFullscreen ? 'shrink.png' : 'expand.png'"
					/>
					<my-button image="builder.png"
						v-if="isAdmin && builderEnabled && !isMobile"
						@trigger="openBuilder(false)"
						@trigger-middle="openBuilder(true)"
						:captionTitle="capGen.button.openBuilder"
					/>
					<my-button image="cancel.png"
						v-if="isPopUp"
						@trigger="closeAsk"
						:cancel="true"
						:captionTitle="capGen.button.close"
					/>
				</div>
			</div>
			
			<!-- title bar lower -->
			<div class="top lower nowrap" v-if="hasBarLower">
				<div class="area nowrap">
					<my-button image="new.png"
						v-if="buttonNewShown"
						@trigger="openNewAsk(false)"
						@trigger-middle="openNewAsk(true)"
						:active="buttonNewUsable"
						:caption="layoutElements.includes('dataActionLabels') ? capGen.button.new : ''"
						:captionTitle="capGen.button.newHint"
					/>
					<my-button-group
						v-if="buttonSaveShown"
						:group="buttonGroupSave"
					/>
					<my-button image="save.png"
						v-if="buttonSaveShownBulk"
						@trigger="setBulkUpdate"
						:active="buttonSaveUsableBulk"
						:caption="layoutElements.includes('dataActionLabels') ? capGen.button.saveBulk.replace('{COUNT}',String(recordIds.length)) : ''"
						:captionTitle="capGen.button.saveHint"
					/>
					<my-button image="warning.png"
						v-if="badSave && fieldIdsInvalid.length !== 0"
						@trigger="scrollToInvalidField"
						:caption="capGen.inputRequired"
						:cancel="true"
					/>
					<my-button image="warning.png"
						v-if="badLoad"
						:caption="capApp.noAccess"
						:cancel="true"
					/>
				</div>
				<my-form-actions
					v-if="hasFormActions"
					@execute-function="jsFunctionRun($event,[],exposedFunctions)"
					:entityIdMapEffect="entityIdMapEffect"
					:formActions="form.actions"
					:formId
					:moduleId
					:noSpace="!layoutElements.includes('formActions')"
				/>
				<div class="form-bar-layout-check" ref="formBarLowerCheck" />
				<div class="area">
					<my-button-group
						v-if="buttonDelShown"
						:group="buttonGroupDelete"
					/>
				</div>
			</div>
			
			<!-- title bar widget -->
			<div class="top lower" v-if="hasBarWidget">
				<my-form-actions
					@execute-function="jsFunctionRun($event,[],exposedFunctions)"
					:entityIdMapEffect="entityIdMapEffect"
					:formActions="form.actions"
					:formId
					:moduleId
					:noSpace="false"
				/>
			</div>
			
			<!-- form fields -->
			<div class="content grow fields" ref="fields"
				:class="{ onlyOne:isSingleField }"
				:style="isWidget ? '' : patternStyle"
			>
				<my-field flexDirParent="column"
					v-for="(f,i) in fields"
					@clipboard="messageSet('[CLIPBOARD]')"
					@execute-function="jsFunctionRun($event,[],exposedFunctions)"
					@open-form="openForm"
					@set-form-args="setFormArgs"
					@set-touched="fieldSetTouched"
					@set-valid="fieldSetValid"
					@set-value="valueSetByField"
					:isBulkUpdate
					:entityIdMapEffect
					:favoriteId="favoriteId"
					:field="f"
					:fieldIdsChanged
					:fieldIdsInvalid
					:fieldIdsTouched
					:fieldIdMapOverwrite
					:fieldIdMapOptions
					:fieldIdMapProcessed
					:formBadSave="badSave"
					:formBlockInputs="blockInputs"
					:formIsEmbedded="isPopUp || isWidget"
					:formLoading="loading"
					:isAloneInForm="isSingleField"
					:joinsIndexMap
					:key="f.id"
					:moduleId="moduleId"
					:values="values"
					:variableIdMapLocal
				/>
			</div>
		</div>
		
		<!-- form change logs -->
		<my-form-log
			v-if="showLog"
			@close-log="toggleLog"
			:entityIdMapEffect
			:fieldIdMapData
			:fieldIdMapProcessed
			:formLoading="loading"
			:isPopUpFloating
			:indexMapRecordKey
			:joinsIndexMap
			:moduleId
			:values
			:variableIdMapLocal
		/>
		
		<!-- form help articles -->
		<my-articles class="form-help"
			v-if="showHelp"
			@close="toggleHelp"
			:form="form"
			:isFloat="isPopUpFloating"
			:moduleId="moduleId"
		/>
	</div>`,
	props:{
		attributeIdMapDef:{ type:Object,  required:false, default:() => {return {};} }, // map of attribute default values
		favoriteId:       { required:false, default:null },
		formId:           { type:String,  required:true },
		hasHelp:          { type:Boolean, required:false, default:true },
		hasLog:           { type:Boolean, required:false, default:true },
		isPopUp:          { type:Boolean, required:false, default:false }, // form pop-ups from another element (either floating or inline)
		isPopUpFloating:  { type:Boolean, required:false, default:false }, // this form is a floating pop-up
		isWidget:         { type:Boolean, required:false, default:false },
		moduleId:         { type:String,  required:true },
		recordIds:        { type:Array,   required:true },                 // to be handled records, [] is new
		showButtonDel:    { type:Boolean, required:false, default:true },
		showButtonNew:    { type:Boolean, required:false, default:true }
	},
	emits:['close','pop-up-replace','record-deleted','record-updated','records-open','refresh-parent'],
	mounted() {
		this.$watch('appResized',() => this.resized());
		this.$watch(() => [this.favoriteId,this.formId,this.recordIds],this.reset,{
			immediate:true
		});
		
		if(!this.isWidget)
			this.$store.commit('routingGuardAdd',this.routingGuard);
		
		window.addEventListener('keydown',this.handleHotkeys);
		this.resized(null,0);
		this.$store.commit('dropdownElm',null);
	},
	unmounted() {
		if(!this.isWidget)
			this.$store.commit('routingGuardDel',this.routingGuard);
		
		window.removeEventListener('keydown',this.handleHotkeys);
		this.timerClearAll();
	},
	data() {
		return {
			// states
			badLoad:false,          // attempted record load with no return (can happen if access is lost during save)
			badSave:false,          // attempted save (data SET) with invalid fields, also updates data fields
			blockInputs:false,      // disable all user inputs (used by frontend functions)
			changingRecord:false,   // form is currently attempting to change the current record (saving/deleting)
			firstLoad:true,         // form was not used before
			lastFormId:'',          // when routing occurs: if ID is the same, no need to rebuild form
			layoutCheckTimer:null,  // layout resize timer
			layoutElements:[],        // elements that are shown, based on available space
			layoutElementsAvailable:[ // elements that can be shown, in order of priority
				'formActions',        // form action as buttons
				'dataActionLabels',   // data action labels
				'dataActionReadonly'  // data actions if inactive
			],
			loading:false,          // form is currently loading, informs sub components when form is ready
			message:null,           // form message
			messageTimeout:null,    // form message expiration timeout
			popUp:null,             // configuration for pop-up form (float)
			popUpFieldIdSrc:null,   // ID of field that pop-up form originated from
			popUpFullscreen:false,  // set this pop-up form to fullscreen mode
			recordActionFree:false, // set by DEL/SET calls before form functions, which can negate it to block following record actions
			showHelp:false,         // show form context help
			showLog:false,          // show data change log
			titleOverwrite:null,    // custom form title, can be set via frontend function
			
			// form data
			fieldIdsInvalid:[],           // field IDs with invalid values
			fieldIdsTouched:[],           // field IDs that were touched (changed their value in some way)
			fieldIdMapOverwrite:{         // overwrites for fields
				caption:{}, chart:{}, error:{}, order:{}
			},
			indexMapRecordId:{},          // record IDs for form, key: relation index
			indexMapRecordKey:{},         // record en-/decryption keys, key: relation index
			indexesNoDel:[],              // relation indexes with no DEL permission (via relation policy)
			indexesNoSet:[],              // relation indexes with no SET permission (via relation policy)
			loginIdsEncryptFor:[],        // login IDs for which data keys are encrypted (e2ee), for current form relations/records
			loginIdsEncryptForOutside:[], // login IDs for which data keys are encrypted (e2ee), for outside relation and record IDs
			                              // [{loginIds:[5,12], recordIds:[1,2], relationId:'A-B-C-D'}, {...}]
			timers:{},                    // frontend function timers, key = name, value = { id:XY, isInterval:true }
			valuesNew:{},                 // changed values by index attribute ID (for sending changes)
			valuesOld:{},                 // preexisting values by index attribute ID (for change comparison)
			variableIdMapLocal:{}         // variable values by ID (form assigned variables only)
		};
	},
	computed:{
		// field values, key: index attribute ID
		values:   (s) => { return { ...s.valuesDef, ...s.valuesNew }; }, // current values by index attribute ID
		valuesOrg:(s) => { return { ...s.valuesDef, ...s.valuesOld }; }, // original values by index attribute ID
		valuesDef:(s) => {
			let out = {};
			let parseFields = (fields) => {
				for(const f of fields) {
					if(f.content === 'container') {
						parseFields(f.fields);
						continue;
					}
					if(f.content === 'tabs') {
						for(let t of f.tabs) {
							parseFields(t.fields);
						}
						continue;
					}
					
					if(f.content !== 'data')
						continue;
					
					// apply data field default value
					let def              = null;
					let attribute        = s.attributeIdMap[f.attributeId];
					let indexAttributeId = s.getIndexAttributeIdByField(f,false);
					let isRelationship   = s.isAttributeRelationship(attribute.content);
					let isRelationshipN1 = s.isAttributeRelationshipN1(attribute.content);
					let isRelMulti       = isRelationship && f.attributeIdNm !== null || (f.outsideIn && isRelationshipN1);
					
					if(f.def !== '')
						def = s.getAttributeValueFromString(
							attribute.content,
							s.getResolvedPlaceholders(f.def));
					
					if(f.defCollection !== null)
						def = s.getCollectionValues(
							f.defCollection.collectionId,
							f.defCollection.columnIdDisplay,
							!isRelMulti
						);
					
					if(isRelationship && f.defPresetIds.length > 0) {
						if(!isRelMulti) {
							def = s.presetIdMapRecordId[f.defPresetIds[0]];
						}
						else {
							def = [];
							for(let i = 0, j = f.defPresetIds.length; i < j; i++) {
								def.push(s.presetIdMapRecordId[f.defPresetIds[i]]);
							}
						}
					}
					
					out[indexAttributeId] = def;
					
					// set value and default for altern. field attribute
					if(f.attributeIdAlt !== null)
						out[s.getIndexAttributeId(f.index,f.attributeIdAlt,false,null)] = null;
				}
			};
			parseFields(s.fields);

			// apply default values, set for attributes (usually via getters/arguments)
			for(let k in out) {
				const d = s.getDetailsFromIndexAttributeId(k);
				
				if(s.attributeIdMapDef[d.attributeId] !== undefined) {
					out[k] = d.outsideIn && s.isAttributeRelationshipN1(s.attributeIdMap[d.attributeId].content)
						? [s.attributeIdMapDef[d.attributeId]] : s.attributeIdMapDef[d.attributeId];
				}
				
				if(s.attributeIdMapDef[d.attributeIdNm] !== undefined)
					out[k] = [s.attributeIdMapDef[d.attributeIdNm]];
			}
			return out;
		},

		// simple
		bgStyle:       (s) => s.isPopUp || s.isWidget ? '' : `background-color:${s.colorMenu.toString()};`,
		hasBarLower:   (s) => !s.isWidget && s.isData && !s.form.noDataActions,
		hasBarWidget:  (s) => s.isWidget && s.hasFormActions,
		hasChanges:    (s) => s.fieldIdsChanged.length !== 0,
		hasChangesBulk:(s) => s.fieldIdsTouched.length !== 0 && s.isBulkUpdate,
		hasFormActions:(s) => s.form.actions.filter(v => (s.entityIdMapEffect.formAction[v.id]?.state !== undefined ? s.entityIdMapEffect.formAction[v.id].state : v.state) !== 'hidden').length > 0,
		helpAvailable: (s) => s.form.articleIdsHelp.length !== 0 || s.moduleIdMap[s.moduleId].articleIdsHelp.length !== 0,
		isBulkUpdate:  (s) => s.isData && s.recordIds.length > 1,
		isData:        (s) => s.relationId !== null,
		isNew:         (s) => s.recordIds.length === 0,
		isSingleField: (s) => s.fields.length === 1 && ['calendar','chart','kanban','list','tabs','variable'].includes(s.fields[0].content),
		menuActive:    (s) => s.formIdMapMenu[s.form.id] === undefined ? null : s.formIdMapMenu[s.form.id],
		warnUnsaved:   (s) => s.hasChanges && !s.form.noDataActions && !s.blockInputs && s.settings.warnUnsaved,

		// permissions
		mayCreate:(s) => !s.badLoad && s.joinsIndexesCrt.length !== 0,
		mayDelete:(s) => !s.badLoad && s.joinsIndexesDel.length !== 0,
		mayNew:   (s) => !s.badLoad && s.joinsIndexesNew.length !== 0,
		mayUpdate:(s) => !s.badLoad && s.joinsIndexesSet.length !== 0,

		// buttons
		buttonDelShown:      (s) => !s.isBulkUpdate && s.showButtonDel && (s.buttonDelUsable || s.layoutElements.includes('dataActionReadonly')),
		buttonDelUsable:     (s) => !s.buttonsReadonly && s.mayDelete,
		buttonGoBackShown:   (s) => s.isData && !s.isMobile && !s.isPopUp,
		buttonGoBackUsable:  (s) => !s.buttonsReadonly && !s.isAtHistoryStart,
		buttonNewShown:      (s) => !s.isBulkUpdate && s.showButtonNew && (s.buttonNewUsable || s.layoutElements.includes('dataActionReadonly')),
		buttonNewUsable:     (s) => !s.buttonsReadonly && s.mayNew && (!s.isNew || s.hasChanges),
		buttonSaveShown:     (s) => !s.isBulkUpdate && (s.buttonSaveUsable     || s.layoutElements.includes('dataActionReadonly')),
		buttonSaveShownBulk: (s) => s.isBulkUpdate  && (s.buttonSaveUsableBulk || s.layoutElements.includes('dataActionReadonly')),
		buttonSaveShownClose:(s) => s.buttonSaveShown && !s.isAtHistoryStart && !s.isMobile,
		buttonSaveShownNew:  (s) => s.buttonSaveShown && s.buttonNewShown && !s.isMobile,
		buttonSaveUsable:    (s) => !s.buttonsReadonly && (s.mayUpdate || s.mayCreate)    && s.hasChanges,
		buttonSaveUsableBulk:(s) => !s.buttonsReadonly && (s.mayUpdate || s.isBulkUpdate) && s.hasChangesBulk,
		buttonsReadonly:     (s) => s.blockInputs || s.changingRecord,

		// general entities
		fieldIdMapData: (s) => s.getDataFieldMap(s.fields),
		fields:         (s) => s.form.fields,
		filters:        (s) => s.form.query.filters,
		form:           (s) => s.formIdMap[s.formId],
		formStateIdMap: (s) => s.getFormStateIdMap(s.form.states),
		joins:          (s) => s.fillRelationRecordIds(s.form.query.joins),
		relationId:     (s) => s.form.query.relationId,
		relationsJoined:(s) => s.getRelationsJoined(s.joins),
		joinsIndexMap:  (s) => s.getJoinIndexMapExpanded(s.joins,s.indexMapRecordId,s.indexesNoDel,s.indexesNoSet,s.entityIdMapEffect.form.data),
		joinsIndexesCrt:(s) => { return Object.values(s.joinsIndexMap).filter(v => v.recordCreate); },
		joinsIndexesDel:(s) => { return Object.values(s.joinsIndexMap).filter(v => v.recordDelete); },
		joinsIndexesNew:(s) => { return Object.values(s.joinsIndexMap).filter(v => v.recordNew); },
		joinsIndexesSet:(s) => { return Object.values(s.joinsIndexMap).filter(v => v.recordUpdate); },
		iconSrc:(s) => {
			if(s.favoriteId  !== null) return 'images/star1.png';
			if(s.form.iconId !== null) return s.srcBase64(s.iconIdMap[s.form.iconId].file);
			
			return s.menuActive !== null && s.menuActive.iconId !== null && s.menuActive.formId === s.form.id
				? s.srcBase64(s.iconIdMap[s.menuActive.iconId].file)
				: 'images/fileText.png';
		},
		fieldIdMapOptions:(s) => {
			const base = s.isMobile ? s.loginOptionsMobile : s.loginOptions;
			if(s.favoriteId === null)
				return base.fieldIdMap;

			return base.favoriteIdMap[s.favoriteId]?.fieldIdMap === undefined ? {} : base.favoriteIdMap[s.favoriteId].fieldIdMap;
		},
		
		// presentation
		buttonGroupDelete:(s) => {
			let group = [{
				caption:s.layoutElements.includes('dataActionLabels') ? s.capGen.button.delete : '',
				captionTitle:s.capGen.button.deleteHint,
				image:'shred.png',
				isCancel:true,
				isReadonly:!s.buttonDelUsable,
				onClickLeft:() => s.delAsk(false)
			}];
			if(!s.isMobile) {
				group.push({
					captionTitle:s.capGen.button.deleteNewHint,
					image:'add2.png',
					isCancel:true,
					isReadonly:!s.buttonDelUsable,
					onClickLeft:() => s.delAsk(true)
				});
			}
			return group;
		},
		buttonGroupSave:(s) => {
			let group = [{
				caption:s.layoutElements.includes('dataActionLabels') ? s.capGen.button.save : '',
				captionTitle:s.capGen.button.saveHint,
				image:'save.png',
				isReadonly:!s.buttonSaveUsable,
				onClickLeft:() => s.set(false,false)
			}];
			if(s.buttonSaveShownClose) {
				group.push({
					captionTitle:s.capGen.button.saveCloseHint,
					image:'ok.png',
					isReadonly:!s.buttonSaveUsable,
					onClickLeft:() => s.set(false,true)
				});
			}
			if(s.buttonSaveShownNew) {
				group.push({
					captionTitle:s.capGen.button.saveNewHint,
					image:'add2.png',
					isReadonly:!s.buttonSaveUsable,
					onClickLeft:() => s.set(true,false)
				});
			}
			return group;
		},
		title:(s) => {
			if(s.titleOverwrite !== null)
				return s.titleOverwrite;

			if(s.favoriteId !== null && s.loginFavorites.moduleIdMap[s.moduleId] !== undefined) {
				for(const f of s.loginFavorites.moduleIdMap[s.moduleId]) {
					if(f.id === s.favoriteId)
						return f.title;
				}
			}
			
			const formTitle = s.getCaption('formTitle',s.moduleId,s.formId,s.form.captions);
			if(formTitle !== '')
				return formTitle;
			
			if(s.menuActive !== null && s.menuActive.formId === s.form.id)
				return s.getCaption('menuTitle',s.moduleId,s.menuActive.id,s.menuActive.captions);
			
			return '';
		},
		
		// function overwrites
		exposedFunctions:(s) => {
			return {
				block_inputs: (v) => s.blockInputs = v,
				call_frontend:(id,...args) => s.jsFunctionRun(id,args,s.exposedFunctions),
				get_record_id:(relationIndex) => {
					// bulk forms do not retrieve record values, only base record IDs are available
					if(s.isBulkUpdate && relationIndex === 0)
						return s.recordIds;
					
					return typeof s.indexMapRecordId[relationIndex] !== 'undefined'
						? s.indexMapRecordId[relationIndex] : -1;
				},
				
				// form functions
				form_close:s.isPopUp ? s.closeAsk : s.openPrevAsk,
				form_open:(formId,recordId,newTab,popUp,maxY,maxX,replace) => {
					s.openForm((recordId === 0 || recordId === null ? [] : [recordId]),{
						formIdOpen:formId, popUpType:popUp ? 'float' : null,
						maxHeight:maxY, maxWidth:maxX
					},[],newTab,null,replace);
					s.recordActionFree = false;
				},
				form_parent_refresh:() => s.$emit('refresh-parent'),
				form_set_title:(v) => s.titleOverwrite = v,
				form_show_message:s.messageSet,
				
				// record functions
				record_delete:  () => { s.delAsk(false);    s.recordActionFree = false; },
				record_new:     () => { s.openNewAsk();     s.recordActionFree = false; },
				record_reload:  () => { s.get();            s.recordActionFree = false; },
				record_save:    () => { s.set(false,false); s.recordActionFree = false; },
				record_save_new:() => { s.set(true,false);  s.recordActionFree = false; },
				
				// timeout/interval function calls
				timer_clear:s.timerClear,
				timer_set:(name,isInterval,fnc,milliseconds) => {
					s.timerClear(name);
					s.timers[name] = {
						id:isInterval ? setInterval(fnc,milliseconds) : setTimeout(fnc,milliseconds),
						isInterval:isInterval
					};
				},

				// variables
				get_variable:(k)   => s.variableValueGet(k,  s.variableIdMapLocal),
				set_variable:(k,v) => s.variableValueSet(k,v,s.variableIdMapLocal),
				
				// e2e encryption
				set_e2ee_by_user_ids:ids => s.loginIdsEncryptFor = ids,
				set_e2ee_by_user_ids_and_relation:(loginIds,relationId,recordIds) => {
					s.loginIdsEncryptForOutside.push({
						loginIds:loginIds,
						relationId:relationId,
						recordIds:recordIds
					});
				},
				
				// field manipulation
				get_field_value:(fieldId) => s.fieldIdMapData[fieldId] === undefined
					? undefined : JSON.parse(JSON.stringify(s.values[s.getIndexAttributeIdByField(s.fieldIdMapData[fieldId],false)])),
				get_field_value_changed:(fieldId) => s.fieldIdsChanged.includes(fieldId),
				get_field_file_links:(fieldId) => {
					const fld = s.fieldIdMapData[fieldId];
					const val = s.values[s.getIndexAttributeIdByField(fld,false)];
					
					if(fld !== undefined && val !== null && !Array.isArray(val))
						console.warn('Failed to generate file links, file input has unsaved changes');
					
					if(fld === undefined || val === null || !Array.isArray(val))
						return null;
					
					let out = [];
					for(const f of val) {
						out.push(s.getAttributeFileVersionHref(fld.attributeId, f.id, f.name, f.version, s.token));
					}
					return out;
				},
				set_field_caption:(fieldId,caption)     => s.fieldIdMapOverwrite.caption[fieldId] = caption,
				set_field_chart:  (fieldId,option)      => s.fieldIdMapOverwrite.chart[fieldId]   = option,
				set_field_error:  (fieldId,errorMsg)    => s.fieldIdMapOverwrite.error[fieldId]   = errorMsg,
				set_field_focus:  (fieldId)             => s.fieldSetFocus(fieldId,false),
				set_field_order:  (fieldId,order)       => s.fieldIdMapOverwrite.order[fieldId]   = order,
				set_field_value:  (fieldId,value,isChg) => {
					// use common return codes: 0 = success, 1 = error
					if(s.fieldIdMapData[fieldId] === undefined) return 1;
					if(isChg                     === undefined) isChg = true;
					
					s.valueSetByField(s.getIndexAttributeIdByField(
						s.fieldIdMapData[fieldId],false),value,!isChg,true,fieldId);
					
					return 0;
				},

				// legacy calls (<3.9)
				set_e2ee_by_login_ids:ids => s.loginIdsEncryptFor = ids,
				set_e2ee_by_login_ids_and_relation:(loginIds,relationId,recordIds) => {
					s.loginIdsEncryptForOutside.push({
						loginIds:loginIds,
						relationId:relationId,
						recordIds:recordIds
					});
				},
				
				// legacy calls (<3.5)
				open_form:(formId,recordId,newTab,popUp,maxY,maxX,replace) => {
					s.openForm((recordId === 0 ? [] : [recordId]),{
						formIdOpen:formId, popUpType:popUp ? 'float' : null,
						maxHeight:maxY, maxWidth:maxX
					},[],newTab,null,replace);
					s.recordActionFree = false;
				},
				show_form_message:s.messageSet
			};
		},
		
		// applied form state effects, overwrites for different entities (form, fields, formActions, tabs)
		entityIdMapEffect:(s) => {
			const getValueFromConditionSide = (side,operator,recursionLevel) => {
				switch(side.content) {
					case 'collection':      return getCollectionValues(side.collectionId,side.columnId,s.filterOperatorIsSingleValue(operator)); break;
					case 'field':           return s.values[s.getIndexAttributeIdByField(s.fieldIdMapData[side.fieldId],false)]; break;
					case 'fieldChanged':    return s.fieldIdsChanged.includes(side.fieldId); break;
					case 'fieldValid':      return !s.fieldIdsInvalid.includes(side.fieldId); break;
					case 'formChanged':     return s.hasChanges; break;
					case 'formState':       return isFormStateActive(s.formStateIdMap[side.formStateId],recursionLevel + 1); break;
					case 'languageCode':    return s.settings.languageCode; break;
					case 'login':           return s.loginId; break;
					case 'preset':          return s.presetIdMapRecordId[side.presetId]; break;
					case 'record':          return s.joinsIndexMap?.['0'] !== undefined ? s.joinsIndexMap['0'].recordId : false; break;
					case 'recordMayCreate': return s.mayCreate; break;
					case 'recordMayDelete': return s.mayDelete; break;
					case 'recordMayUpdate': return s.mayUpdate; break;
					case 'recordNew':       return s.isNew; break;
					case 'role':            return s.access.roleIds.includes(side.roleId); break;
					case 'true':            return true; break;
					case 'variable':        return s.variableValueGet(side.variableId,s.variableIdMapLocal); break;
					case 'value':
						// compatibility fix, true value should be used instead
						if(typeof side.value === 'string') {
							if(side.value.toLowerCase() === 'true')  return true;
							if(side.value.toLowerCase() === 'false') return false;
						}
						return side.value;
					break;
				}
				return false;
			};

			const isFormStateActive = (state,recursionLevel) => {
				if(recursionLevel > 10) {
					console.warn(`Failed to evaluate form state '${state.description}' (${state.id}), max. level of recursion reached (10).`);
					return false;
				}

				// form state must have some condition to be evaluated, effects are optional as the state could be used as condition
				if(state.conditions.length === 0)
					return false;
				
				let line = 'return ';

				// parse condition expressions
				for(let i = 0, j = state.conditions.length; i < j; i++) {
					const c = state.conditions[i];
					
					if(i !== 0)
						line += c.connector === 'AND' ? '&&' : '||';
					
					// brackets open
					line += '('.repeat(c.side0.brackets);
					
					// get boolean expression by checking filter condition
					line += s.filterIsCorrect(c.operator,
						getValueFromConditionSide(c.side0,c.operator,recursionLevel),
						getValueFromConditionSide(c.side1,c.operator,recursionLevel)
					) ? 'true' : 'false';
					
					// brackets close
					line += ')'.repeat(c.side1.brackets);
				}
				return Function(line)();
			};
			
			let out = { form:{ data:0, state:'default' }, field:{}, formAction:{}, tab:{} };
			for(const state of s.form.states) {
				if(!isFormStateActive(state,0)) continue;
				
				// apply effects if conditions are met
				for(const e of state.effects) {
					     if(e.fieldId      !== null) out.field[e.fieldId]           = { data:e.newData, state:e.newState };
					else if(e.formActionId !== null) out.formAction[e.formActionId] = { data:e.newData, state:e.newState };
					else if(e.tabId        !== null) out.tab[e.tabId]               = { data:e.newData, state:e.newState };
					else                             out.form                       = { data:e.newData, state:e.newState };
				}
			}
			return out;
		},
		fieldIdsChanged:(s) => {
			let out = [];
			for(const fieldId in s.fieldIdMapData) {
				const f  = s.fieldIdMapData[fieldId];
				let   ia = s.getIndexAttributeIdByField(f,false);
				
				if(!s.valueIsEqual(s.values[ia],s.valuesOrg[ia]))
					out.push(fieldId);
				
				if(f.attributeIdAlt === null)
					continue;
				
				ia = s.getIndexAttributeIdByField(f,true);
			
				if(!s.valueIsEqual(s.values[ia],s.valuesOrg[ia]))
					out.push(fieldId);
			}
			return out;
		},
		fieldIdMapProcessed:(s) => {
			let out = s.getFieldProcessedDefault();
			const getChoiceFilters = (choices,choiceId) => {
				if(choiceId !== null) {
					for(const c of choices) {
						if(c.id === choiceId) return c.filters;
					}
				}
				return [];
			};
			const parseFields = (fields) => {
				for(const f of fields) {
					if(f.content === 'container') {
						parseFields(f.fields);
						continue;
					}
					if(f.content === 'tabs') {
						for(let t of f.tabs) {
							parseFields(t.fields);
						}
						continue;
					}
					
					if(f.query !== undefined) {
						let choices           = JSON.parse(JSON.stringify(f.query.choices));
						const choiceId        = s.$root.getOrFallback(s.fieldIdMapOptions[f.id],'choiceId',choices.length === 0 ? null : choices[0].id);
						const columnIdsByUser = s.$root.getOrFallback(s.fieldIdMapOptions[f.id],'columnIdsByUser',[]);
						const collectionIdMap = s.$root.getOrFallback(s.fieldIdMapOptions[f.id],'collectionIdMapIndexes',{});
						const filters         = s.getQueryFiltersProcessed(
							f.query.filters,s.joinsIndexMap,null,null,s.fieldIdMapData,s.fieldIdsChanged,s.fieldIdsInvalid,s.values,
							s.mayCreate,s.mayDelete,s.mayUpdate,collectionIdMap,s.variableIdMapLocal
						);

						for(let i = 0, j = choices.length; i < j; i++) {
							choices[i].filters = s.getQueryFiltersProcessed(
								choices[i].filters,s.joinsIndexMap,null,null,s.fieldIdMapData,s.fieldIdsChanged,s.fieldIdsInvalid,s.values,
								s.mayCreate,s.mayDelete,s.mayUpdate,collectionIdMap,s.variableIdMapLocal);
						}

						out.choices[f.id] = choices;
						out.columns[f.id] = s.getColumnsProcessed(
							f.columns,columnIdsByUser,s.joinsIndexMap,null,null,s.fieldIdMapData,s.fieldIdsChanged,
							s.fieldIdsInvalid,s.values,s.mayCreate,s.mayDelete,s.mayUpdate);
						out.filters[f.id] = filters.concat(getChoiceFilters(choices,choiceId));
						out.filtersInput[f.id] = filters;
					}
				}
			};
			parseFields(s.fields);
			return out;
		},
		
		// stores
		moduleIdMap:        (s) => s.$store.getters['schema/moduleIdMap'],
		relationIdMap:      (s) => s.$store.getters['schema/relationIdMap'],
		attributeIdMap:     (s) => s.$store.getters['schema/attributeIdMap'],
		formIdMap:          (s) => s.$store.getters['schema/formIdMap'],
		formIdMapMenu:      (s) => s.$store.getters['schema/formIdMapMenu'],
		iconIdMap:          (s) => s.$store.getters['schema/iconIdMap'],
		jsFunctionIdMap:    (s) => s.$store.getters['schema/jsFunctionIdMap'],
		presetIdMapRecordId:(s) => s.$store.getters['schema/presetIdMapRecordId'],
		loginFavorites:     (s) => s.$store.getters['local/loginFavorites'],
		loginOptions:       (s) => s.$store.getters['local/loginOptions'],
		loginOptionsMobile: (s) => s.$store.getters['local/loginOptionsMobile'],
		token:              (s) => s.$store.getters['local/token'],
		access:             (s) => s.$store.getters.access,
		appResized:         (s) => s.$store.getters.appResized,
		builderEnabled:     (s) => s.$store.getters.builderEnabled,
		capApp:             (s) => s.$store.getters.captions.form,
		capErr:             (s) => s.$store.getters.captions.error,
		capGen:             (s) => s.$store.getters.captions.generic,
		colorMenu:          (s) => s.$store.getters.colorMenu,
		isAdmin:            (s) => s.$store.getters.isAdmin,
		isAtFavoritesEdit:  (s) => s.$store.getters.isAtFavoritesEdit,
		isAtHistoryStart:   (s) => s.$store.getters.isAtHistoryStart,
		isMobile:           (s) => s.$store.getters.isMobile,
		isNoAuth:           (s) => s.$store.getters.isNoAuth,
		keyLength:          (s) => s.$store.getters.constants.keyLength,
		loginId:            (s) => s.$store.getters.loginId,
		loginPublicKey:     (s) => s.$store.getters.loginPublicKey,
		loginPrivateKey:    (s) => s.$store.getters.loginPrivateKey,
		patternStyle:       (s) => s.$store.getters.patternStyle,
		settings:           (s) => s.$store.getters.settings
	},
	methods:{
		// externals
		aesGcmDecryptBase64WithPhrase,
		aesGcmEncryptBase64WithPhrase,
		consoleError,
		dialogCloseAsk,
		fillRelationRecordIds,
		filterIsCorrect,
		filterOperatorIsSingleValue,
		getAttributeFileVersionHref,
		getAttributeValueFromString,
		getCaption,
		getCollectionValues,
		getColumnsProcessed,
		getDataFieldMap,
		getDetailsFromIndexAttributeId,
		getFieldOverwriteDefault,
		getFieldProcessedDefault,
		getFormPopUpConfig,
		getFormRoute,
		getFormStateIdMap,
		getGetterFromAttributeValues,
		getIndexAttributeId,
		getIndexAttributeIdByField,
		getJoinIndexMapExpanded,
		getQueryAttributePkFilter,
		getQueryFiltersProcessed,
		getRandomString,
		getRelationsJoined,
		getResolvedPlaceholders,
		getRowsDecrypted,
		isAttributeRelationship,
		isAttributeRelationshipN1,
		jsFunctionRun,
		layoutSettleSpace,
		openLink,
		pemImport,
		rsaDecrypt,
		rsaEncrypt,
		srcBase64,
		variableValueGet,
		variableValueSet,
		
		// form management
		handleHotkeys(ev) {
			// ignore hotkeys if pop-up form (child of this form) is open or if its a widget
			if(this.popUp !== null || this.isWidget) return;

			if(this.isPopUp && ev.key === 'Escape') {
				this.closeAsk();
				ev.stopPropagation();
			}

			if(this.isData && ev.ctrlKey && ev.key === 's') {
				ev.preventDefault();
				ev.stopPropagation();

				if(!this.form.noDataActions && this.buttonSaveUsable) {
					if(!this.isBulkUpdate && this.hasChanges)     this.set(false,false);
					if(this.isBulkUpdate  && this.hasChangesBulk) this.setBulkUpdate();
				}
			}
		},
		messageSet(message,duration) {
			// convert message codes
			switch(message) {
				case '[CREATED]':    this.message = this.capApp.message.recordCreated;     break;
				case '[DELETED]':    this.message = this.capApp.message.recordDeleted;     break;
				case '[UPDATED]':    this.message = this.capApp.message.recordUpdated;     break;
				case '[CLIPBOARD]':  this.message = this.capApp.message.recordValueCopied; break;
				case '[ENCRYPTING]': this.message = this.capApp.message.recordEncrypting;  break;
				default: this.message = message; break;
			}
			
			// reset message after timeout
			clearTimeout(this.messageTimeout);
			this.messageTimeout = setTimeout(() => this.message = null,
				typeof duration !== 'undefined' ? duration : 3000);
		},
		reset() {
			// set form to loading as data is being changed, will be released once form is ready
			this.loading = true;
			this.$store.commit('isAtMenu',false);
			
			// rebuild form if ID changed
			if(this.lastFormId !== this.form.id) {
				this.$store.commit('pageTitle',this.title);
				this.message            = null;
				this.showLog            = false;
				this.titleOverwrite     = null;
				this.lastFormId         = this.form.id;
				this.variableIdMapLocal = {};

				// on first load, field valid states do not need to be reset
				// addresses issue in which field valid states are set before reset() is executed
				if(!this.firstLoad) 
					this.fieldIdsInvalid = [];
				
				// set preset record to open, if defined
				if(this.form.presetIdOpen !== null && this.relationId !== null) {
					for(const p of this.relationIdMap[this.relationId].presets) {
						if(p.id === this.form.presetIdOpen)
							return this.openForm([this.presetIdMapRecordId[p.id]]);
					}
				}
			}
			
			// reset form behaviour and load record
			this.blockInputs = false;
			this.firstLoad   = false;
			this.fieldIdMapOverwrite = this.getFieldOverwriteDefault();
			this.timerClearAll();
			this.closePopUp();
			this.popUpFieldIdSrc = null;
			this.valuesNew       = {};
			this.valuesOld       = {};
			this.$nextTick(this.resized);

			// for new records: apply defaults
			// before get() as default values could be overwritten by form function (after load event)
			if(this.isNew) {
				for(const ia in this.valuesDef) {
					if(this.valuesDef[ia] !== null)
						this.valueSet(ia,this.valuesDef[ia],true,true);
				}
			}

			// load record if relevant
			this.get();
			
			if(!this.isWidget && !this.isMobile)
				this.$nextTick(() => this.fieldSetFocus(this.form.fieldIdFocus,true));
		},
		resetRecordMeta() {
			this.badSave                   = false;
			this.badLoad                   = false;
			this.loginIdsEncryptFor        = [];
			this.loginIdsEncryptForOutside = [];
			this.indexesNoDel              = [];
			this.indexesNoSet              = [];
			this.indexMapRecordId          = {};
			this.indexMapRecordKey         = {};
			this.fieldIdsTouched           = [];
		},
		releaseLoadingOnNextTick() {
			// releases state on next tick for watching components to react to with updated data
			this.$nextTick(() => this.loading = false);
		},
		resized(evt,initialWaitMs) {
			if(this.layoutCheckTimer !== null)
				clearTimeout(this.layoutCheckTimer);
			
			this.layoutCheckTimer = setTimeout(() => {
				this.layoutElements = JSON.parse(JSON.stringify(this.layoutElementsAvailable));
				this.$nextTick(() => this.layoutSettleSpace(this.layoutElements,
					this.hasBarLower ? this.$refs.formBarLowerCheck : this.$refs.formBarUpperCheck));
			},initialWaitMs === undefined ? 300 : initialWaitMs);
		},
		routingGuard() {
			const unsavedOk = !this.warnUnsaved || confirm(this.capApp.dialog.prevBrowser);
			if(!this.isPopUp)
				return unsavedOk;

			// always block routing if form is pop-up, just close if its allowed
			if(unsavedOk)
				this.close();

			return false;
		},
		
		// field value control
		valueIsEqual(v1,v2) {
			const clean = v => {
				if(Array.isArray(v)) {
					v.sort();
					return JSON.stringify(v);
				}
				if(typeof v === 'object')
					return JSON.stringify(v);

				return v;
			};
			return clean(v1) == clean(v2);
		},
		valueSet(indexAttributeId,value,isOriginal,updateJoins) {
			const changed = this.valuesNew[indexAttributeId] !== value;

			if(changed)    this.valuesNew[indexAttributeId] = value;
			if(isOriginal) this.valuesOld[indexAttributeId] = JSON.parse(JSON.stringify(value));
			
			// update joined data, if relevant (because relationship value changed or defaults were loaded)
			if(updateJoins && (changed || isOriginal)) {
				const d = this.getDetailsFromIndexAttributeId(indexAttributeId);
				if(d.outsideIn) return;
				
				// get data from sub joins if relationship attribute value has changed
				for(let k in this.joinsIndexMap) {
					if(this.joinsIndexMap[k].attributeId === d.attributeId)
						this.getFromSubJoin(this.joinsIndexMap[k],value);
				}
			}
		},
		valueSetByField(indexAttributeId,value,isOriginal,updateJoin,fieldId) {
			if(!isOriginal && !this.fieldIdsTouched.includes(fieldId))
				this.fieldIdsTouched.push(fieldId);

			this.valueSet(indexAttributeId,value,isOriginal,updateJoin);
		},
		valueSetByRows:async function(rows,expressions) {
			if(rows.length !== 1)
				throw new Error('expected 1 row, got: '+rows.length);
			
			const row = rows[0];
			
			// update record IDs & DEL/SET permission for each relation index
			for(let index in row.indexRecordIds) {
				this.indexMapRecordId[index] = row.indexRecordIds[index];
				
				const indexInt = parseInt(index);
				let pos = this.indexesNoDel.indexOf(indexInt);
				if(pos === -1 && row.indexesPermNoDel.includes(indexInt))
					this.indexesNoDel.push(indexInt);
				
				if(pos !== -1 && !row.indexesPermNoDel.includes(indexInt))
					this.indexesNoDel.splice(pos,1);
				
				pos = this.indexesNoSet.indexOf(indexInt);
				if(pos === -1 && row.indexesPermNoSet.includes(indexInt))
					this.indexesNoSet.push(indexInt);
				
				if(pos !== -1 && !row.indexesPermNoSet.includes(indexInt))
					this.indexesNoSet.splice(pos,1);
			}
			
			// update record data keys for each relation index
			for(let index in row.indexRecordEncKeys) {
				this.indexMapRecordKey[index] = await this.rsaDecrypt(
					this.loginPrivateKey,
					row.indexRecordEncKeys[index]
				).catch(
					err => { throw new Error('failed to decrypt data key with private key, '+err); }
				);
			}
			
			// set row values (decrypt first if necessary)
			return this.getRowsDecrypted(rows,expressions).then(
				rows => {
					const rowDecr = rows[0];
					for(let i = 0, j = rowDecr.values.length; i < j; i++) {
						const e  = expressions[i];
						const ia = this.getIndexAttributeId(e.index,e.attributeId,e.outsideIn,e.attributeIdNm);

						// if it´s a new record on affected relation, use defaults
						if(row.indexRecordIds[e.index] === null)
							this.valueSet(ia,this.valuesDef[ia],true,true);
						else
							this.valueSet(ia,rowDecr.values[i],true,false);
					}
				}
			);
		},
		
		// field meta changes
		fieldSetFocus(fieldId,fallbackToFirstInput) {
			let searchEl = fieldId !== null
				? this.$refs.fields.querySelector(`[data-field-id="${fieldId}"]`)
				: this.$refs.fields;
			
			if(searchEl === null && fallbackToFirstInput)
				searchEl = this.$refs.fields;
			
			if(searchEl === null)
				return;
			
			const inputEl = searchEl.querySelector('[data-is-input="1"]');
			if(inputEl !== null)
				inputEl.focus();
		},
		fieldSetTouched(fieldId) {
			this.fieldIdsTouched.push(fieldId);
		},
		fieldSetValid(state,fieldId) {
			const pos = this.fieldIdsInvalid.indexOf(fieldId);
			if(state  && pos !== -1) return this.fieldIdsInvalid.splice(pos,1); 
			if(!state && pos === -1) return this.fieldIdsInvalid.push(fieldId);
		},
		
		// actions
		closeAsk() {
			this.dialogCloseAsk(this.close,this.hasChanges);
		},
		close() {
			this.$emit('close');
		},
		closePopUp() {
			this.popUp = null;
			this.$store.commit('pageTitle',this.title);
		},
		copyFormUrlToClipboard(middleClick) {
			const path = this.getFormRoute(this.favoriteId,this.form.id,(this.isNew ? 0 : this.recordIds[0]),
				true,this.getGetterFromAttributeValues(this.attributeIdMapDef));
			
			if(!middleClick) navigator.clipboard.writeText(`${location.protocol}//${location.host}/#${path}`);
			else             this.openLink(`${location.protocol}//${location.host}/#${path}`,true);
		},
		makeFavorite() {
			const recordId = this.recordIds.length === 1 ? this.recordIds[0] : null;
			ws.send('loginFavorites','add',{
				srcFormId:this.form.id,
				srcFavoriteId:this.favoriteId,
				moduleId:this.moduleId,
				recordIdOpen:recordId,
				isMobile:this.isMobile,
				title:this.title
			},false).then(
				resFav => {
					// creating a new favorite, copies its field options from the source form
					// need to retrieve new values to be up to date
					ws.sendMultiple([
						ws.prepare('loginFavorites','get',{dateCache:this.loginFavorites.dateCache}),
						ws.prepare('loginOptions','get',{
							dateCache:this.isMobile ? this.loginOptionsMobile.dateCache : this.loginOptions.dateCache,
							isMobile:this.isMobile
						})
					],false).then(
						res => {
							this.$store.commit('local/loginFavorites',res[0].payload);
							this.$store.commit('local/loginOptions',res[1].payload);
							this.$store.commit('isAtFavorites',true);
							this.$store.commit('isAtFavoritesEdit',true);
							this.$router.push(this.getFormRoute(resFav.payload,this.form.id,(recordId !== null ? recordId : 0),true));
						},
						this.$root.genericError
					);
				},
				console.warn
			);
		},
		openBuilder(middle) {
			if(middle)
				return this.openLink('#/builder/form/'+this.form.id,true);
			
			this.blockInputs = true;
			this.$router.push('/builder/form/'+this.form.id);
			this.$store.commit('popUpFormGlobal',null);
		},
		openNewAsk(middleClick) {
			if(middleClick || !this.warnUnsaved)
				return this.openNew(middleClick);
			
			let caption = this.capGen.button.new;
			let image   = 'new.png';
			let msg     = this.capApp.dialog.new;
			
			if(this.isNew) {
				caption = this.capGen.button.reset;
				image   = 'refresh.png';
				msg     = this.capApp.dialog.newReset;
			}
			
			this.$store.commit('dialog',{
				captionBody:msg,
				buttons:[{
					cancel:true,
					caption:caption,
					exec:this.openNew,
					keyEnter:true,
					image:image
				},{
					caption:this.capGen.button.cancel,
					keyEscape:true,
					image:'cancel.png'
				}]
			});
		},
		openNew(middleClick) {
			if(!middleClick)
				this.blockInputs = true;

			this.openForm([],null,null,middleClick,null,false);
		},
		openPrevAsk() {
			if(!this.warnUnsaved)
				return this.openPrev();
			
			this.$store.commit('dialog',{
				captionBody:this.capApp.dialog.prev,
				buttons:[{
					cancel:true,
					caption:this.capGen.button.goBack,
					exec:this.openPrev,
					keyEnter:true,
					image:'upward.png'
				},{
					caption:this.capGen.button.cancel,
					keyEscape:true,
					image:'cancel.png'
				}]
			});
		},
		openPrev() {
			this.blockInputs = true;
			window.history.back();
		},
		popUpFormUpdate(change,recordId) {
			const isDeleted = change === 'deleted';
			const isUpdated = change === 'updated';

			if(recordId !== null && this.popUpFieldIdSrc !== null && this.fieldIdMapData[this.popUpFieldIdSrc] !== undefined) {
				// update data field value to reflect change of pop-up form record
				const field = this.fieldIdMapData[this.popUpFieldIdSrc];
				const atr   = this.attributeIdMap[field.attributeId];
				const iaId  = this.getIndexAttributeIdByField(field,false);
				
				if(this.isAttributeRelationship(atr.content)) {
					const isMulti = field.attributeIdNm !== null ||
						(field.outsideIn && this.isAttributeRelationshipN1(atr.content));
					
					if(!isMulti) {
						this.valuesNew[iaId] = isDeleted ? null : recordId;
					}
					else {
						let val = JSON.parse(JSON.stringify(this.values[iaId]));

						if(isDeleted && val !== null) {
							const pos = val.indexOf(recordId);
							if(pos !== -1) val.splice(pos,1);

							this.valuesNew[iaId] = val;
						}
						else if(isUpdated) {
							if(val === null) {
								this.valuesNew[iaId] = [recordId];
							}
							else if(val.indexOf(recordId) === -1) {
								val.push(recordId);
								this.valuesNew[iaId] = val;
							}
						}
					}

					if(field.jsFunctionId !== null)
						this.jsFunctionRun(field.jsFunctionId,[],this.exposedFunctions);
				}
			}

			// reload form to update fields (incl. non-data field like lists), as well as its parent
			this.loading = true;
			this.releaseLoadingOnNextTick();
			this.$emit('refresh-parent');
		},
		popUpReplace() {
			this.popUp = null;
			this.$nextTick(() => this.openForm(...arguments));
		},
		scrollToInvalidField() {
			const el = this.$refs.fields.querySelector(`[data-field-is-valid="0"]`);
			if(el !== null)
				el.scrollIntoView();
		},
		toggleHelp() {
			this.showHelp = !this.showHelp;
			this.resized();
		},
		toggleLog() {
			this.showLog = !this.showLog;
			this.resized();
		},
		
		// timer
		timerClear(name) {
			if(this.timers[name] !== undefined) {
				if(this.timers[name].isInterval)
					clearInterval(this.timers[name].id);
				else
					clearTimeout(this.timers[name].id);
				
				delete(this.timers[name]);
			}
		},
		timerClearAll() {
			for(let k in this.timers) {
				this.timerClear(k);
			}
		},
		
		// form function triggers
		triggerEventAfter (e) { this.triggerEvent(e,false); },
		triggerEventBefore(e) { this.triggerEvent(e,true); },
		triggerEvent      (event,before) {
			for(let f of this.form.functions) {
				if(f.event === event && f.eventBefore === before)
					this.jsFunctionRun(f.jsFunctionId,[],this.exposedFunctions);
			}
		},
		
		// navigation
		openForm(recordIds,openForm,getterArgs,newTab,fieldIdSrc,replace) {
			// set defaults
			if(recordIds  === undefined || recordIds  === null) recordIds  = [];
			if(openForm   === undefined || openForm   === null) openForm   = { formIdOpen:this.form.id, popUpType:null };
			if(getterArgs === undefined || getterArgs === null) getterArgs = [];
			if(newTab     === undefined)                        newTab     = false;
			if(fieldIdSrc === undefined)                        fieldIdSrc = null;
			if(replace    === undefined)                        replace    = false;
			
			const openSameForm  = this.form.id === openForm.formIdOpen;
			const openPopUpForm = openForm.popUpType !== null;

			if(this.isPopUp && replace) {
				// a floating pop-up can be replaced by closing and reopening it on its parent
				openForm.popUpType === 'float';
				return this.$emit('pop-up-replace',recordIds,openForm,getterArgs,newTab,null,false);
			}
			
			if(this.isPopUp || this.isWidget) {
				// a pop-up/widget form can be reloaded by using itself as target (the same as regular forms)
				// unless it wants to open itself again as pop-up
				if(openSameForm && !openPopUpForm)
					return this.$emit('records-open',recordIds);
				
				// a floating pop-up form can only open other floating pop-ups
				// otherwise navigation becomes difficult and confusing
				if(this.isPopUpFloating && !openPopUpForm)
					openForm.popUpType = 'float';
			}
			
			// open pop-up form unless new tab is requested
			if(openForm.popUpType !== null && !newTab) {
				this.popUp = this.getFormPopUpConfig(recordIds,openForm,getterArgs,'attributes');
				this.popUpFieldIdSrc = fieldIdSrc;
				return;
			}
			
			// keep attribute default values from current getter if form does not change
			if(openSameForm && typeof this.$route.query.attributes !== 'undefined') {
				
				// ignore current getter, if new one is supplied with same name
				let newAttributesGetter = false;
				for(let i = 0, j = getterArgs.length; i < j; i++) {
					if(getterArgs[i].indexOf('attributes=') === 0) {
						newAttributesGetter = true;
						break;
					}
				}
				
				if(!newAttributesGetter)
					getterArgs.push(`attributes=${this.$route.query.attributes}`);
			}
			
			// full form navigation, only single record allowed as target
			let recordIdOpen = recordIds.length === 1 ? recordIds[0] : 0;
			const path = this.getFormRoute(null,openForm.formIdOpen,recordIdOpen,true,getterArgs);
			
			if(newTab)
				return this.openLink('#'+path,true);
			
			// same path, reset form
			if(this.$route.fullPath === path)
				return this.reset();
			
			// different path, same form
			if(openSameForm) {
				// switch from existing to new one or between two existing records
				if(!replace && !this.isNew && recordIdOpen !== this.recordIds[0])
					return this.$router.push(path);
				
				return this.$router.replace(path);
			}
			
			// new form
			if(replace) this.$router.replace(path);
			else        this.$router.push(path);
		},
		setFormArgs(args,push) {
			const path = this.getFormRoute(this.favoriteId,this.form.id,
				(this.isNew ? 0 : this.recordIds[0]),true,args);
			
			if(this.$route.fullPath === path || this.isPopUp || this.isWidget)
				return; // nothing changed or pop-up/widget form, ignore
			
			if(push) this.$router.push(path);
			else     this.$router.replace(path);
		},
		
		// backend calls
		delAsk(deleteAndNew) {
			this.$store.commit('dialog',{
				captionBody:this.capApp.dialog.delete,
				buttons:[{
					cancel:true,
					caption:this.capGen.button.delete,
					exec:() => this.del(deleteAndNew),
					keyEnter:true,
					image:'shred.png'
				},{
					caption:this.capGen.button.cancel,
					keyEscape:true,
					image:'cancel.png'
				}]
			});
		},
		del(deleteAndNew) {
			this.triggerEventBefore('delete');
			
			let requests = [];
			for(const join of this.joinsIndexesDel) {
				requests.push(ws.prepare('data','del',{
					relationId:join.relationId,
					recordId:join.recordId
				}));
			}
			
			ws.sendMultiple(requests,true).then(
				() => {
					if(this.isPopUp)
						this.$emit('record-deleted',this.recordIds[0]);
					
					this.recordActionFree = true;
					
					this.triggerEventAfter('delete');
					
					if(this.recordActionFree) {
						if(this.isPopUp && deleteAndNew)  return this.$emit('records-open',[]);
						if(this.isPopUp && !deleteAndNew) return this.closeAsk();
						
						if(deleteAndNew || this.isAtHistoryStart)
							return this.openForm(null,null,[],false,null,true);
						
						return this.openPrevAsk();
					}
					this.messageSet('[DELETED]');
				},
				this.$root.genericError
			).finally(
				() => this.changingRecord = false
			);
			this.changingRecord = true;
		},
		get() {
			this.triggerEventBefore('open');
			
			// no or multiple records defined, no need to load record data
			if(this.isNew || this.isBulkUpdate) {
				this.resetRecordMeta();
				this.triggerEventAfter('open');
				this.releaseLoadingOnNextTick();
				return;
			}
			
			// set base record ID, necessary for form filter 'recordNew'
			this.indexMapRecordId[0] = this.recordIds[0];
			
			// add index attributes to be retrieved
			let expressions = [];
			for(let ia in this.values) {
				const d = this.getDetailsFromIndexAttributeId(ia);
				expressions.push({
					attributeId:d.attributeId,
					attributeIdNm:d.attributeIdNm,
					index:d.index,
					outsideIn:d.outsideIn
				});
			}
			
			const filters = this.getQueryFiltersProcessed(this.form.query.filters,this.joinsIndexMap).concat([
				this.getQueryAttributePkFilter(this.relationId,this.recordIds[0],0,false)]);
			
			ws.send('data','get',{
				relationId:this.relationId,
				indexSource:0,
				joins:this.relationsJoined,
				expressions:expressions,
				filters:filters,
				getPerm:true
			},true).then(
				res => {
					// reset states
					this.resetRecordMeta();
					this.loading = true;
					
					this.valueSetByRows(res.payload.rows,expressions).then(
						() => this.triggerEventAfter('open'),
						err => {
							this.badLoad = true;
							this.consoleError(err);
						}
					).finally(
						this.releaseLoadingOnNextTick
					);
				},
				this.$root.genericError
			);
		},
		getFromSubJoin(join,recordId) {
			let joinIndexes = [join.index]; // all join indexes to collect (start with initial join)
			let joins       = [];           // all collected joins
			let joinAdded   = true;
			
			// loop until no more joins need to be added
			while(joinAdded) {
				joinAdded = false;
				
				for(let r of this.relationsJoined) {
					
					if(!joinIndexes.includes(r.indexFrom))
						continue; // not dependent on existing joins
					
					if(joinIndexes.includes(r.index))
						continue; // already added
					
					joins.push(r);
					joinIndexes.push(r.index);
					
					// repeat if join was added (to collect dependent joins)
					joinAdded = true;
				}
			}
			
			// collect which values from connected joins can be retrieved
			let expressions = [];
			for(let ia in this.values) {
				const d = this.getDetailsFromIndexAttributeId(ia);
				
				if(joinIndexes.includes(d.index))
					expressions.push({
						attributeId:d.attributeId,
						attributeIdNm:d.attributeIdNm,
						index:d.index,
						outsideIn:d.outsideIn
					});
			}
			
			// record is empty, clear attribute values from all joined relations
			if(recordId === null) {
				for(let e of expressions) {
					this.valueSet(
						this.getIndexAttributeId(
							e.index,e.attributeId,e.outsideIn,e.attributeIdNm
						),
						null,true,false
					);
				}
				return;
			}
			
			// remove filters for non-available joins
			// then process filters (to encapsule final filters correctly)
			// lastly add filter for the record itself
			let removeInvalid = function(filters) {
				let out = [];
				for(let f of filters) {
					if((f.side0.attributeId !== null && !joinIndexes.includes(f.side0.attributeIndex))
						|| (f.side1.attributeId !== null && !joinIndexes.includes(f.side1.attributeIndex))) {
						continue;
					}
					out.push(f);
				}
				return out;
			};
			
			let filters = this.getQueryFiltersProcessed(
				removeInvalid(JSON.parse(JSON.stringify(this.form.query.filters))),this.joinsIndexMap);
			
			filters.push(this.getQueryAttributePkFilter(this.relationId,recordId,join.index,false));
			
			this.triggerEventBefore('open');
			ws.send('data','get',{
				relationId:join.relationId,
				indexSource:join.index,
				joins:joins,
				expressions:expressions,
				filters:filters,
				getPerm:true
			},true).then(
				res => {
					this.valueSetByRows(res.payload.rows,expressions).then(
						() => this.triggerEventAfter('open'),
						err => this.$root.genericError
					);
				},
				this.$root.genericError
			);
		},
		set:async function(saveAndNew,saveAndClose) {
			if(this.fieldIdsInvalid.length !== 0)
				return this.badSave = true;
			
			this.triggerEventBefore('save');
			this.changingRecord = true;
			
			const handleEncErr = err => {
				this.changingRecord = false;
				this.consoleError(err); // full error for troubleshooting
				this.$root.genericErrorWithFallback(err,'SEC','003');
			};
			
			let relations = {};
			let addRelationByIndex = async index => {
				if(typeof relations[index] !== 'undefined')
					return;
				
				const j     = this.joinsIndexMap[index];
				const isNew = j.recordId === 0;
				let encLoginKeys = [];
				
				// ignore relation if record is new and creation is disallowed
				if(!j.applyCreate && isNew)
					return;
				
				// recursively add relation parent, if one exists
				if(j.indexFrom !== -1)
					await addRelationByIndex(j.indexFrom);
				
				// handle encryption key for record
				if(this.relationIdMap[j.relationId].encryption) {
					
					// create if new or get known data key
					if(isNew)
						this.indexMapRecordKey[index] = this.getRandomString(this.keyLength);
					
					const dataKeyStr = this.indexMapRecordKey[index];
					if(typeof dataKeyStr === 'undefined')
						throw new Error('encryption key for existing record is not available');
					
					// new records need at least one encryption recipient
					if(isNew && this.loginIdsEncryptFor.length === 0)
						this.loginIdsEncryptFor.push(this.loginId);
					
					if(this.loginIdsEncryptFor.length !== 0) {
						this.messageSet('[ENCRYPTING]');
						
						// get public keys for logins to encrypt data key for
						// only returns keys if logins have not already encrypted all records
						const res = await ws.send('loginKeys','getPublic',{
							loginIds:this.loginIdsEncryptFor,
							relationId:j.relationId,
							recordIds:[j.recordId]
						},true);
						
						// send encrypted data keys
						const loginKeys = res.payload;
						
						for(const lk of loginKeys) {
							const publicKey  = await this.pemImport(lk.publicKey,'RSA',true);
							const dataKeyEnc = await this.rsaEncrypt(publicKey,dataKeyStr);
							
							encLoginKeys.push({
								loginId:lk.loginId,
								keyEnc:dataKeyEnc
							});
						}
					}
				}
				
				relations[j.index] = {
					relationId:j.relationId,
					attributeId:j.attributeId,
					indexFrom:j.indexFrom,
					recordId:j.recordId,
					attributes:[],
					encKeysSet:encLoginKeys
				};
			};
			
			// add values by index attribute ID
			for(let k in this.values) {
				let d     = this.getDetailsFromIndexAttributeId(k);
				let j     = this.joinsIndexMap[d.index];
				let isNew = j.recordId === 0;
				
				// ignore NULL values for new record
				if(isNew && this.values[k] === null)
					continue;
				
				// ignore unchanged values for existing record
				if(!isNew && this.valueIsEqual(this.values[k],this.valuesOrg[k]))
					continue;
				
				// ignore values if join settings disallow creation/update
				if(!j.applyCreate && j.recordId === 0) continue;
				if(!j.applyUpdate && j.recordId !== 0) continue;
				
				// add join to request to set attribute values and handle encryption keys
				try        { await addRelationByIndex(d.index); }
				catch(err) { return handleEncErr(err); }
				
				let value = this.values[k];
				
				// handle encryption
				if(value !== null && this.attributeIdMap[d.attributeId].encrypted) {
					try {
						value = await this.aesGcmEncryptBase64WithPhrase(
							this.values[k],this.indexMapRecordKey[d.index]);
					}
					catch(err) { return handleEncErr(err); }
				}
				
				relations[d.index].attributes.push({
					attributeId:d.attributeId,
					attributeIdNm:d.attributeIdNm,
					outsideIn:d.outsideIn,
					value:value
				});
			}
			
			// prepare websocket requests
			let requests = [ws.prepare('data','set',relations)];
			
			// encrypt for outside relations
			// run in same transaction as data SET to keep data consistent
			for(let i = 0, j = this.loginIdsEncryptForOutside.length; i < j; i++) {
				try {
					// get data keys for all affected records
					const loginIds   = this.loginIdsEncryptForOutside[i].loginIds;
					const relationId = this.loginIdsEncryptForOutside[i].relationId;
					const recordIds  = this.loginIdsEncryptForOutside[i].recordIds;
					
					let [resDataKeys,resLoginKeys] = await Promise.all([
						ws.send('data','getKeys',{
							relationId:relationId,
							recordIds:recordIds
						},true),
						ws.send('loginKeys','getPublic',{
							loginIds:loginIds,
							relationId:relationId,
							recordIds:recordIds
						},true)
					]);
					
					const dataKeys  = resDataKeys.payload;
					const loginKeys = resLoginKeys.payload;
					
					let recordIdMapKeyStr  = {}; // data key, by record ID, unencrypted
					let recordIdMapKeysEnc = {}; // data keys, by record ID, encrypted with public keys
					
					if(dataKeys.length !== recordIds.length)
						throw new Error(`current login has only access to ${dataKeys.length} of ${recordIds.length} records`);
					
					// decrypt data keys
					for(let x = 0, y = dataKeys.length; x < y; x++) {
						recordIdMapKeyStr[recordIds[x]] = await this.rsaDecrypt(
							this.loginPrivateKey,
							dataKeys[x]
						);
					}
					
					// encrypt data keys for all requested logins
					for(const loginKey of loginKeys) {
						const publicKey = await this.pemImport(loginKey.publicKey,'RSA',true);
						
						for(const recordId of loginKey.recordIds) {
							const dataKeyEnc = await this.rsaEncrypt(
								publicKey,
								recordIdMapKeyStr[recordId]
							);
							
							if(typeof recordIdMapKeysEnc[recordId] === 'undefined')
								recordIdMapKeysEnc[recordId] = [];
							
							recordIdMapKeysEnc[recordId].push({
								loginId:loginKey.loginId,
								keyEnc:dataKeyEnc
							});
						}
					}
					
					for(let recordId in recordIdMapKeysEnc) {
						requests.push(ws.prepare('data','setKeys',{
							relationId:relationId,
							recordId:parseInt(recordId),
							encKeys:recordIdMapKeysEnc[recordId]
						}));
					}
				}
				catch(err) { return handleEncErr(err); }
			}
			
			ws.sendMultiple(requests,true).then(
				res => {
					const resSet = res[0];
					
					if(this.isNew) this.messageSet('[CREATED]');
					else           this.messageSet('[UPDATED]');
					
					if(this.isPopUp)
						this.$emit('record-updated',resSet.payload.indexRecordIds['0']);
					
					this.recordActionFree = true;
					
					// clear form changes, relevant for after-save functions that open a form
					this.valuesOld = JSON.parse(JSON.stringify(this.valuesNew));
					
					this.triggerEventAfter('save');
					
					if(!this.recordActionFree)
						return;

					if(saveAndClose && !this.isPopUp) return this.openPrevAsk();
					if(saveAndClose &&  this.isPopUp) return this.closeAsk();
					if(saveAndNew)                    return this.openForm();
					if(this.isNew)                    return this.openForm([resSet.payload.indexRecordIds['0']]);
					
					// reload same record
					// unfortunately necessary as update trigger in backend can change values
					// if we knew nothing triggered, we could update our values without reload
					this.get();
				},
				this.$root.genericError
			).finally(
				() => this.changingRecord = false
			);
		},
		setBulkUpdate() {
			// bulk update, limitations:
			// only existing records, only pop-up, no encryption, no joins
			if(this.fieldIdsInvalid.length !== 0)
				return this.badSave = true;
			
			this.triggerEventBefore('save');
			this.changingRecord = true;
			
			let attributes = [];
			for(let fieldId of this.fieldIdsTouched) {
				if(this.fieldIdMapData[fieldId] === undefined)
					continue;
				
				let f   = this.fieldIdMapData[fieldId];
				let err = null;
				
				if(f.index !== 0)
					err = this.capApp.dialog.bulkMultiple;
				
				if(this.attributeIdMap[f.attributeId].encrypted)
					err = this.capApp.dialog.bulkEncrypted;
				
				if(err !== null) {
					this.changingRecord = false;
					return this.$store.commit('dialog',{
						captionBody:err,
						buttons:[{
							cancel:true,
							caption:this.capGen.button.close,
							exec:this.close,
							keyEnter:true,
							image:'ok.png'
						}]
					});
				}
				
				attributes.push({
					attributeId:f.attributeId,
					attributeIdNm:f.attributeIdNm,
					outsideIn:f.outsideIn,
					value:this.values[this.getIndexAttributeId(
						f.index,f.attributeId,f.outsideIn === true,(
						typeof f.attributeIdNm !== 'undefined'
						? f.attributeIdNm : null)
					)]
				});
			}
			
			let requests = [];
			for(let recordId of this.recordIds) {
				requests.push(
					ws.prepare('data','set',{'0':{
						relationId:this.relationId,
						attributeId:null,
						indexFrom:-1,
						recordId:recordId,
						attributes:attributes
					}})
				);
			}
			
			ws.sendMultiple(requests,true).then(
				res => {
					this.$emit('record-updated');
					this.triggerEventAfter('save');
					this.close();
				},
				this.$root.genericError
			).finally(
				() => this.changingRecord = false
			);
		}
	}
};