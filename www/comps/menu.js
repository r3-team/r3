import srcBase64Icon        from './shared/image.js';
import {srcBase64}          from './shared/image.js';
import {getColumnTitle}     from './shared/column.js';
import {getFormRoute}       from './shared/form.js';
import {openLink}           from './shared/generic.js';
import {getCaption}         from './shared/language.js';
import {
	getCollectionColumn,
	getCollectionValues
} from './shared/collection.js';

export {MyMenu as default};

let MyMenuFavoritesEdit = {
	name:'my-menu-favorites-edit',
	template:`<div class="menu-favorites-edit default-inputs">
		<draggable handle=".dragAnchor" class="menu-favorites-edit-list" group="favorites" itemKey="id" animation="150"
			:list="favoritesEdit"
		>
			<template #item="{element,index}">
				<div class="row gap centered">
					<img v-if="favoritesEdit.length > 1" class="dragAnchor" src="images/drag.png" />
					<input v-model="element.title" />
					<my-button image="delete.png"
						@trigger="remove(index)"
						:cancel="true"
					/>
				</div>
			</template>
		</draggable>

		<div class="row gap space-between">
			<my-button image="save.png"
				@trigger="set"
				:active="hasChanges"
				:caption="capGen.button.save"
			/>
			<my-button image="cancel.png"
				@trigger="reset"
				:cancel="true"
				:caption="capGen.button.cancel"
			/>
		</div>
	</div>`,
	props:{
		favorites:{ type:Array,  required:true },
		moduleId: { type:String, required:true }
	},
	emits:['close'],
	computed:{
		// simple
		hasChanges:(s) => JSON.stringify(s.favorites) !== JSON.stringify(s.favoritesEdit),

		// stores
		loginFavorites:(s) => s.$store.getters['local/loginFavorites'],
		capGen:        (s) => s.$store.getters.captions.generic
	},
	data() {
		return {
			favoritesEdit:[]
		};
	},
	mounted() {
		this.favoritesEdit = JSON.parse(JSON.stringify(this.favorites));
	},
	methods:{
		// actions
		remove(i) {
			this.favoritesEdit.splice(i,1);
		},
		reset() {
			this.$emit('close');
		},
		set() {
			let m = JSON.parse(JSON.stringify(this.loginFavorites.moduleIdMap));
			m[this.moduleId] = this.favoritesEdit;
			this.$store.commit('local/loginFavoritesModuleIdMapChange',m);
			this.$emit('close');
		}
	}
};

let MyMenuFavorite = {
	name:'my-menu-favorite',
	template:`<div class="item">
		<div class="line noHighlight" tabindex="0"
			@click="click"
			@click.middle="clickMiddle"
			@keyup.enter.space="click"
		>
			<div class="caption">{{ title }}</div>
		</div>
	</div>`,
	props:{
		favoriteId:{ type:String, required:true },
		formId:    { type:String, required:true },
		moduleId:  { type:String, required:true },
		recordId:  { required:true },
		title:     { type:String, required:true }
	},
	computed:{
		route:(s) => s.getFormRoute(s.favoriteId,s.formId,s.recordId === null ? 0 : s.recordId,true)
	},
	methods:{
		// externals
		getFormRoute,

		// actions
		click()       { this.$router.push(this.route); },
		clickMiddle() { window.open('#'+this.route,'_blank'); }
	}
};

