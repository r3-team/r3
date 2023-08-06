import MyBuilderCaption                from './builderCaption.js';
import MyBuilderCollectionInput        from './builderCollectionInput.js';
import MyBuilderIconInput              from './builderIconInput.js';
import {getCollectionConsumerTemplate} from '../shared/collection.js';
import {getDependentModules}           from '../shared/builder.js';
import {getNilUuid}                    from '../shared/generic.js';
export {MyBuilderMenu as default};

let MyBuilderMenuItems = {
	name:'my-builder-menu-items',
	components:{
		MyBuilderCaption,
		MyBuilderCollectionInput,
		MyBuilderIconInput
	},
	template:`<draggable handle=".dragAnchor" group="menu" itemKey="id" animation="100"
		:fallbackOnBody="true"
		:list="list"
	>
		<template #item="{element,index}">
	    		<div class="builder-menu">
				<img v-if="!readonly" class="dragAnchor" src="images/drag.png" />
				
				<div class="inputs">
					<div class="line">
						<!-- icon input -->
						<my-builder-icon-input
							@input="element.iconId = $event"
							:icon-id-selected="element.iconId"
							:module="module"
							:readonly="readonly"
						/>
						
						<!-- caption inputs -->
						<my-builder-caption
							v-model="element.captions.menuTitle"
							:contentName="capGen.title"
							:language="builderLanguage"
							:readonly="readonly"
						/>
						
						<!-- form open input -->
						<select v-model="element.formId" :disabled="readonly">
							<option :value="null">{{ capApp.formId }}</option>
							<option v-for="f in module.forms" :value="f.id">{{ f.name }}</option>
							<optgroup
								v-for="mod in getDependentModules(module,modules).filter(v => v.id !== module.id && v.forms.length !== 0)"
								:label="mod.name"
							>
								<option v-for="f in mod.forms" :value="f.id">{{ f.name }}</option>
							</optgroup>
						</select>
						
						<my-button
							@trigger="element.showChildren = !element.showChildren"
							:active="!readonly"
							:captionTitle="capApp.showChildrenHint"
							:image="element.showChildren ? 'visible1.png' : 'visible0.png'"
						/>
						
						<!-- show collections -->
						<my-button image="tray.png"
							@trigger="showCollectionsIndex = index"
							:caption="String(element.collections.length)"
							:captionTitle="capApp.collections + ' (' + element.collections.length + ')'"
						/>
					</div>
				</div>
				
				<!-- collections -->
				<div class="app-sub-window under-header"
					v-if="showCollectionsIndex === index"
					@mousedown.self="showCollectionsIndex = -1"
				>
					<div class="contentBox builder-new popUp">
						<div class="top lower">
							<div class="area nowrap">
								<h1 class="title">{{ capApp.collections }}</h1>
							</div>
							<div class="area">
								<my-button image="cancel.png"
									@trigger="showCollectionsIndex = -1"
									:cancel="true"
								/>
							</div>
						</div>
						
						<div class="content default-inputs">
							<my-button image="add.png"
								@trigger="element.collections.push(getCollectionConsumerTemplate())"
								:active="!readonly"
								:caption="capGen.button.add"
								:naked="true"
							/>
							<my-builder-collection-input
								v-for="(c,i) in element.collections"
								@remove="element.collections.splice(i,1)"
								@update:consumer="element.collections[i] = $event"
								:allowFormOpen="false"
								:allowRemove="true"
								:consumer="c"
								:fixedCollection="false"
								:module="module"
								:readonly="readonly"
								:showMultiValue="false"
								:showNoDisplayEmpty="true"
								:showOnMobile="true"
							/>
						</div>
					</div>
				</div>
				
				<my-button image="delete.png"
					@trigger="remove(element.id,index)"
					:active="!readonly"
					:cancel="true"
					:captionTitle="capGen.button.delete"
				/>
				
				<!-- nested menus -->
				<my-builder-menu-items class="nested"
					@remove="$emit('remove',$event)"
					:builderLanguage="builderLanguage"
					:list="element.menus"
					:module="module"
					:readonly="readonly"
				/>
			</div>
		</template>
	</draggable>`,
	emits:['remove'],
	props:{
		builderLanguage:{ type:String,  required:true },
		module:         { type:Object,  required:true },
		list:           { type:Array,   required:true },
		readonly:       { type:Boolean, required:true }
	},
	data:function() {
		return {
			showCollectionsIndex:-1
		};
	},
	computed:{
		// stores
		modules:    (s) => s.$store.getters['schema/modules'],
		moduleIdMap:(s) => s.$store.getters['schema/moduleIdMap'],
		capApp:     (s) => s.$store.getters.captions.builder.menu,
		capGen:     (s) => s.$store.getters.captions.generic,
		settings:   (s) => s.$store.getters.settings
	},
	methods:{
		// externals
		getCollectionConsumerTemplate,
		getDependentModules,
		getNilUuid,
		
		// actions
		remove(id,i) {
			this.list.splice(i,1);
			
			// ID must be handled separately as it must be deleted in backend
			this.$emit('remove',id);
		}
	}
};

