import MyBuilderDocs      from './builderDocs.js';
import MyBuilderNew       from './builderNew.js';
import srcBase64Icon      from '../shared/image.js';
import {getModuleCaption} from '../shared/generic.js';
import {MyModuleSelect}   from '../input.js';
export {MyBuilder as default};

let MyBuilder = {
	name:'my-builder',
	components:{
		MyBuilderDocs,
		MyBuilderNew,
		MyModuleSelect
	},
	template:`<div class="builder equal-width">
		<div class="navigationWrap" v-if="module">
			<div class="navigation contentBox">
				<div class="top lower nowrap">
					<div class="area">
						<img class="icon"
							:src="srcBase64Icon(module.iconId,'images/module.png')"
						/>
						<h1>{{ getModuleCaption(module,builderLanguage) }}</h1>
					</div>
					<div class="area">
						<my-button image="question.png"
							@trigger="showDocs = !showDocs"
							:captionTitle="capGen.help"
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
					<div class="moduleNoOwner"
						v-if="!moduleOwner"
						:title="capApp.noOwnerHint"
					>
						<span>{{ capApp.noOwner }}</span>
						<my-button image="settings.png"
							@trigger="$router.push('/admin/modules')"
						/>
					</div>
					
					<!-- module component navigation -->
					<div class="navigation-two-columns" v-if="module">
						<div class="navigation-column">
							<router-link class="entry clickable"
								:to="'/builder/module/'+module.id"
							>
								<img src="images/module.png" />
								<span>{{ capApp.navigationModule }}</span>
							</router-link>
							
							<router-link class="entry clickable"
								:to="'/builder/relations/'+module.id"
							>
								<img src="images/database.png" />
								<span>{{ capApp.navigationRelations }}</span>
							</router-link>
							
							<router-link class="entry clickable"
								:to="'/builder/roles/'+module.id"
							>
								<img src="images/personMultiple.png" />
								<span>{{ capApp.navigationRoles }}</span>
							</router-link>
							
							<router-link class="entry clickable"
								:to="'/builder/forms/'+module.id"
							>
								<img src="images/form.png" />
								<span>{{ capApp.navigationForms }}</span>
							</router-link>
							
							<router-link class="entry clickable"
								:to="'/builder/menu/'+module.id"
							>
								<img src="images/menu.png" />
								<span>{{ capApp.navigationMenu }}</span>
							</router-link>
						</div>
						<div class="navigation-column">
							<router-link class="entry clickable"
								:to="'/builder/functions/'+module.id"
							>
								<img src="images/code.png" />
								<span>{{ capApp.navigationFunctions }}</span>
							</router-link>
							
							<router-link class="entry clickable"
								:to="'/builder/icons/'+module.id"
							>
								<img src="images/icon.png" />
								<span>{{ capApp.navigationIcons }}</span>
							</router-link>
							
							<router-link class="entry clickable"
								:to="'/builder/collections/'+module.id"
							>
								<img src="images/tray.png" />
								<span>{{ capApp.navigationCollections }}</span>
							</router-link>
							
							<router-link class="entry clickable"
								:to="'/builder/login-forms/'+module.id"
							>
								<img src="images/personCog.png" />
								<span>{{ capApp.navigationLoginForms }}</span>
							</router-link>
							
							<router-link class="entry clickable"
								:to="'/builder/articles/'+module.id"
							>
								<img src="images/question.png" />
								<span>{{ capApp.navigationArticles }}</span>
							</router-link>
							
							<!-- so router link is not last child (CSS) -->
							<div />
						</div>
					</div>
					
					<!-- module sub component navigation header -->
					<div class="navigation-entities-header" v-if="subMenu">
						<div class="line" v-if="navigation === 'forms'">
							<img src="images/form.png" />
							<h1>{{ capApp.navigationForms }}</h1>
						</div>
						<div class="line" v-if="navigation === 'functions'">
							<img src="images/code.png" />
							<h1>{{ capApp.navigationFunctions }}</h1>
						</div>
						<div class="line" v-if="navigation === 'roles'">
							<img src="images/personMultiple.png" />
							<h1>{{ capApp.navigationRoles }}</h1>
						</div>
						<div class="line" v-if="navigation === 'relations'">
							<img src="images/database.png" />
							<h1>{{ capApp.navigationRelations }}</h1>
						</div>
						<div class="line" v-if="navigation === 'collections'">
							<img src="images/tray.png" />
							<h1>{{ capApp.navigationCollections }}</h1>
						</div>
						<div class="row gap centered default-inputs">
							<input class="short" placeholder="..."
								v-model="filter"
								:title="capApp.navigationFilterHint"
							/>
							<my-button image="add.png"
								v-if="['forms','relations','roles'].includes(navigation)"
								@trigger="add"
								:active="moduleOwner"
								:captionTitle="capGen.button.add"
							/>
						</div>
					</div>
					
					<!-- module sub component navigation -->
					<div class="navigation-entities" v-if="subMenu">
						
						<!-- relations -->
						<template v-if="navigation === 'relations'">
							<router-link class="entry clickable"
								v-for="rel in module.relations.filter(v => v.name.toLowerCase().includes(filter.toLowerCase()))"
								:key="rel.id"
								:to="'/builder/relation/'+rel.id" 
							>{{ rel.name }}</router-link>
						</template>
						
						<!-- forms -->
						<template v-if="navigation === 'forms'">
							<router-link class="entry clickable"
								v-for="frm in module.forms.filter(v => v.name.toLowerCase().includes(filter.toLowerCase()))"
								:key="frm.id"
								:to="'/builder/form/'+frm.id" 
							>{{ frm.name }}</router-link>
						</template>
						
						<!-- roles -->
						<template v-if="navigation === 'roles'">
							<router-link class="entry clickable"
								v-for="rol in module.roles.filter(v => v.name.toLowerCase().includes(filter.toLowerCase()))"
								:key="rol.id"
								:to="'/builder/role/'+rol.id" 
							>{{ rol.name }}</router-link>
						</template>
						
						<!-- collections -->
						<template v-if="navigation === 'collections'">
							<router-link class="entry clickable"
								v-for="c in module.collections.filter(v => v.name.toLowerCase().includes(filter.toLowerCase()))"
								:key="c.id"
								:to="'/builder/collection/'+c.id" 
							>{{ c.name }}</router-link>
						</template>
						
						<!-- functions -->
						<template v-if="navigation === 'functions'">
							
							<!-- PG functions -->
							<div class="navigation-entities-header-sub"
								v-if="module.pgFunctions.filter(v => v.name.toLowerCase().includes(filter.toLowerCase())).length > 0"
							>{{ capApp.navigationFunctionsSubBackend }}</div>
							
							<router-link class="entry clickable"
								v-for="fnc in module.pgFunctions.filter(v => v.name.toLowerCase().includes(filter.toLowerCase()))"
								:key="fnc.id"
								:to="'/builder/pg-function/'+fnc.id" 
							>{{ fnc.name }}</router-link>
							
							<!-- JS functions -->
							<div class="navigation-entities-header-sub"
								v-if="module.jsFunctions.filter(v => v.name.toLowerCase().includes(filter.toLowerCase())).length > 0"
							>{{ capApp.navigationFunctionsSubFrontend }}</div>
							
							<router-link class="entry clickable"
								v-for="fnc in module.jsFunctions.filter(v => v.name.toLowerCase().includes(filter.toLowerCase()))"
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
			@createNew="createNew = $event"
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
		
		<!-- new entity dialog -->
		<my-builder-new
			v-if="createNew !== null"
			@close="createNew = null"
			:entity="createNew"
			:moduleId="moduleId"
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
			createNew:null,     // entity to create (module, relation, ...)
			filter:'',          // simple text filter for menu
			hotkeysChild:[],    // hotkeys from child components
			moduleId:'',        // selected module ID
			navigation:'module',
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
				if(id !== '') {
					let mod = this.moduleIdMap[id];
					
					if(mod.languages.indexOf(this.settings.languageCode) !== -1)
						this.builderLanguage = this.settings.languageCode;
					else if(mod.languages.length !== 0)
						this.builderLanguage = mod.languages[0];
				} else {
					this.builderLanguage = 'en_us';
				}
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
			set(v) {
				if(v === '') this.$router.push(`/builder/modules`);
				else         this.$router.push(`/builder/${this.navigation}/${v}`);
			}
		},
		
		// simple
		isNew:      (s) => s.moduleId === '',
		module:     (s) => s.isNew ? false : s.moduleIdMap[s.moduleId],
		moduleOwner:(s) => s.isNew ? true  : s.moduleIdMapOptions[s.moduleId].owner,
		
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
		srcBase64Icon,
		
		// handlers
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
		
		// actions
		add() {
			switch(this.navigation) {
				case 'forms':     this.createNew = 'form';     break;
				case 'relations': this.createNew = 'relation'; break;
				case 'roles':     this.createNew = 'role';     break;
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