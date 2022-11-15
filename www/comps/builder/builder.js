import MyBuilderDocs      from './builderDocs.js';
import {srcBase64}        from '../shared/image.js';
import {getModuleCaption} from '../shared/generic.js';
import {MyModuleSelect}   from '../input.js';
export {MyBuilder as default};

let MyBuilder = {
	name:'my-builder',
	components:{
		MyBuilderDocs,
		MyModuleSelect
	},
	template:`<div class="builder equal-width">
		
		<div class="navigationWrap" v-if="module">
			<div class="navigation contentBox">
				<div class="top lower nowrap">
					<div class="area">
						<img class="icon"
							v-if="module.iconId !== null"
							:src="srcBase64(iconIdMap[module.iconId].file)"
						/>
						<h1>{{ getModuleCaption(module,builderLanguage) }}</h1>
					</div>
					<div class="area">
						<my-button image="question.png"
							@trigger="showDocs = !showDocs"
							:tight="true"
						/>
					</div>
				</div>
				
				<div class="content no-padding">
					
					<!-- module navigation -->
					<div class="moduleSelect default-inputs">
						<my-module-select
							v-model="moduleIdInput"
						/>
						<my-button image="upward.png"
							@trigger="moduleIdInput = ''"
							:active="moduleIdInput !== ''"
							:captionTitle="capApp.backHint"
						/>
					</div>
					
					<!-- language selection -->
					<div class="moduleSelect translation default-inputs">
						
						<span>{{ capApp.language }}</span>
						<select v-model="builderLanguage">
							<option
								v-for="l in module.languages"
								:value="l"
							>{{ l }}</option>
						</select>
						<my-button image="languages.png"
							@trigger="nextLanguage"
							:active="module.languages.length > 1"
							:captionTitle="capApp.languageNextHint"
						/>
					</div>
					
					<!-- module read only -->
					<div class="moduleNoOwner" v-if="!moduleOwner" :title="capApp.noOwnerHint">
						<span>{{ capApp.noOwner }}</span>
						<my-button image="settings.png"
							@trigger="$router.push('/admin/modules')"
						/>
					</div>
					
					<!-- module component navigation -->
					<div class="navigation-two-columns">
						<div class="navigation-column">
							<router-link class="entry center clickable"
								:to="'/builder/relations/'+module.id" 
							>{{ capApp.navigationRelations }}</router-link>
							
							<router-link class="entry center clickable"
								:to="'/builder/roles/'+module.id" 
							>{{ capApp.navigationRoles }}</router-link>
							
							<router-link class="entry center clickable"
								:to="'/builder/forms/'+module.id" 
							>{{ capApp.navigationForms }}</router-link>
							
							<router-link class="entry center clickable"
								:to="'/builder/menu/'+module.id" 
							>{{ capApp.navigationMenu }}</router-link>
							
							<router-link class="entry center clickable"
								:to="'/builder/icons/'+module.id" 
							>{{ capApp.navigationIcons }}</router-link>
						</div>
						<div class="navigation-column">
							<router-link class="entry center clickable"
								:to="'/builder/functions/'+module.id" 
							>{{ capApp.navigationFunctions }}</router-link>
							
							<router-link class="entry center clickable"
								:to="'/builder/collections/'+module.id" 
							>{{ capApp.navigationCollections }}</router-link>
							
							<router-link class="entry center clickable"
								:to="'/builder/login-forms/'+module.id" 
							>{{ capApp.navigationLoginForms }}</router-link>
							
							<router-link class="entry center clickable"
								:to="'/builder/articles/'+module.id" 
							>{{ capApp.navigationArticles }}</router-link>
							
							<!-- so router link is not last child (CSS) -->
							<div />
						</div>
					</div>
					
					<div class="navigation-entities-header" v-if="subMenu">
						<h1 v-if="navigation === 'forms'">{{ capApp.navigationFormsSub }}</h1>
						<h1 v-if="navigation === 'functions'">{{ capApp.navigationFunctionsSub }}</h1>
						<h1 v-if="navigation === 'roles'">{{ capApp.navigationRolesSub }}</h1>
						<h1 v-if="navigation === 'relations'">{{ capApp.navigationRelationsSub }}</h1>
						<h1 v-if="navigation === 'collections'">{{ capApp.navigationCollectionsSub }}</h1>
						<input class="lookup" placeholder="..."
							v-model="filter"
							:title="capApp.navigationFilterHint"
						/>
					</div>
					
					<!-- module sub component navigation -->
					<div class="navigation-entities" v-if="subMenu">
						
						<!-- relations -->
						<template v-if="navigation === 'relations'">
							<router-link class="entry clickable"
								v-for="rel in module.relations.filter(v => v.name.includes(filter))"
								:key="rel.id"
								:to="'/builder/relation/'+rel.id" 
							>{{ rel.name }}</router-link>
						</template>
						
						<!-- forms -->
						<template v-if="navigation === 'forms'">
							<router-link class="entry clickable"
								v-for="frm in module.forms.filter(v => v.name.includes(filter))"
								:key="frm.id"
								:to="'/builder/form/'+frm.id" 
							>{{ frm.name }}</router-link>
						</template>
						
						<!-- roles -->
						<template v-if="navigation === 'roles'">
							<router-link class="entry clickable"
								v-for="rol in module.roles.filter(v => v.name.includes(filter))"
								:key="rol.id"
								:to="'/builder/role/'+rol.id" 
							>{{ rol.name }}</router-link>
						</template>
						
						<!-- collections -->
						<template v-if="navigation === 'collections'">
							<router-link class="entry clickable"
								v-for="c in module.collections.filter(v => v.name.includes(filter))"
								:key="c.id"
								:to="'/builder/collection/'+c.id" 
							>{{ c.name }}</router-link>
						</template>
						
						<!-- functions -->
						<template v-if="navigation === 'functions'">
							
							<!-- PG functions -->
							<div class="navigation-entities-header-sub"
								v-if="module.pgFunctions.filter(v => v.name.includes(filter)).length > 0"
							>{{ capApp.navigationFunctionsSubBackend }}</div>
							
							<router-link class="entry clickable"
								v-for="fnc in module.pgFunctions.filter(v => v.name.includes(filter))"
								:key="fnc.id"
								:to="'/builder/pg-function/'+fnc.id" 
							>{{ fnc.name }}</router-link>
							
							<!-- JS functions -->
							<div class="navigation-entities-header-sub"
								v-if="module.jsFunctions.filter(v => v.name.includes(filter)).length > 0"
							>{{ capApp.navigationFunctionsSubFrontend }}</div>
							
							<router-link class="entry clickable"
								v-for="fnc in module.jsFunctions.filter(v => v.name.includes(filter))"
								:key="fnc.id"
								:to="'/builder/js-function/'+fnc.id" 
							>{{ fnc.name }}</router-link>
						</template>
					</div>
				</div>
			</div>
		</div>
		
		<router-view
			v-if="ready"
			v-show="!showDocs"
			@hotkey="handleHotkeys"
			@hotkeysRegister="hotkeysChild = $event"
			@toggleDocs="showDocs = !showDocs"
			:builderLanguage="builderLanguage"
			:readonly="!moduleOwner"
		/>
		
		<my-builder-docs
			v-if="showDocs"
			@close="showDocs = false"
		/>
	</div>`,
	created:function() {
		window.addEventListener('keydown',this.handleHotkeys);
	},
	unmounted:function() {
		window.removeEventListener('keydown',this.handleHotkeys);
	},
	data:function() {
		return {
			builderLanguage:'', // selected language for translations
			filter:'',          // simple text filter for menu
			hotkeysChild:[],    // hotkeys from child components
			moduleId:'',        // selected module ID
			navigation:'relations',
			ready:false,
			showDocs:false
		};
	},
	mounted:function() {
		this.$store.commit('moduleColor1','');
		this.$store.commit('pageTitle',this.capApp.pageTitle);
		
		if(!this.builderEnabled)
			return this.$router.push('/');
		
		this.ready = true;
	},
	watch:{
		$route:{
			handler:function(val) {
				if(val.hash === '')
					this.showDocs = false;
				
				if(typeof val.meta.nav === 'undefined')
					return this.moduleId = '';
				
				// ascertain navigation
				this.navigation = val.meta.nav;
				
				// ascertain module ID to be loaded
				let id;
				switch(val.meta.target) {
					case 'module':      id = val.params.id;                                break;
					case 'docs':        id = val.params.id;                                break;
					case 'relation':    id = this.relationIdMap[val.params.id].moduleId;   break;
					case 'form':        id = this.formIdMap[val.params.id].moduleId;       break;
					case 'role':        id = this.roleIdMap[val.params.id].moduleId;       break;
					case 'collection':  id = this.collectionIdMap[val.params.id].moduleId; break;
					case 'pg-function': id = this.pgFunctionIdMap[val.params.id].moduleId; break;
					case 'js-function': id = this.jsFunctionIdMap[val.params.id].moduleId; break;
				}
				this.moduleId = id;
				
				// set module translation language
				let mod = this.moduleIdMap[id];
				
				if(mod.languages.indexOf(this.settings.languageCode) !== -1)
					this.builderLanguage = this.settings.languageCode;
				else if(mod.languages.length !== 0)
					this.builderLanguage = mod.languages[0];
			},
			immediate:true
		}
	},
	computed:{
		subMenu:(s) => s.navigation === 'relations' && s.module.relations.length !== 0
			|| s.navigation === 'forms'       && s.module.forms.length !== 0
			|| s.navigation === 'roles'       && s.module.roles.length !== 0
			|| s.navigation === 'collections' && s.module.collections.length !== 0
			|| s.navigation === 'functions'   && (s.module.pgFunctions.length !== 0 || s.module.jsFunctions.length !== 0),
		moduleIdInput:{
			get() {
				if(!this.module) return '';
				return this.module.id;
			},
			set(value) {
				if(value === '')
					this.$router.push(`/builder/modules`);
				else
					this.$router.push(`/builder/${this.navigation}/${value}`);
			}
		},
		
		// simple
		module:     (s) => s.moduleId === '' ? false : s.moduleIdMap[s.moduleId],
		moduleOwner:(s) => s.moduleId === '' ? false : s.moduleIdMapOptions[s.moduleId].owner,
		
		// stores
		modules:           (s) => s.$store.getters['schema/modules'],
		moduleIdMap:       (s) => s.$store.getters['schema/moduleIdMap'],
		moduleIdMapOptions:(s) => s.$store.getters['schema/moduleIdMapOptions'],
		relationIdMap:     (s) => s.$store.getters['schema/relationIdMap'],
		attributeIdMap:    (s) => s.$store.getters['schema/attributeIdMap'],
		formIdMap:         (s) => s.$store.getters['schema/formIdMap'],
		iconIdMap:         (s) => s.$store.getters['schema/iconIdMap'],
		jsFunctionIdMap:   (s) => s.$store.getters['schema/jsFunctionIdMap'],
		pgFunctionIdMap:   (s) => s.$store.getters['schema/pgFunctionIdMap'],
		roleIdMap:         (s) => s.$store.getters['schema/roleIdMap'],
		collectionIdMap:   (s) => s.$store.getters['schema/collectionIdMap'],
		builderEnabled:    (s) => s.$store.getters.builderEnabled,
		capApp:            (s) => s.$store.getters.captions.builder,
		capGen:            (s) => s.$store.getters.captions.generic,
		settings:          (s) => s.$store.getters.settings
	},
	methods:{
		// externals
		getModuleCaption,
		srcBase64,
		
		handleHotkeys(evt) {
			// language switch
			if(evt.ctrlKey && evt.key === 'q')
				this.nextLanguage();
			
			// registered child hotkeys (only if module can be changed)
			if(!this.moduleOwner)
				return;
			
			for(let k of this.hotkeysChild) {
				if(k.keyCtrl && !evt.ctrlKey)
					continue;
				
				if(k.key === evt.key) {
					evt.preventDefault();
					k.fnc();
				}
			}
		},
		nextLanguage() {
			let pos = this.module.languages.indexOf(this.builderLanguage);
			
			if(pos === -1 || pos >= this.module.languages.length - 1)
				return this.builderLanguage = this.module.languages[0];
			
			return this.builderLanguage = this.module.languages[pos+1];
		}
	}
};