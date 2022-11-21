import {getNilUuid} from '../shared/generic.js';
export {MyBuilderNew as default};

let MyBuilderNew = {
	name:'my-builder-new',
	template:`<div class="app-sub-window under-header" @mousedown.self="$emit('close')">
		<div class="contentBox builder-new">
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
					<input v-model="name" />
				</div>
				
				<div v-html="capApp.message[entity]"></div>
				
				<!-- additional options -->
				<template v-if="showOptions">
					<br />
					<h2>{{ capApp.options }}</h2>
					
					<!-- relation: E2EE encryption -->
					<template v-if="entity === 'relation'">
						<div class="row centered">
							<span>{{ capApp.relationEncryption }}</span>
							<my-bool v-model="encryption" />
						</div>
						<p v-html="capApp.relationEncryptionHint"></p>
					</template>
				</template>
				
				<div class="actions">
					<my-button image="save.png"
						@trigger="set"
						:active="nameValid"
						:caption="capGen.button.create"
					/>
				</div>
			</div>
		</div>
	</div>`,
	props:{
		entity:  { type:String, required:true },  // module, relation, form, role
		moduleId:{ type:String, required:true },
	},
	emits:['close'],
	data:function() {
		return {
			// all entities
			name:'',
			
			// relation
			encryption:false
		};
	},
	computed:{
		// inputs
		nameValid:(s) => s.name !== '',
		
		// presentation
		title:(s) => {
			switch(s.entity) {
				case 'module':   return s.capApp.module;   break;
				case 'relation': return s.capApp.relation; break;
				case 'role':     return s.capApp.role;     break;
			}
			return '';
		},
		titleImgSrc:(s) => {
			switch(s.entity) {
				case 'module':   return 'images/module.png';         break;
				case 'relation': return 'images/database.png';       break;
				case 'role':     return 'images/personMultiple.png'; break;
			}
			return '';
		},
		showOptions:(s) => ['relation'].includes(s.entity),
		
		// stores
		capApp:(s) => s.$store.getters.captions.builder.new,
		capGen:(s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getNilUuid,
		
		// backend calls
		set() {
			let request;
			switch(this.entity) {
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
				case 'relation':
					request = {
						id:this.getNilUuid(),
						moduleId:this.moduleId,
						name:this.name,
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
						accessAttributes:{},
						accessCollections:{},
						accessMenus:{},
						accessRelations:{}
					};
				break;
				default: return; break;
			}
			
			ws.send(this.entity,'set',request,true).then(
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