let MyBuilderMenu = {
	name:'my-builder-menu',
	components:{ MyBuilderMenuItems },
	template:`<div v-if="module" class="builder-menus contentBox grow">
		
		<div class="top">
			<div class="area nowrap">
				<img class="icon" src="images/menu.png" />
				<h1 class="title">{{ capApp.title }}</h1>
			</div>
		</div>
		<div class="top lower">
			<div class="area nowrap">
				<my-button image="save.png"
					@trigger="set"
					:active="hasChanges && !readonly"
					:caption="capGen.button.save"
				/>
				<my-button image="refresh.png"
					@trigger="reset"
					:active="hasChanges"
					:caption="capGen.button.refresh"
				/>
				<my-button image="add.png"
					@trigger="add"
					:active="!readonly"
					:caption="capApp.button.add"
				/>
			</div>
		</div>
		
		<div class="content default-inputs">
		
			<my-builder-menu-items
				@remove="removeById"
				:builderLanguage="builderLanguage"
				:module="module"
				:list="menus"
				:readonly="readonly"
			/>
			
			<div class="builder-menus-actions">
				<span>{{ capApp.copy }}</span>
				<select v-model="menuIdCopy" :disabled="readonly">
					<option :value="null">-</option>
					<option
						v-for="mod in getDependentModules(module,modules).filter(v => v.id !== module.id)"
						:value="mod.id"
					>
						{{ mod.name }}
					</option>
				</select>
				<my-button image="ok.png"
					@trigger="copy"
					:active="menuIdCopy !== null && !readonly"
					:caption="capGen.button.apply"
				/>
			</div>
		</div>
	</div>`,
	emits:['hotkeysRegister'],
	props:{
		builderLanguage:{ type:String,  required:true },
		id:             { type:String,  required:true },
		readonly:       { type:Boolean, required:true }
	},
	data() {
		return {
			newCnt:0, // temporary menu IDs, replaced with NULL UUIDs on SET
			menus:[],
			menuIdCopy:null,
			menuIdsRemove:[],
			showCollections:false
		};
	},
	mounted() {
		this.$emit('hotkeysRegister',[{fnc:this.set,key:'s',keyCtrl:true}]);
	},
	unmounted() {
		this.$emit('hotkeysRegister',[]);
	},
	watch:{
		module:{
			handler:function() { this.reset(); },
			immediate:true
		}
	},
	computed:{
		hasChanges:(s) => s.menuIdsRemove.length !== 0 || JSON.stringify(s.menus) !== JSON.stringify(s.module.menus),
		module:    (s) => typeof s.moduleIdMap[s.id] === 'undefined' ? false : s.moduleIdMap[s.id],
		
		// stores
		modules:    (s) => s.$store.getters['schema/modules'],
		moduleIdMap:(s) => s.$store.getters['schema/moduleIdMap'],
		capApp:     (s) => s.$store.getters.captions.builder.menu,
		capGen:     (s) => s.$store.getters.captions.generic,
		settings:   (s) => s.$store.getters.settings
	},
	methods:{
		// externals
		getDependentModules,
		getNilUuid,
		
		// actions
		add() {
			this.menus.unshift({
				id:this.newCnt++,
				moduleId:this.id,
				formId:null,
				iconId:null,
				menus:[],
				showChildren:false,
				collections:[],
				captions:{
					menuTitle:{}
				}
			});
		},
		removeById(menuId) {
			if(!Number.isInteger(menuId))
				this.menuIdsRemove.push(menuId);
		},
		reset() {
			if(this.module)
				this.menus = JSON.parse(JSON.stringify(this.module.menus));
		},
		
		// backend functions
		copy() {
			ws.send('menu','copy',{
				moduleId:this.menuIdCopy,
				moduleIdNew:this.module.id
			},true).then(
				() => {
					this.menuIdCopy = null;
					this.$root.schemaReload(this.module.id);
				},
				this.$root.genericError
			);
		},
		set() {
			let that     = this;
			let requests = [];
			
			for(let i = 0, j = this.menuIdsRemove.length; i < j; i++) {
				requests.push(ws.prepare('menu','del',{ id:this.menuIdsRemove[i] }));
			}
			this.menuIdsRemove = [];
			
			// replace temporary counter IDs with NULL UUIDs for SET
			let replaceIds;
			replaceIds = function(menus) {
				for(let i = 0, j = menus.length; i < j; i++) {
					
					if(Number.isInteger(menus[i].id))
						menus[i].id = that.getNilUuid();
					
					menus[i].menus = replaceIds(menus[i].menus);
				}
				return menus;
			}
			
			requests.push(ws.prepare('menu','set',replaceIds(
				JSON.parse(JSON.stringify(this.menus))
			)));
			requests.push(ws.prepare('schema','check',
				{moduleId:this.module.id}
			));
			
			ws.sendMultiple(requests,true).then(
				() => this.$root.schemaReload(this.module.id),
				this.$root.genericError
			);
		}
	}
};