import srcBase64Icon        from './shared/image.js';
import {srcBase64}          from './shared/image.js';
import {hasAccessToAnyMenu} from './shared/access.js';
import {getColumnTitle}     from './shared/column.js';
import {getFormRoute}       from './shared/form.js';
import {openLink}           from './shared/generic.js';
import {getCaption}         from './shared/language.js';
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
		if(typeof this.menuIdMapOpen[this.menu.id] === 'undefined' && this.menu.showChildren)
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
				return this.$router.push(this.getFormRoute(this.menu.formId,0,true));
			
			// form is set and we are already there
			if(!this.isMobile) return this.clickSubMenus();
			else               return this.$store.commit('isAtMenu',false);
		},
		clickMiddle() {
			if(this.menu.formId !== null)
 				window.open('#'+this.getFormRoute(this.menu.formId,0,true),'_blank');
		},
		clickSubMenus() {
			if(this.hasChildren)
				this.$store.commit('local/menuIdMapOpenToggle',this.menu.id);
		}
	}
};

let MyMenu = {
	name:'my-menu',
	components:{MyMenuItem},
	template:`<div class="menu"
		:class="{ isDark:color.isDark() }"
		:style="bgStyle"
		v-if="hasAccessToAnyMenu(module.menuTabs,menuAccess)"
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
		<div class="menu-content">
			<div class="menu-items">
				<my-menu-item
					v-for="m in module.menuTabs[0].menus"
					:colorParent="null"
					:formIdActive="formIdActive"
					:formOpensPreset="formOpensPreset"
					:key="m.id"
					:menu="m"
					:module="module"
					:recordOpen="recordOpen"
				/>
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
		// stores
		customLogo:    (s) => s.$store.getters['local/customLogo'],
		customLogoUrl: (s) => s.$store.getters['local/customLogoUrl'],
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
	methods:{
		// externals
		getCaption,
		hasAccessToAnyMenu,
		openLink,
		srcBase64,
		
		// actions
		openBuilder(middle) {
			if(!middle) this.$router.push('/builder/menu/'+this.module.id);
			else        window.open('#/builder/menu/'+this.module.id,'_blank');
		}
	}
};