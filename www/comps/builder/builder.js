import MyBuilderDocs             from './builderDocs.js';
import MyBuilderNew              from './builderNew.js';
import {getJsFunctionsProcessed} from '../shared/builder.js';
import srcBase64Icon             from '../shared/image.js';
import {getCaptionForLang}       from '../shared/language.js';
import {MyModuleSelect}          from '../input.js';
export {MyBuilder as default};

let MyBuilder = {
	name:'my-builder',
	components:{
		MyBuilderDocs,
		MyBuilderNew,
		MyModuleSelect
	},
	template:`<div class="builder equal-width">
		<div class="navigation" v-if="module" :class="{ isDark:colorMenu.isDark() }" :style="bgStyle">
			<div class="navigation-header">
				<div class="row gap centered">
					<img class="icon"
						:src="srcBase64Icon(module.iconId,'images/module.png')"
					/>
					<span>{{ getCaptionForLang('moduleTitle',builderLanguage,module.id,module.captions,module.name) }}</span>
				</div>
				<my-button image="question.png"
					@trigger="showDocs = !showDocs"
					:captionTitle="capGen.help"
				/>
			</div>
			
			<!-- module navigation -->
			<div class="moduleSelect default-inputs transparent">
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
			<div class="moduleSelect translation default-inputs transparent">
				
				<span>{{ capApp.language }}</span>
				<select class="dynamic" v-model="builderLanguage">
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
						:to="'/builder/start/'+module.id"
					>
						<img src="images/flag.png" />
						<span>{{ capApp.navigationStart }}</span>
					</router-link>
					
					<router-link class="entry clickable"
						:to="'/builder/module/'+module.id"
					>
						<img src="images/module.png" />
						<span>{{ capGen.module }}</span>
					</router-link>
					
					<router-link class="entry clickable"
						:to="'/builder/relations/'+module.id"
					>
						<img src="images/database.png" />
						<span>{{ capGen.relations }}</span>
					</router-link>
					
					<router-link class="entry clickable"
						:to="'/builder/forms/'+module.id"
					>
						<img src="images/fileText.png" />
						<span>{{ capGen.forms }}</span>
					</router-link>
					
					<router-link class="entry clickable"
						:to="'/builder/menu/'+module.id"
					>
						<img src="images/menu.png" />
						<span>{{ capGen.menus }}</span>
					</router-link>
					
					<router-link class="entry clickable"
						:to="'/builder/roles/'+module.id"
					>
						<img src="images/personMultiple.png" />
						<span>{{ capGen.roles }}</span>
					</router-link>
					
					<router-link class="entry clickable"
						:to="'/builder/icons/'+module.id"
					>
						<img src="images/fileImage.png" />
						<span>{{ capGen.icons }}</span>
					</router-link>
					
					<router-link class="entry clickable"
						:to="'/builder/caption-map/'+module.id"
					>
						<img src="images/languages.png" />
						<span>{{ capApp.navigationCaptionMap }}</span>
					</router-link>
				</div>
				<div class="navigation-column">
					<router-link class="entry clickable"
						:to="'/builder/pg-functions/'+module.id"
					>
						<img src="images/codeDatabase.png" />
						<span>{{ capGen.pgFunctions }}</span>
					</router-link>
					
					<router-link class="entry clickable"
						:to="'/builder/js-functions/'+module.id"
					>
						<img src="images/codeScreen.png" />
						<span>{{ capGen.jsFunctions }}</span>
					</router-link>
					
					<router-link class="entry clickable"
						:to="'/builder/collections/'+module.id"
					>
						<img src="images/tray.png" />
						<span>{{ capGen.collections }}</span>
					</router-link>
					
					<router-link class="entry clickable"
						:to="'/builder/login-forms/'+module.id"
					>
						<img src="images/personCog.png" />
						<span>{{ capGen.loginForms }}</span>
					</router-link>
					
					<router-link class="entry clickable"
						:to="'/builder/articles/'+module.id"
					>
						<img src="images/question.png" />
						<span>{{ capGen.articles }}</span>
					</router-link>
					
					<router-link class="entry clickable"
						:to="'/builder/apis/'+module.id"
					>
						<img src="images/api.png" />
						<span>{{ capGen.apis }}</span>
					</router-link>
					
					<router-link class="entry clickable"
						:to="'/builder/widgets/'+module.id"
					>
						<img src="images/tiles.png" />
						<span>{{ capGen.widgets }}</span>
					</router-link>
					
					<!-- so router link is not last child (CSS) -->
					<div />
				</div>
			</div>
			
			<!-- module sub component navigation header -->
			<div class="navigation-entities-header" v-if="subMenu">
				<router-link class="entry isTitle clickable"
					v-if="navigation === 'forms'"
					:to="'/builder/forms/'+module.id"
				>
					<img src="images/fileText.png" />
					<span>{{ capGen.forms }}</span>
				</router-link>
				<router-link class="entry isTitle clickable"
					v-if="navigation === 'roles'"
					:to="'/builder/roles/'+module.id"
				>
					<img src="images/personMultiple.png" />
					<span>{{ capGen.roles }}</span>
				</router-link>
				<router-link class="entry isTitle clickable"
					v-if="navigation === 'relations'"
					:to="'/builder/relations/'+module.id"
				>
					<img src="images/database.png" />
					<span>{{ capGen.relations }}</span>
				</router-link>
				<router-link class="entry isTitle clickable"
					v-if="navigation === 'collections'"
					:to="'/builder/collections/'+module.id"
				>
					<img src="images/tray.png" />
					<span>{{ capGen.collections }}</span>
				</router-link>
				<router-link class="entry isTitle clickable"
					v-if="navigation === 'apis'"
					:to="'/builder/apis/'+module.id"
				>
					<img src="images/api.png" />
					<span>{{ capGen.apis }}</span>
				</router-link>
				<router-link class="entry isTitle clickable"
					v-if="navigation === 'pg-functions'"
					:to="'/builder/pg-functions/'+module.id"
				>
					<img src="images/codeDatabase.png" />
					<span>{{ capGen.pgFunctions }}</span>
				</router-link>
				<router-link class="entry isTitle clickable"
					v-if="navigation === 'js-functions'"
					:to="'/builder/js-functions/'+module.id"
				>
					<img src="images/codeScreen.png" />
					<span>{{ capGen.jsFunctions }}</span>
				</router-link>
				<div class="row gap centered default-inputs transparent">
					<input class="short" placeholder="..." spellcheck="false"
						v-model="filter"
						:title="capApp.navigationFilterHint"
					/>
					<my-button image="add.png"
						v-if="['apis','collections','forms','js-functions','pg-functions','relations','roles'].includes(navigation)"
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
				
				<!-- APIs -->
				<template v-if="navigation === 'apis'">
					<router-link class="entry clickable"
						v-for="a in module.apis.filter(v => v.name.toLowerCase().includes(filter.toLowerCase()))"
						:key="a.id"
						:to="'/builder/api/'+a.id" 
					>{{ a.name + ' (v' + a.version + ')' }}</router-link>
				</template>
				
				<!-- widgets -->
				<template v-if="navigation === 'widgets'">
					<router-link class="entry clickable"
						v-for="a in module.widgets.filter(v => v.name.toLowerCase().includes(filter.toLowerCase()))"
						:key="a.id"
						:to="'/builder/widget/'+a.id" 
					>{{ a.name }}</router-link>
				</template>
				
				<!-- PG functions -->
				<template v-if="navigation === 'pg-functions'">
					<router-link class="entry clickable"
						v-for="fnc in module.pgFunctions.filter(v => v.name.toLowerCase().includes(filter.toLowerCase()))"
						:key="fnc.id"
						:to="'/builder/pg-function/'+fnc.id" 
					>{{ fnc.name }}</router-link>
				</template>
				
				<!-- JS functions -->
				<template v-if="navigation === 'js-functions'">
					<router-link class="entry clickable"
						v-for="fnc in jsFunctions"
						:key="fnc.id"
						:to="'/builder/js-function/'+fnc.id" 
					>
						<span><b v-if="fnc.formId !== null">{{ formIdMap[fnc.formId].name }}: </b>{{ fnc.name }}</span>
					</router-link>
				</template>
			</div>
		</div>
		
		<router-view
			v-if="isReady"
			v-show="!showDocs"
			@createNew="createNew"
			@nextLanguage="nextLanguage"
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
			v-if="createNewOpen"
			@close="createNewEntity = null"
			:entity="createNewEntity"
			:moduleId="moduleId"
			:presets="createNewPresets"
		/>
	</div>`,
	created() {
		this.$store.commit('keyDownHandlerAdd',{fnc:this.nextLanguage,key:'q',keyCtrl:true});
	},
	unmounted() {
		this.$store.commit('keyDownHandlerDel',this.nextLanguage);
	},
	data() {
		return {
			builderLanguage:'',   // selected language for translations
			createNewEntity:null, // entity to create (module, relation, ...)
			createNewPresets:{},  // preset inputs for new entity (to provide defaults)
			filter:'',            // simple text filter for menu
			isReady:false,        // ready to show content
			moduleId:'',          // selected module ID
			navigation:'module',
			showDocs:false
		};
	},
	mounted() {
		this.$store.commit('pageTitle',this.capApp.pageTitle);
		
		if(!this.builderEnabled)
			return this.$router.push('/');
		
		this.isReady = true;
	},
	watch:{
		$route:{
			handler(val) {
				if(val.hash === '')
					this.showDocs = false;
				
				if(typeof val.meta.nav === 'undefined') {
					this.moduleId = '';
					this.isReady  = true;
					return;
				}
				
				// ascertain navigation
				this.navigation = val.meta.nav;
				
				// ascertain module ID to be loaded
				let isModule    = ['docs','module','start'].includes(val.meta.target);
				let targetIdMap = this.moduleIdMap;
				
				if(!isModule) {
					switch(val.meta.target) {
						case 'api':         targetIdMap = this.apiIdMap;        break;
						case 'collection':  targetIdMap = this.collectionIdMap; break;
						case 'form':        targetIdMap = this.formIdMap;       break;
						case 'js-function': targetIdMap = this.jsFunctionIdMap; break;
						case 'relation':    targetIdMap = this.relationIdMap;   break;
						case 'role':        targetIdMap = this.roleIdMap;       break;
						case 'pg-function': targetIdMap = this.pgFunctionIdMap; break;
						case 'widget':      targetIdMap = this.widgetIdMap;     break;
					}
				}
				
				// reroute if invalid target (usually navigating back to deleted entity)
				if(typeof targetIdMap[val.params.id] === 'undefined') {
					this.$router.replace('/builder/modules');
					this.isReady = false;
					return;
				}
				
				// apply module ID from target
				this.moduleId = isModule ? val.params.id : targetIdMap[val.params.id].moduleId;
				
				// set module translation language
				let mod = this.moduleIdMap[this.moduleId];
				
				if(mod.languages.indexOf(this.settings.languageCode) !== -1)
					this.builderLanguage = this.settings.languageCode;
				else if(mod.languages.length !== 0)
					this.builderLanguage = mod.languages[0];
				
				this.isReady = true;
			},
			immediate:true
		}
	},
	computed:{
		subMenu:(s) =>
			s.navigation === 'relations'    && s.module.relations.length   !== 0 ||
			s.navigation === 'forms'        && s.module.forms.length       !== 0 ||
			s.navigation === 'roles'        && s.module.roles.length       !== 0 ||
			s.navigation === 'collections'  && s.module.collections.length !== 0 ||
			s.navigation === 'apis'         && s.module.apis.length        !== 0 ||
			s.navigation === 'js-functions' && s.module.jsFunctions.length !== 0 ||
			s.navigation === 'pg-functions' && s.module.pgFunctions.length !== 0,
		moduleIdInput:{
			get()  { return !this.module ? '' : this.module.id; },
			set(v) {
				if(v === '') this.$router.push(`/builder/modules`);
				else         this.$router.push(`/builder/${this.navigation}/${v}`);
			}
		},
		
		// simple
		createNewOpen:(s) => s.createNewEntity !== null,
		isNew:        (s) => s.moduleId === '',
		jsFunctions:  (s) => s.getJsFunctionsProcessed(s.module.jsFunctions,s.filter),
		module:       (s) => s.isNew ? false : s.moduleIdMap[s.moduleId],
		moduleOwner:  (s) => s.isNew ? true  : s.moduleIdMapMeta[s.moduleId].owner,
		
		// stores
		apiIdMap:       (s) => s.$store.getters['schema/apiIdMap'],
		attributeIdMap: (s) => s.$store.getters['schema/attributeIdMap'],
		collectionIdMap:(s) => s.$store.getters['schema/collectionIdMap'],
		formIdMap:      (s) => s.$store.getters['schema/formIdMap'],
		iconIdMap:      (s) => s.$store.getters['schema/iconIdMap'],
		jsFunctionIdMap:(s) => s.$store.getters['schema/jsFunctionIdMap'],
		moduleIdMap:    (s) => s.$store.getters['schema/moduleIdMap'],
		pgFunctionIdMap:(s) => s.$store.getters['schema/pgFunctionIdMap'],
		relationIdMap:  (s) => s.$store.getters['schema/relationIdMap'],
		roleIdMap:      (s) => s.$store.getters['schema/roleIdMap'],
		widgetIdMap:    (s) => s.$store.getters['schema/widgetIdMap'],
		bgStyle:        (s) => s.$store.getters.colorMenuStyle,
		builderEnabled: (s) => s.$store.getters.builderEnabled,
		capApp:         (s) => s.$store.getters.captions.builder,
		capGen:         (s) => s.$store.getters.captions.generic,
		colorMenu:      (s) => s.$store.getters.colorMenu,
		moduleIdMapMeta:(s) => s.$store.getters.moduleIdMapMeta,
		settings:       (s) => s.$store.getters.settings
	},
	methods:{
		// externals
		getCaptionForLang,
		getJsFunctionsProcessed,
		srcBase64Icon,
		
		// actions
		add() {
			let entity;
			switch(this.navigation) {
				case 'apis':         entity = 'api';        break;
				case 'collections':  entity = 'collection'; break;
				case 'forms':        entity = 'form';       break;
				case 'js-functions': entity = 'jsFunction'; break;
				case 'pg-functions': entity = 'pgFunction'; break;
				case 'relations':    entity = 'relation';   break;
				case 'roles':        entity = 'role';       break;
				case 'widgets':      entity = 'widget';     break;
			}
			this.createNew(entity,{name:this.filter});
		},
		createNew(entity,presets) {
			this.createNewEntity  = entity;
			this.createNewPresets = typeof presets !== 'undefined' ? presets : {};
		},
		nextLanguage() {
			if(this.createNewOpen) return;
			
			let pos = this.module.languages.indexOf(this.builderLanguage);
			if(pos === -1 || pos >= this.module.languages.length - 1)
				return this.builderLanguage = this.module.languages[0];
			
			return this.builderLanguage = this.module.languages[pos+1];
		}
	}
};