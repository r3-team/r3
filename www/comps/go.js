import MyForm                 from './form.js';
import MyMenu                 from './menu.js';
import {hasAccessToAnyMenu}   from './shared/access.js';
import {getValidLanguageCode} from './shared/language.js';
export {MyGoForm, MyGoModule};

let MyGoModule = {
	name:'my-go-module',
	template:`<div />`,
	props:{
		moduleEntries:  { type:Array,  required:true },
		moduleName:     { type:String, required:true },
		moduleNameChild:{ type:String, required:false, default:'' }
	},
	computed:{
		modules:      function() { return this.$store.getters['schema/modules']; },
		moduleNameMap:function() { return this.$store.getters['schema/moduleNameMap']; },
		menuAccess:   function() { return this.$store.getters.access.menu; }
	},
	mounted:function() {
		// route to home if invalid module was given
		if(typeof this.moduleNameMap[this.moduleName] === 'undefined')
			return this.$router.push('/');
		
		let module = this.moduleNameMap[this.moduleName];
		
		// route to start form of child module
		if(this.moduleNameChild !== '') {
			if(typeof this.moduleNameMap[this.moduleNameChild] === 'undefined')
				return this.$router.push('/');
			
			let moduleChild = this.moduleNameMap[this.moduleNameChild];
			
			if(moduleChild.formId !== null && this.hasAccessToAnyMenu(moduleChild.menus,this.menuAccess))
				return this.$router.replace(`/app/${module.name}/${moduleChild.name}/form/${moduleChild.formId}`);
		}
		
		// route to start form of module directly
		if(module.formId !== null && this.hasAccessToAnyMenu(module.menus,this.menuAccess))
			return this.$router.replace(`/app/${module.name}/${module.name}/form/${module.formId}`);
		
		// start form (or module in general) is inaccessible, reroute to first accessible child module
		for(let i = 0, j = this.moduleEntries.length; i < j; i++) {
			let m = this.moduleEntries[i];
			
			if(m.id === module.id && m.children.length > 0)
				return this.$router.replace(`/app/${module.name}/${m.children[0].name}/form/${m.children[0].formId}`);
		}
		
		// no start form exists, route to home
		return this.$router.push('/');
	},
	methods:{
		hasAccessToAnyMenu
	}
};

let MyGoForm = {
	name:'my-go-form',
	components:{ MyForm, MyMenu },
	template:`<div v-if="module">
		<my-menu class="noPrint"
			v-if="!isMobile || isAtMenu"
			v-for="m in modules.filter(v => v.id === module.id)"
			:isActiveModule="m.id === module.id"
			:formId="formId"
			:key="m.id"
			:module="m"
		/>
		<my-form
			v-show="!isMobile || !isAtMenu"
			:formId="formId"
			:module="module"
			:recordId="recordId"
		/>
	</div>`,
	props:{
		formId:         { type:String, required:true },
		moduleName:     { type:String, required:true },
		moduleNameChild:{ type:String, required:false, default:'' },
		recordIdString: { type:String, required:false, default:'' }
	},
	data:function() {
		return {
			module:false
		};
	},
	watch:{
		moduleNameActive:function() {
			this.loadModuleMeta();
		}
	},
	computed:{
		moduleNameActive:function() {
			// child takes precedence if active
			return this.moduleNameChild !== ''
				? this.moduleNameChild
				: this.moduleName
			;
		},
		recordId:function() {
			if(typeof this.recordIdString === 'undefined' || this.recordIdString === '')
				return 0;
			
			return parseInt(this.recordIdString);
		},
		
		// stores
		modules:      function() { return this.$store.getters['schema/modules']; },
		moduleNameMap:function() { return this.$store.getters['schema/moduleNameMap']; },
		formIdMap:    function() { return this.$store.getters['schema/formIdMap']; },
		isAtMenu:     function() { return this.$store.getters.isAtMenu; },
		isMobile:     function() { return this.$store.getters.isMobile; }
	},
	mounted:function() {
		this.loadModuleMeta();
	},
	methods:{
		// externals
		getValidLanguageCode,
		
		loadModuleMeta:function() {
			// module cannot be resolved, go home
			if(typeof this.moduleNameMap[this.moduleNameActive] === 'undefined')
				return this.$router.push('/');
			
			this.module = this.moduleNameMap[this.moduleNameActive];
			
			this.$store.commit('moduleColor1',this.module.color1);
			this.$store.commit('moduleLanguage',this.getValidLanguageCode(this.module));
		}
	}
};