import {getDependentModules} from '../shared/builder.js';
import MyBuilderFormInput    from './builderFormInput.js';
import {
	getTemplateApi,
	getTemplateCollection,
	getTemplateDoc,
	getTemplateForm,
	getTemplateJsFunction,
	getTemplateModule,
	getTemplatePgFunction,
	getTemplateRelation,
	getTemplateRole,
	getTemplateSearchBar,
	getTemplateVariable,
	getTemplateWidget
} from '../shared/builderTemplate.js';

export default {
	name:'my-builder-new',
	components:{ MyBuilderFormInput },
	template:`<div class="app-sub-window under-header" @mousedown.self="$emit('close')">
		<div class="contentBox builder-new float">
			<div class="top lower">
				<div class="area nowrap">
					<img class="icon" :src="titleImgSrc" />
					<h1 class="title">{{ title }}</h1>
				</div>
				<div class="area">
					<my-button image="cancel.png"
						@trigger="$emit('close')"
						:cancel="true"
					/>
				</div>
			</div>
			
			<div class="content gap default-inputs">
				<div class="row gap centered">
					<span>{{ capGen.name }}</span>
					<input spellcheck="false" v-model="inputs.name" v-focus />
				</div>
				
				<div
					v-if="typeof capApp.message[entity] !== 'undefined'"
					v-html="capApp.message[entity]"
				></div>
				
				<!-- additional options -->
				<div class="options" v-if="showOptions">
					<h2>{{ capApp.options }}</h2>
					
					<!-- doc: duplicate document -->
					<template v-if="entity === 'doc'">
						<div class="row centered gap">
							<span>{{ capApp.docIdDuplicate }}</span>
							<select v-model="inputs.docIdDuplicate">
								<option value="">-</option>
								<option v-for="d in module.docs" :value="d.id">{{ d.name }}</option>
								<optgroup
									v-for="mod in getDependentModules(module).filter(v => v.id !== module.id && v.docs.length !== 0)"
									:label="mod.name"
								>
									<option v-for="d in mod.docs" :value="d.id">{{ d.name }}</option>
								</optgroup>
							</select>
						</div>
					</template>
					
					<!-- form: duplicate form -->
					<template v-if="entity === 'form'">
						<div class="row centered gap">
							<span>{{ capApp.formIdDuplicate }}</span>
							<my-builder-form-input
								v-model="inputs.formIdDuplicate"
								:module="module"
							/>
						</div>
					</template>
					
					<!-- JS function: assigned form -->
					<template v-if="entity === 'jsFunction'">
						<div class="row centered gap">
							<span>{{ capApp.jsFunctionFormId }}</span>
							<select v-model="inputs.formId">
								<option :value="null">-</option>
								<option v-for="f in module.forms" :value="f.id">{{ f.name }}</option>
							</select>
						</div>
						<p v-html="capApp.jsFunctionFormIdHint"></p>
					</template>
					
					<!-- variable: assigned form -->
					<template v-if="entity === 'variable'">
						<div class="row centered gap">
							<span>{{ capApp.variableFormId }}</span>
							<select v-model="inputs.formId">
								<option :value="null">-</option>
								<option v-for="f in module.forms" :value="f.id">{{ f.name }}</option>
							</select>
						</div>
						<p v-html="capApp.variableFormIdHint"></p>
					</template>
					
					<!-- PG function: trigger/function template -->
					<template v-if="entity === 'pgFunction'">
						<div class="row centered gap">
							<span>{{ capApp.pgFunctionTemplate }}</span>
							<select v-model="inputs.template">
								<option value="">-</option>
								<option value="mailsFromSpooler">{{ capApp.template.mailsFromSpooler }}</option>
								<option value="loginSync">{{ capApp.template.loginSync }}</option>
								<option value="restAuthRequest">{{ capApp.template.restAuthRequest }}</option>
								<option value="restAuthResponse">{{ capApp.template.restAuthResponse }}</option>
								<option value="restDataResponse">{{ capApp.template.restDataResponse }}</option>
								<option value="restFileUploadToREI3">{{ capApp.template.restFileUploadToREI3 }}</option>
								<option value="restFileAttachViaREI3API">{{ capApp.template.restFileAttachViaREI3API }}</option>
							</select>
						</div>
						<hr />
						
						<div class="row centered">
							<span>{{ capApp.pgFunctionTrigger }}</span>
							<my-bool v-model="inputs.isTrigger" />
						</div>
						<p v-html="capApp.pgFunctionTriggerHint"></p>
					</template>
					
					<!-- relation: E2EE encryption -->
					<template v-if="entity === 'relation'">
						<div class="row centered">
							<span>{{ capApp.relationEncryption }}</span>
							<my-bool v-model="inputs.encryption" />
						</div>
						<p v-html="capApp.relationEncryptionHint"></p>
					</template>
				</div>
				
				<p class="error" v-if="nameTaken">{{ capGen.error.nameTaken }}</p>
				<p class="error" v-if="nameTooLong">{{ capGen.error.nameTooLong.replace('{LEN}',nameMaxLength) }}</p>
				
				<div class="row">
					<my-button image="save.png"
						@trigger="set"
						:active="canSave"
						:caption="capGen.button.create"
					/>
				</div>
			</div>
		</div>
	</div>`,
	props:{
		builderLanguage:{ type:String, required:true },
		entity:         { type:String, required:true },
		moduleId:       { type:String, required:true },
		presets:        { type:Object, required:true } // preset values for inputs
	},
	emits:['close'],
	data() {
		return {
			inputs:{
				// all
				name:'',

				// doc
				docIdDuplicate:'',
				
				// form
				formIdDuplicate:null,
				
				// JS function
				formId:null,
				
				// PG function
				isTrigger:false,
				template:'',
				
				// relation
				encryption:false
			}
		};
	},
	computed:{
		nameMaxLength:(s) => {
			switch(s.entity) {
				case 'api':        return 60; break;
				case 'collection': return 64; break;
				case 'doc':        return 64; break;
				case 'form':       return 64; break;
				case 'jsFunction': return 64; break;
				case 'module':     return 60; break;
				case 'pgFunction': return 60; break;
				case 'relation':   return 60; break;
				case 'role':       return 64; break;
				case 'searchBar':  return 64; break;
				case 'variable':   return 64; break;
				case 'widget':     return 64; break;
			}
			return 0;
		},
		nameTaken:(s) => {
			if(s.inputs.name === '')
				return false;
			
			let searchList;
			switch(s.entity) {
				case 'module':     searchList = s.modules;            break;
				case 'api':        searchList = s.module.apis;        break;
				case 'collection': searchList = s.module.collections; break;
				case 'doc':        searchList = s.module.docs;        break;
				case 'form':       searchList = s.module.forms;       break;
				case 'jsFunction': searchList = s.module.jsFunctions; break;
				case 'pgFunction': searchList = s.module.pgFunctions; break;
				case 'relation':   searchList = s.module.relations;   break;
				case 'role':       searchList = s.module.roles;       break;
				case 'searchBar':  searchList = s.module.searchBars;  break;
				case 'variable':   searchList = s.module.variables;   break;
				case 'widget':     searchList = s.module.widgets;     break;
			}
			for(let e of searchList) {
				// only compare names of functions within the same scope (global or form)
				if(s.entity === 'jsFunction' && e.formId !== s.inputs.formId)
					continue;

				// only compare names of variables within the same scope (global or form)
				if(s.entity === 'variable' && e.formId !== s.inputs.formId)
					continue;
				
				if(e.name === s.inputs.name)
					return true;
			}
			return false;
		},
		
		// presentation
		title:(s) => {
			switch(s.entity) {
				case 'api':        return s.capApp.api;        break;
				case 'collection': return s.capApp.collection; break;
				case 'doc':        return s.capApp.doc;        break;
				case 'form':       return s.capApp.form;       break;
				case 'jsFunction': return s.capApp.jsFunction; break;
				case 'module':     return s.capApp.module;     break;
				case 'pgFunction': return s.capApp.pgFunction; break;
				case 'relation':   return s.capApp.relation;   break;
				case 'role':       return s.capApp.role;       break;
				case 'searchBar':  return s.capApp.searchBar;  break;
				case 'variable':   return s.capApp.variable;   break;
				case 'widget':     return s.capApp.widget;     break;
			}
			return '';
		},
		titleImgSrc:(s) => {
			switch(s.entity) {
				case 'api':        return 'images/api.png';            break;
				case 'collection': return 'images/tray.png';           break;
				case 'doc':        return 'images/document.png';       break;
				case 'form':       return 'images/fileText.png';       break;
				case 'jsFunction': return 'images/codeScreen.png';     break;
				case 'module':     return 'images/module.png';         break;
				case 'pgFunction': return 'images/codeDatabase.png';   break;
				case 'relation':   return 'images/database.png';       break;
				case 'role':       return 'images/personMultiple.png'; break;
				case 'searchBar':  return 'images/search.png';         break;
				case 'variable':   return 'images/variable.png';       break;
				case 'widget':     return 'images/tiles.png';          break;
			}
			return '';
		},

		// simple
		canSave:    (s) => s.inputs.name !== '' && !s.nameTaken && !s.nameTooLong,
		nameTooLong:(s) => s.inputs.name !== '' && s.inputs.name.length > s.nameMaxLength,
		showOptions:(s) => ['doc','form','jsFunction','pgFunction','relation','variable'].includes(s.entity),
		
		// stores
		module:     (s) => s.moduleIdMap[s.moduleId],
		modules:    (s) => s.$store.getters['schema/modules'],
		moduleIdMap:(s) => s.$store.getters['schema/moduleIdMap'],
		capApp:     (s) => s.$store.getters.captions.builder.new,
		capGen:     (s) => s.$store.getters.captions.generic
	},
	mounted() {
		// apply preset input values
		for(let k in this.inputs) {
			if(typeof this.presets[k] !== 'undefined')
				this.inputs[k] = this.presets[k];
		}
		
		this.$store.commit('keyDownHandlerSleep');
		this.$store.commit('keyDownHandlerAdd',{fnc:this.set,key:'s',keyCtrl:true});
		this.$store.commit('keyDownHandlerAdd',{fnc:this.close,key:'Escape'});
	},
	unmounted() {
		this.$store.commit('keyDownHandlerDel',this.set);
		this.$store.commit('keyDownHandlerDel',this.close);
		this.$store.commit('keyDownHandlerWake');
	},
	methods:{
		// externals
		getDependentModules,
		getTemplateApi,
		getTemplateCollection,
		getTemplateDoc,
		getTemplateForm,
		getTemplateJsFunction,
		getTemplateModule,
		getTemplatePgFunction,
		getTemplateRelation,
		getTemplateRole,
		getTemplateSearchBar,
		getTemplateVariable,
		getTemplateWidget,
		
		// actions
		close() { this.$emit('close'); },
		
		// backend calls
		set() {
			if(!this.canSave) return;
			
			let action = 'set';
			let request;
			let dependencyCheck = false;
			switch(this.entity) {
				case 'api':	       request = this.getTemplateApi(this.module.id,this.inputs.name); break;
				case 'collection': request = this.getTemplateCollection(this.module.id,this.inputs.name); break;
				case 'jsFunction': request = this.getTemplateJsFunction(this.moduleId,this.inputs.formId,this.inputs.name); break;
				case 'module':     request = this.getTemplateModule(this.inputs.name); break;
				case 'pgFunction': request = this.getTemplatePgFunction(this.moduleId,this.inputs.name,this.inputs.template,this.inputs.isTrigger); break;
				case 'relation':   request = this.getTemplateRelation(this.module.id,this.inputs.name,this.inputs.encryption); break;
				case 'role':       request = this.getTemplateRole(this.moduleId,this.inputs.name); break;
				case 'searchBar':  request = this.getTemplateSearchBar(this.moduleId,this.inputs.name); break;
				case 'variable':   request = this.getTemplateVariable(this.moduleId,this.inputs.formId,this.inputs.name); break;
				case 'widget':     request = this.getTemplateWidget(this.moduleId,this.inputs.name); break;
				case 'doc':        
					if(this.inputs.docIdDuplicate !== '') {
						action = 'copy';
						request = {
							id:this.inputs.docIdDuplicate,
							moduleId:this.moduleId,
							newName:this.inputs.name
						};
						dependencyCheck = true;
					} else {
						request = this.getTemplateDoc(this.module.id,this.builderLanguage,this.inputs.name);
					}
				break;
				case 'form':
					if(this.inputs.formIdDuplicate !== null) {
						action = 'copy';
						request = {
							id:this.inputs.formIdDuplicate,
							moduleId:this.moduleId,
							newName:this.inputs.name
						};
						dependencyCheck = true;
					} else {
						request = this.getTemplateForm(this.moduleId,this.inputs.name);
					}
				break;
				default: return; break;
			}
			
			let requests = [ws.prepare(this.entity,action,request)];
			
			if(dependencyCheck)
				requests.push(ws.prepare('schema','check',{moduleId:this.moduleId}));
			
			ws.sendMultiple(requests,true).then(
				res => {
					if(this.entity === 'module') this.$root.schemaReload(res[0].payload);
					else                         this.$root.schemaReload(this.moduleId);
					
					this.$emit('close');
				},
				this.$root.genericError
			);
		}
	}
};