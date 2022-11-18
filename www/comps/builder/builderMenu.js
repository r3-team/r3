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
		:list="menus"
	>
		<template #item="{element,index}">
	    		<div class="builder-menu shade">
				<img v-if="!readonly" class="action dragAnchor" src="images/drag.png" />
				
				<div class="inputs">
					<div class="line">
						<my-button
							@trigger="element.showChildren = !element.showChildren"
							:active="!readonly"
							:captionTitle="capApp.showChildrenHint"
							:image="element.showChildren ? 'visible1.png' : 'visible0.png'"
							:naked="true"
						/>
						
						<!-- show collections -->
						<my-button image="triangleDown.png"
							v-if="showCollectionsIndex === index"
							@trigger="showCollectionsIndex = -1"
							:caption="capApp.collections + ' (' + element.collections.length + ')'"
							:naked="true"
						/>
						<my-button image="triangleRight.png"
							v-if="showCollectionsIndex !== index"
							@trigger="showCollectionsIndex = index"
							:caption="capApp.collections + ' (' + element.collections.length + ')'"
							:naked="true"
						/>
						
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
							<optgroup
								v-for="mod in getDependentModules(module,modules)"
								:label="mod.name"
							>
								<option v-for="f in mod.forms" :value="f.id">
									{{ f.name }}
								</option>
							</optgroup>
						</select>
					</div>
					
					<!-- collections -->
					<div class="line column" v-if="showCollectionsIndex === index">
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
				
				<!-- nested menus -->
				<my-builder-menu-items class="nested"
					@remove="$emit('remove',$event)"
					:builderLanguage="builderLanguage"
					:menus="element.menus"
					:module="module"
					:readonly="readonly"
				/>
				
				<my-button image="cancel.png"
					@trigger="remove(element.id,index)"
					:active="!readonly"
					:naked="true"
				/>
			</div>
		</template>
	</draggable>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		module:         { type:Object,  required:true },
		menus:          { type:Array,   required:true },
		readonly:       { type:Boolean, required:true }
	},
	emits:['remove'],
	data:function() {
		return {
			showCollectionsIndex:-1
		};
	},
	computed:{
		// stores
		modules:       function() { return this.$store.getters['schema/modules']; },
		relationIdMap: function() { return this.$store.getters['schema/relationIdMap']; },
		attributeIdMap:function() { return this.$store.getters['schema/attributeIdMap']; },
		capApp:        function() { return this.$store.getters.captions.builder.menu; },
		capGen:        function() { return this.$store.getters.captions.generic; },
		settings:      function() { return this.$store.getters.settings; }
	},
	methods:{
		// externals
		getCollectionConsumerTemplate,
		getDependentModules,
		
		// actions
		remove:function(id,i) {
			this.menus.splice(i,1);
			
			// ID must be handled separately as it must be deleted in backend
			this.$emit('remove',id);
		}
	}
};

let MyBuilderMenu = {
	name:'my-builder-menu',
	components:{MyBuilderMenuItems},
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
				:builder-language="builderLanguage"
				:menus="menus"
				:module="module"
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
	data:function() {
		return {
			newCnt:0, // temporary menu IDs, replaced with NULL UUIDs on SET
			menus:[],
			menuIdCopy:null,
			menuIdsRemove:[]
		};
	},
	mounted:function() {
		this.$emit('hotkeysRegister',[{fnc:this.set,key:'s',keyCtrl:true}]);
	},
	unmounted:function() {
		this.$emit('hotkeysRegister',[]);
	},
	watch:{
		module:{
			handler:function() { this.reset(); },
			immediate:true
		}
	},
	computed:{
		hasChanges:function() {
			return this.menuIdsRemove.length !== 0
				|| JSON.stringify(this.menus) !== JSON.stringify(this.module.menus)
			;
		},
		module:function() {
			if(typeof this.moduleIdMap[this.id] === 'undefined')
				return false;
			
			return this.moduleIdMap[this.id];
		},
		
		// stores
		modules:    function() { return this.$store.getters['schema/modules']; },
		moduleIdMap:function() { return this.$store.getters['schema/moduleIdMap']; },
		capApp:     function() { return this.$store.getters.captions.builder.menu; },
		capGen:     function() { return this.$store.getters.captions.generic; },
		settings:   function() { return this.$store.getters.settings; }
	},
	methods:{
		// externals
		getDependentModules,
		getNilUuid,
		
		// actions
		add:function() {
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
		removeById:function(menuId) {
			if(!Number.isInteger(menuId))
				this.menuIdsRemove.push(menuId);
		},
		reset:function() {
			if(this.module)
				this.menus = JSON.parse(JSON.stringify(this.module.menus));
		},
		
		// backend functions
		copy:function() {
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
		set:function() {
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