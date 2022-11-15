import srcBase64Icon        from './shared/image.js';
import {srcBase64}          from './shared/image.js';
import {hasAccessToAnyMenu} from './shared/access.js';
import {getColumnTitle}     from './shared/column.js';
import {getFormRoute}       from './shared/form.js';
import {getModuleCaption}   from './shared/generic.js';
import {
	getCollectionColumn,
	getCollectionValues
} from './shared/collection.js';

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
			
			<!-- collection values -->
			<div class="collectionEntry" v-for="e in collectionEntries" :title="e.title">
				<img v-if="e.iconId !== null" :src="srcBase64Icon(e.iconId,'')" />
				<span>{{ e.value }}</span>
			</div>
			
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
		collectionEntries:function() {
			let out = [];
			for(let i = 0, j = this.menu.collections.length; i < j; i++) {
				let consumer   = this.menu.collections[i];
				let collection = this.collectionIdMap[consumer.collectionId];
				
				if(!consumer.onMobile && this.isMobile)
					continue;
				
				let value = this.getCollectionValues(
					collection.id,
					consumer.columnIdDisplay,
					true
				);
				if(consumer.noDisplayEmpty && (value === null || value === 0 || value === ''))
					continue;
				
				out.push({
					iconId:collection.iconId,
					title:this.getColumnTitle(this.getCollectionColumn(
						collection.id,
						consumer.columnIdDisplay
					)),
					value:value
				});
			}
			return out;
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
		menuIdMapOpen:  function() { return this.$store.getters['local/menuIdMapOpen']; },
		collectionIdMap:function() { return this.$store.getters['schema/collectionIdMap']; },
		iconIdMap:      function() { return this.$store.getters['schema/iconIdMap']; },
		capGen:         function() { return this.$store.getters.captions.generic; },
		isMobile:       function() { return this.$store.getters.isMobile; },
		menuAccess:     function() { return this.$store.getters.access.menu; },
		moduleLanguage: function() { return this.$store.getters.moduleLanguage; }
	},
	methods:{
		// externals
		getCollectionColumn,
		getCollectionValues,
		getColumnTitle,
		getFormRoute,
		srcBase64,
		srcBase64Icon,
		
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
	template:`<div class="menu"
		:class="{ colored:settings.menuColored }"
		v-if="hasAccessToAnyMenu(module.menus,menuAccess)"
	>
		<div class="contentBox scroll relative">
			<div class="top lower">
				<div class="area">
					<img class="icon"
						v-if="module.iconId !== null"
						:src="srcBase64(iconIdMap[module.iconId].file)"
					/>
					<h1>{{ getModuleCaption(module,moduleLanguage) }}</h1>
				</div>
				
				<div class="area">
					<my-button image="builder.png"
						v-if="isAdmin && builderEnabled && !isMobile"
						@trigger="openBuilder(false)"
						@trigger-middle="openBuilder(true)"
						:naked="true"
						:tight="true"
					/>
				</div>
			</div>
			
			<div class="items-bg"
				:style="settings.menuColored ? bgStyle : ''"
			></div>
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
		bgStyle:       { type:String,  required:true },
		isActiveModule:{ type:Boolean, required:true },
		formId:        { type:String,  required:false, default:'' },
		module:        { type:Object,  required:true }
	},
	computed:{
		// stores
		moduleIdMap:   function() { return this.$store.getters['schema/moduleIdMap']; },
		iconIdMap:     function() { return this.$store.getters['schema/iconIdMap']; },
		builderEnabled:function() { return this.$store.getters.builderEnabled; },
		isAdmin:       function() { return this.$store.getters.isAdmin; },
		isMobile:      function() { return this.$store.getters.isMobile; },
		menuAccess:    function() { return this.$store.getters.access.menu; },
		moduleLanguage:function() { return this.$store.getters.moduleLanguage; },
		settings:      function() { return this.$store.getters.settings; }
	},
	methods:{
		// externals
		getModuleCaption,
		hasAccessToAnyMenu,
		srcBase64,
		
		// actions
		openBuilder:function(middle) {
			if(!middle) this.$router.push('/builder/menu/'+this.module.id);
			else        window.open('#/builder/menu/'+this.module.id,'_blank');
		}
	}
};