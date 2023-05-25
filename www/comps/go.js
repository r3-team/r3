import MyForm                         from './form.js';
import MyMenu                         from './menu.js';
import {getAttributeValuesFromGetter} from './shared/attribute.js';
import {getStartFormId }              from './shared/access.js';
import {getValidLanguageCode}         from './shared/language.js';
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
		access:       (s) => s.$store.getters.access,
		modules:      (s) => s.$store.getters['schema/modules'],
		moduleNameMap:(s) => s.$store.getters['schema/moduleNameMap']
	},
	mounted() {
		// route to home if invalid module was given
		if(typeof this.moduleNameMap[this.moduleName] === 'undefined')
			return this.$router.push('/');
		
		let module = this.moduleNameMap[this.moduleName];
		let startFormId;
		
		// route to start form of child module
		if(this.moduleNameChild !== '') {
			if(typeof this.moduleNameMap[this.moduleNameChild] === 'undefined')
				return this.$router.push('/');
			
			let child = this.moduleNameMap[this.moduleNameChild];
			startFormId = this.getStartFormId(child,this.access);
			
			if(startFormId !== null)
				return this.$router.replace(`/app/${module.name}/${child.name}/form/${startFormId}`);
		}
		
		// route to start form of module directly
		startFormId = this.getStartFormId(module,this.access);
		
		if(startFormId !== null)
			return this.$router.replace(`/app/${module.name}/${module.name}/form/${startFormId}`);
		
		// start form (or module in general) is inaccessible, reroute to first accessible child module
		for(let i = 0, j = this.moduleEntries.length; i < j; i++) {
			let m = this.moduleEntries[i];
			
			if(m.id === module.id && m.children.length > 0)
				return this.$router.replace(`/app/${module.name}/${m.children[0].name}/form/${m.children[0].formId}`);
		}
		
		// no start form exists, route to home
		this.$router.push('/');
	},
	methods:{
		getStartFormId
	}
};

let MyGoForm = {
	name:'my-go-form',
	components:{ MyForm, MyMenu },
	template:`<div v-if="moduleId !== null">
		<my-menu class="noPrint"
			v-if="!isMobile || isAtMenu"
			v-for="m in modules.filter(v => v.id === moduleId)"
			:bgStyle="bgStyle"
			:isActiveModule="m.id === moduleId"
			:formId="formId"
			:key="m.id"
			:module="m"
		/>
		<my-form
			v-show="!isMobile || !isAtMenu"
			:attributeIdMapDef="getterAttributeIdMapDefaults"
			:formId="formId"
			:moduleId="moduleId"
			:recordId="recordId"
		/>
	</div>`,
	props:{
		bgStyle:        { type:String, required:true },
		formId:         { type:String, required:true },
		moduleName:     { type:String, required:true },
		moduleNameChild:{ type:String, required:false, default:'' },
		recordIdString: { type:String, required:false, default:'' }
	},
	data() {
		return {
			moduleId:null
		};
	},
	watch:{
		moduleNameActive:{
			handler() {
				// if module cannot be resolved, go home
				if(typeof this.moduleNameMap[this.moduleNameActive] === 'undefined')
					return this.$router.replace('/');
				
				let module = this.moduleNameMap[this.moduleNameActive];
				this.moduleId = module.id;
				this.$store.commit('moduleIdLast',module.id);
				this.$store.commit('moduleLanguage',this.getValidLanguageCode(module));
			},
			immediate:true
		}
	},
	computed:{
		getterAttributeIdMapDefaults:(s) => typeof s.$route.query.attributes === 'undefined'
			? {} : s.getAttributeValuesFromGetter(s.$route.query.attributes),
		
		moduleNameActive:(s) => s.moduleNameChild !== '' ? s.moduleNameChild : s.moduleName,
		
		recordId:(s) => typeof s.recordIdString === 'undefined' || s.recordIdString === ''
			? 0 : parseInt(s.recordIdString),
		
		// stores
		modules:      (s) => s.$store.getters['schema/modules'],
		moduleNameMap:(s) => s.$store.getters['schema/moduleNameMap'],
		formIdMap:    (s) => s.$store.getters['schema/formIdMap'],
		isAtMenu:     (s) => s.$store.getters.isAtMenu,
		isMobile:     (s) => s.$store.getters.isMobile
	},
	methods:{
		// externals
		getAttributeValuesFromGetter,
		getValidLanguageCode
	}
};