let MyMenuItem = {
	name:'my-menu-item',
	template:`<div class="item" v-if="active">
		<!-- menu item line -->
		<div class="line noHighlight" tabindex="0"
			@click="click"
			@click.middle="clickMiddle"
			@keyup.enter.space="click"
			:class="{ active:selected, noForm:menu.formId === null, showsChildren:showChildren }"
			:style="style"
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
		<div class="menu-items-children" v-if="showChildren && anyAccessibleChildren">
			<my-menu-item class="item sub"
				v-for="m in menu.menus"
				:colorParent="menu.color"
				:formIdActive="formIdActive"
				:formOpensPreset="formOpensPreset"
				:key="m.id"
				:menu="m"
				:module="module"
				:recordOpen="recordOpen"
			/>
		</div>
	</div>`,
	props:{
		colorParent:    { required:true },
		formIdActive:   { type:String,  required:true },
		formOpensPreset:{ type:Boolean, required:true },
		menu:           { type:Object,  required:true },
		module:         { type:Object,  required:true },
		recordOpen:     { type:Boolean, required:true }
	},
	mounted() {
		// show children if no preference is recorded and default is true
		if(this.menuIdMapOpen[this.menu.id] === undefined && this.menu.showChildren)
			this.clickSubMenus();
	},
	computed:{
		anyAccessibleChildren:(s) => {
			for(let i = 0, j = s.menu.menus.length; i < j; i++) {
				if(s.menuAccess[s.menu.menus[i].id] === 1)
					return true;
			}
			return false;
		},
		collectionEntries:(s) => {
			let out = [];
			for(let consumer of s.menu.collections) {
				const collection = s.collectionIdMap[consumer.collectionId];
				
				if(!consumer.onMobile && s.isMobile)
					continue;
				
				let value = s.getCollectionValues(
					collection.id,
					consumer.columnIdDisplay,
					true
				);
				if(consumer.noDisplayEmpty && (value === null || value === 0 || value === ''))
					continue;
				
				out.push({
					iconId:collection.iconId,
					title:s.getColumnTitle(s.getCollectionColumn(
						collection.id,
						consumer.columnIdDisplay
					),collection.moduleId),
					value:value
				});
			}
			return out;
		},
		
		// simple
		active:      (s) => s.menuAccess[s.menu.id] === 1,
		color:       (s) => s.menu.color !== null ? s.menu.color : (s.colorParent !== null ? s.colorParent : null),
		hasChildren: (s) => s.menu.menus.length !== 0,
		selected:    (s) => (!s.recordOpen || s.formOpensPreset) && s.menu.formId === s.formIdActive,
		showChildren:(s) => s.hasChildren && s.menuIdMapOpen[s.menu.id],
		style:       (s) => s.color === null ? '' : `border-left-color:#${s.color};`,
		subIcon:     (s) => s.showChildren ? 'images/triangleDown.png' : 'images/triangleLeft.png',
		title:       (s) => s.getCaption('menuTitle',s.module.id,s.menu.id,s.menu.captions,s.capGen.missingCaption),
		
		// stores
		collectionIdMap:(s) => s.$store.getters['schema/collectionIdMap'],
		iconIdMap:      (s) => s.$store.getters['schema/iconIdMap'],
		menuIdMapOpen:  (s) => s.$store.getters['local/menuIdMapOpen'],
		capGen:         (s) => s.$store.getters.captions.generic,
		isMobile:       (s) => s.$store.getters.isMobile,
		menuAccess:     (s) => s.$store.getters.access.menu
	},
	methods:{
		// externals
		getCollectionColumn,
		getCollectionValues,
		getColumnTitle,
		getFormRoute,
		getCaption,
		srcBase64,
		srcBase64Icon,
		
		// actions
		click() {
			// no form is set, we can only toggle sub menus (if there)
			if(this.menu.formId === null)
				return this.clickSubMenus();
			
			if(this.menu.formId !== this.formIdActive || (this.recordOpen && !this.formOpensPreset))
				return this.$router.push(this.getFormRoute(null,this.menu.formId,0,true));
			
			// form is set and we are already there
			if(!this.isMobile) return this.clickSubMenus();
			else               return this.$store.commit('isAtMenu',false);
		},
		clickMiddle() {
			if(this.menu.formId !== null)
 				window.open('#'+this.getFormRoute(null,this.menu.formId,0,true),'_blank');
		},
		clickSubMenus() {
			if(this.hasChildren)
				this.$store.commit('local/menuIdMapOpenToggle',this.menu.id);
		}
	}
};

