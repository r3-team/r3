import {hasAccessToAnyMenu} from './shared/access.js';
import {getFormRoute}       from './shared/form.js';
import {srcBase64}          from './shared/image.js';
export {MyMenu as default};

let MyMenuItem = {
	name:'my-menu-item',
	template:`<div class="item" v-if="active">
		<!-- menu item line -->
		<div class="line noHighlight" tabindex="0"
			:class="{ active:selected, noForm:menu.formId === null }"
			@click="click"
			@click.middle="clickMiddle"
			@keyup.enter.space="click"
		>
			<img
				v-if="menu.iconId !== null"
				:src="srcBase64(iconIdMap[menu.iconId].file)"
			/>
			
			<!-- menu item caption -->
			<div class="caption">{{ title }}</div>
			
			<!-- sub menu indicator -->
			<img
				v-if="anyAccessibleChildren"
				@click.stop="clickSubMenus"
				@keyup.enter.space.stop="clickSubMenus"
				:src="subIcon"
			/>
		</div>
		
		<!-- menu item children -->
		<template v-if="showChildren && anyAccessibleChildren">
			<my-menu-item class="item sub"
				v-for="m in menu.menus"
				:formIdActive="formIdActive"
				:key="m.id"
				:menu="m"
				:module="module"
			/>
		</template>
	</div>`,
	props:{
		formIdActive:{ type:String, required:true },
		menu:        { type:Object, required:true },
		module:      { type:Object, required:true }
	},
	mounted:function() {
		// show children if no preference is recorded and default is true
		if(typeof this.menuIdMapOpen[this.menu.id] === 'undefined' && this.menu.showChildren)
			this.clickSubMenus();
	},
	computed:{
		active:     function() { return this.menuAccess[this.menu.id] === 1; },
		hasChildren:function() { return this.menu.menus.length !== 0; },
		selected:   function() { return this.menu.formId === this.formIdActive; },
		subIcon:    function() { return this.showChildren ? 'images/triangleDown.png' : 'images/triangleLeft.png'; },
		
		anyAccessibleChildren:function() {
			for(let i = 0, j = this.menu.menus.length; i < j; i++) {
				if(this.menuAccess[this.menu.menus[i].id] === 1)
					return true;
			}
			return false;
		},
		showChildren:function() {
			return this.hasChildren && this.menuIdMapOpen[this.menu.id];
		},
		title:function() {
			if(typeof this.menu.captions.menuTitle[this.moduleLanguage] !== 'undefined')
				return this.menu.captions.menuTitle[this.moduleLanguage];
			
			return this.capGen.missingCaption;
		},
		
		// stores
		menuIdMapOpen: function() { return this.$store.getters['local/menuIdMapOpen']; },
		iconIdMap:     function() { return this.$store.getters['schema/iconIdMap']; },
		capGen:        function() { return this.$store.getters.captions.generic; },
		isMobile:      function() { return this.$store.getters.isMobile; },
		menuAccess:    function() { return this.$store.getters.access.menu; },
		moduleLanguage:function() { return this.$store.getters.moduleLanguage; }
	},
	methods:{
		// externals
		getFormRoute,
		srcBase64,
		
		// actions
		click:function() {
			// no form is set, we can only toggle sub menus (if there)
			if(this.menu.formId === null)
				return this.clickSubMenus();
			
			if(this.menu.formId !== this.formIdActive)
				return this.$router.push(this.getFormRoute(this.menu.formId,0,true));
			
			// form is set and we are already there
			if(!this.isMobile)
				return this.clickSubMenus();
			else
				return this.$store.commit('isAtMenu',false);
		},
		clickMiddle:function() {
 			window.open('#'+this.getFormRoute(this.menu.formId,0,true),'_blank');
		},
		clickSubMenus:function() {
			if(this.hasChildren)
				this.$store.commit('local/menuIdMapOpenToggle',this.menu.id);
		}
	}
};

let MyMenu = {
	name:'my-menu',
	components:{MyMenuItem},
	template:`<div class="menu" v-if="hasAccessToAnyMenu(module.menus,menuAccess)">
		<div class="contentBox scroll">
			<div class="top">
				<div class="area">
					<img class="icon"
						v-if="module.iconId !== null"
						:src="srcBase64(iconIdMap[module.iconId].file)"
					/>
					<h1>{{ moduleCaption }}</h1>
				</div>
				
				<my-button image="builder.png"
					v-if="isAdmin && builderEnabled && !isMobile && !productionMode"
					@trigger="openBuilder"
					:darkBg="true"
				/>
			</div>
			
			<!-- empty top row in menu for compact mode -->
			<div class="top lower" v-if="settings.compact && !isMobile" />
			
			<div class="items">
				<my-menu-item
					v-for="m in module.menus"
					:formIdActive="formId"
					:key="m.id"
					:menu="m"
					:module="module"
				/>
			</div>
		</div>
	</div>`,
	props:{
		isActiveModule:{ type:Boolean, required:true },
		formId:        { type:String,  required:false, default:'' },
		module:        { type:Object,  required:true }
	},
	computed:{
		moduleCaption:function() {
			// 1st preference: dedicated module title
			if(typeof this.module.captions.moduleTitle[this.moduleLanguage] !== 'undefined')
				return this.module.captions.moduleTitle[this.moduleLanguage];
			
			// if nothing else is available: module name
			return this.moduleIdMap[this.module.id].name;
		},
		
		// stores
		moduleIdMap:   function() { return this.$store.getters['schema/moduleIdMap']; },
		iconIdMap:     function() { return this.$store.getters['schema/iconIdMap']; },
		builderEnabled:function() { return this.$store.getters.builderEnabled; },
		isAdmin:       function() { return this.$store.getters.isAdmin; },
		isMobile:      function() { return this.$store.getters.isMobile; },
		menuAccess:    function() { return this.$store.getters.access.menu; },
		moduleLanguage:function() { return this.$store.getters.moduleLanguage; },
		productionMode:function() { return this.$store.getters.productionMode; },
		settings:      function() { return this.$store.getters.settings; }
	},
	methods:{
		// externals
		hasAccessToAnyMenu,
		srcBase64,
		
		// actions
		openBuilder:function() {
			this.$router.push('/builder/menu/'+this.module.id);
		}
	}
};