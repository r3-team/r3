import {getDependentModules} from '../shared/builder.js';
import {getQueryTemplate}    from '../shared/query.js';
import {getNilUuid}          from '../shared/generic.js';
import {
	getTemplateArgs,
	getTemplateFnc,
	getTemplateReturn
} from '../shared/templates.js';
export {MyBuilderNew as default};

let MyBuilderNew = {
	name:'my-builder-new',
	template:`<div class="app-sub-window under-header" @mousedown.self="$emit('close')">
		<div class="contentBox builder-new popUp">
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
			
			<div class="content default-inputs">
				<div class="row gap centered">
					<span>{{ capGen.name }}</span>
					<input v-model="name" v-focus />
				</div>
				
				<div
					v-if="typeof capApp.message[entity] !== 'undefined'"
					v-html="capApp.message[entity]"
				></div>
				
				<!-- additional options -->
				<div class="options" v-if="showOptions">
					<h2>{{ capApp.options }}</h2>
					
					<!-- form: duplicate form -->
					<template v-if="entity === 'form'">
						<div class="row centered gap">
							<span>{{ capApp.formIdDuplicate }}</span>
							<select v-model="formIdDuplicate">
								<option :value="null">-</option>
								<option v-for="f in module.forms" :value="f.id">{{ f.name }}</option>
								<optgroup
									v-for="mod in getDependentModules(module,modules).filter(v => v.id !== module.id && v.forms.length !== 0)"
									:label="mod.name"
								>
									<option v-for="f in mod.forms" :value="f.id">{{ f.name }}</option>
								</optgroup>
							</select>
						</div>
					</template>
					
					<!-- JS function: assigned form -->
					<template v-if="entity === 'jsFunction'">
						<div class="row centered gap">
							<span>{{ capApp.jsFunctionFormId }}</span>
							<select v-model="formId">
								<option :value="null">-</option>
								<option v-for="f in module.forms" :value="f.id">{{ f.name }}</option>
							</select>
						</div>
						<p v-html="capApp.jsFunctionFormIdHint"></p>
					</template>
					
					<!-- PG function: trigger/function template -->
					<template v-if="entity === 'pgFunction'">
						<div class="row centered gap">
							<span>{{ capApp.pgFunctionTemplate }}</span>
							<select v-model="template">
								<option value="">-</option>
								<option value="mailsFromSpooler">{{ capApp.template.mailsFromSpooler }}</option>
								<option value="restAuthRequest">{{ capApp.template.restAuthRequest }}</option>
								<option value="restAuthResponse">{{ capApp.template.restAuthResponse }}</option>
								<option value="restDataResponse">{{ capApp.template.restDataResponse }}</option>
							</select>
						</div>
						<hr />
						
						<div class="row centered">
							<span>{{ capApp.pgFunctionTrigger }}</span>
							<my-bool v-model="isTrigger" />
						</div>
						<p v-html="capApp.pgFunctionTriggerHint"></p>
					</template>
					
					<!-- relation: E2EE encryption -->
					<template v-if="entity === 'relation'">
						<div class="row centered">
							<span>{{ capApp.relationEncryption }}</span>
							<my-bool v-model="encryption" />
						</div>
						<p v-html="capApp.relationEncryptionHint"></p>
					</template>
				</div>
				
				<div class="actions">
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
		entity:  { type:String, required:true },
		moduleId:{ type:String, required:true },
	},
	emits:['close'],
	data() {
		return {
			// all entities
			name:'',
			
			// form
			formIdDuplicate:null,
			
			// JS function
			formId:null,
			
			// PG function
			isTrigger:false,
			template:'',
			
			// relation
			encryption:false
		};
	},
	computed:{
		// inputs
		canSave:(s) => s.name !== '',
		
		// presentation
		title:(s) => {
			switch(s.entity) {
				case 'api':        return s.capApp.api;        break;
				case 'collection': return s.capApp.collection; break;
				case 'form':       return s.capApp.form;       break;
				case 'jsFunction': return s.capApp.jsFunction; break;
				case 'module':     return s.capApp.module;     break;
				case 'pgFunction': return s.capApp.pgFunction; break;
				case 'relation':   return s.capApp.relation;   break;
				case 'role':       return s.capApp.role;       break;
			}
			return '';
		},
		titleImgSrc:(s) => {
			switch(s.entity) {
				case 'api':        return 'images/api.png';            break;
				case 'collection': return 'images/tray.png';           break;
				case 'form':       return 'images/fileText.png';       break;
				case 'jsFunction': return 'images/codeScreen.png';     break;
				case 'module':     return 'images/module.png';         break;
				case 'pgFunction': return 'images/codeDatabase.png';   break;
				case 'relation':   return 'images/database.png';       break;
				case 'role':       return 'images/personMultiple.png'; break;
			}
			return '';
		},
		showOptions:(s) => ['form','jsFunction','pgFunction','relation'].includes(s.entity),
		
		// stores
		module:     (s) => s.moduleIdMap[s.moduleId],
		modules:    (s) => s.$store.getters['schema/modules'],
		moduleIdMap:(s) => s.$store.getters['schema/moduleIdMap'],
		capApp:     (s) => s.$store.getters.captions.builder.new,
		capGen:     (s) => s.$store.getters.captions.generic
	},
	mounted() {
		window.addEventListener('keydown',this.handleHotkeys);
	},
	unmounted() {
		window.removeEventListener('keydown',this.handleHotkeys);
	},
	methods:{
		// externals
		getDependentModules,
		getNilUuid,
		getQueryTemplate,
		getTemplateArgs,
		getTemplateFnc,
		getTemplateReturn,
		
		// actions
		handleHotkeys(e) {
			if(e.ctrlKey && e.key === 's' && this.canSave) {
				this.set();
				e.preventDefault();
			}
			if(e.key === 'Escape') {
				this.$emit('close');
				e.preventDefault();
			}
		},
		
		// backend calls
		set() {
			let action = 'set';
			let request;
			switch(this.entity) {
				case 'api':
					request = {
						id:this.getNilUuid(),
						moduleId:this.moduleId,
						name:this.name,
						comment:null,
						columns:[],
						query:this.getQueryTemplate(),
						hasDelete:false,
						hasGet:true,
						hasPost:false,
						limitDef:100,
						limitMax:1000,
						verboseDef:true,
						version:1
					};
				break;
				case 'collection':
					request = {
						id:this.getNilUuid(),
						moduleId:this.moduleId,
						iconId:null,
						name:this.name,
						columns:[],
						query:this.getQueryTemplate(),
						inHeader:[]
					};
				break;
				case 'form':
					if(this.formIdDuplicate !== null) {
						action = 'copy';
						request = {
							id:this.formIdDuplicate,
							moduleId:this.moduleId,
							newName:this.name
						};
					} else {
						request = {
							id:this.getNilUuid(),
							moduleId:this.moduleId,
							presetIdOpen:null,
							iconId:null,
							name:this.name,
							noDataActions:false,
							query:this.getQueryTemplate(),
							fields:[],
							functions:[],
							states:[],
							articleIdsHelp:[],
							captions:{
								formTitle:{}
							}
						};
					}
				break;
				case 'jsFunction':
					request = {
						id:this.getNilUuid(),
						moduleId:this.moduleId,
						formId:this.formId,
						name:this.name,
						codeArgs:'',
						codeFunction:'',
						codeReturns:'',
						captions:{
							jsFunctionTitle:{},
							jsFunctionDesc:{}
						}
					};
				break;
				case 'module':
					request = {
						id:this.getNilUuid(),
						parentId:null,
						formId:null,
						iconId:null,
						name:this.name,
						color1:'217A4D',
						position:0,
						releaseBuild:0,
						releaseBuildApp:0,
						releaseDate:0,
						languageMain:'en_us',
						languages:['en_us'],
						dependsOn:[],
						startForms:[],
						articleIdsHelp:[],
						captions:{
							moduleTitle:{}
						}
					};
				break;
				case 'pgFunction':
					request = {
						id:this.getNilUuid(),
						moduleId:this.moduleId,
						name:this.name,
						codeArgs:this.getTemplateArgs(this.template),
						codeFunction:this.getTemplateFnc(this.template,this.isTrigger),
						codeReturns:this.getTemplateReturn(this.isTrigger),
						isFrontendExec:false,
						isTrigger:this.isTrigger,
						schedules:[],
						captions:{
							pgFunctionTitle:{},
							pgFunctionDesc:{}
						}
					};
				break;
				case 'relation':
					request = {
						id:this.getNilUuid(),
						moduleId:this.moduleId,
						name:this.name,
						comment:null,
						encryption:this.encryption,
						retentionCount:null,
						retentionDays:null,
						policies:[]
					};
				break;
				case 'role':
					request = {
						id:this.getNilUuid(),
						moduleId:this.moduleId,
						content:'user',
						name:this.name,
						assignable:true,
						captions:{},
						childrenIds:[],
						accessApis:{},
						accessAttributes:{},
						accessCollections:{},
						accessMenus:{},
						accessRelations:{}
					};
				break;
				default: return; break;
			}
			
			ws.send(this.entity,action,request,true).then(
				() => {
					if(this.entity === 'module')
						this.$root.schemaReload();
					else
						this.$root.schemaReload(this.moduleId);
					
					this.$emit('close');
				},
				this.$root.genericError
			);
		}
	}
};