let MyMenu = {
	name:'my-menu',
	components:{
		MyMenuFavorite,
		MyMenuFavoritesEdit,
		MyMenuItem
	},
	template:`<div class="menu"
		:class="{ isDark:color.isDark() }"
		:style="bgStyle"
		v-if="menuTabsAccess.length !== 0"
	>
		<div class="menu-header row space-between gap">
			<div class="row centered gap">
				<img class="icon"
					v-if="module.iconId !== null"
					:src="srcBase64(iconIdMap[module.iconId].file)"
				/>
				<span>{{ getCaption('moduleTitle',module.id,module.id,module.captions,module.name) }}</span>
			</div>
			
			<my-button image="builder.png"
				v-if="isAdmin && builderEnabled && !isMobile"
				@trigger="openBuilder(false)"
				@trigger-middle="openBuilder(true)"
				:captionTitle="capGen.button.openBuilder"
			/>
		</div>
		<div class="menu-tabs">
			<div class="menu-tab clickable"
				v-for="(mt,i) in menuTabsAccess"
				@click.left="menuTabIndexShown = i; isAtFavorites = false"
				:class="{ active:i === menuTabIndexShown && !isAtFavorites, centered:!showTabLabels }"
				:style="tabStyles"
				:title="getCaption('menuTabTitle',module.id,mt.id,mt.captions,capGen.menu)"
			>
				<img :src="srcBase64Icon(mt.iconId,'images/files_list1.png')" />
				<span v-if="showTabLabels">{{ getCaption('menuTabTitle',module.id,mt.id,mt.captions,capGen.menu) }}</span>
			</div>
			<div class="menu-tab clickable"
				@click="isAtFavorites = true"
				:class="{ active:isAtFavorites, centered:!showTabLabels }"
				:style="tabStyles"
				:title="capGen.favorites"
			>
				<img src="images/star1.png" />
				<span v-if="showTabLabels">{{ capGen.favorites }}</span>
			</div>
		</div>
		<div class="menu-content">
			<div class="menu-items">
				<template v-if="!isAtFavorites" v-for="(mt,mti) in menuTabsAccess">
					<my-menu-item
						v-if="mti === menuTabIndexShown"
						v-for="m in mt.menus"
						:colorParent="null"
						:formIdActive="formIdActive"
						:formOpensPreset="formOpensPreset"
						:key="m.id"
						:menu="m"
						:module="module"
						:recordOpen="recordOpen"
					/>
				</template>
				<template v-if="isAtFavorites">
					<my-menu-favorite
						v-if="!isAtFavoritesEdit"
						v-for="f in favorites"
						:favoriteId="f.id"
						:formId="f.formId"
						:key="f.id"
						:moduleId="module.id"
						:recordId="f.recordId"
						:title="f.title"
					/>
					<my-menu-favoritesEdit
						v-if="isAtFavoritesEdit"
						@close="isAtFavoritesEdit = false"
						:favorites="favorites"
						:moduleId="module.id"
					/>
					<my-button image="edit.png"
						v-if="!isAtFavoritesEdit && favorites.length !== 0"
						@trigger="isAtFavoritesEdit = true"
						:caption="capGen.button.edit"
						:naked="false"
					/>
				</template>
			</div>
			<div class="menu-footer">
				<img class="menu-footer-logo clickable"
					@click="openLink(customLogoUrl,true)"
					:src="customLogo"
				/>
			</div>
		</div>
	</div>`,
	props:{
		formIdActive:   { type:String,  required:true },
		formOpensPreset:{ type:Boolean, required:true },
		isActiveModule: { type:Boolean, required:true },
		module:         { type:Object,  required:true },
		recordOpen:     { type:Boolean, required:true }
	},
	computed:{
		menuTabsAccess:(s) => {
			let out = [];
			for(const mt of s.module.menuTabs) {
				for(const m of mt.menus) {
					if(s.menuAccess[m.id] === 1) {
						out.push(mt);
						break;
					}
				}
			}
			return out;
		},

		// simple
		favorites:    (s) => s.loginFavorites.moduleIdMap[s.module.id] === undefined ? [] : s.loginFavorites.moduleIdMap[s.module.id],
		showTabLabels:(s) => s.menuTabsAccess.length < 3,
		tabStyles:    (s) => `width:${100 / (s.menuTabsAccess.length + 1)}%;`,

		// stores
		customLogo:    (s) => s.$store.getters['local/customLogo'],
		customLogoUrl: (s) => s.$store.getters['local/customLogoUrl'],
		loginFavorites:(s) => s.$store.getters['local/loginFavorites'],
		moduleIdMap:   (s) => s.$store.getters['schema/moduleIdMap'],
		iconIdMap:     (s) => s.$store.getters['schema/iconIdMap'],
		bgStyle:       (s) => s.$store.getters.colorMenuStyle,
		builderEnabled:(s) => s.$store.getters.builderEnabled,
		capGen:        (s) => s.$store.getters.captions.generic,
		color:         (s) => s.$store.getters.colorMenu,
		isAdmin:       (s) => s.$store.getters.isAdmin,
		isMobile:      (s) => s.$store.getters.isMobile,
		menuAccess:    (s) => s.$store.getters.access.menu,
		settings:      (s) => s.$store.getters.settings
	},
	data() {
		return {
			// states
			isAtFavorites:false,
			isAtFavoritesEdit:false,
			menuTabIndexShown:0
		};
	},
	methods:{
		// externals
		getCaption,
		openLink,
		srcBase64,
		srcBase64Icon,
		
		// actions
		openBuilder(middle) {
			if(!middle) this.$router.push('/builder/menu/'+this.module.id);
			else        window.open('#/builder/menu/'+this.module.id,'_blank');
		}
	}
};