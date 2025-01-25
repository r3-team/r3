import MyBuilderCaption                from './builderCaption.js';
import MyBuilderCollectionInput        from './builderCollectionInput.js';
import MyBuilderFormInput              from './builderFormInput.js';
import MyBuilderIconInput              from './builderIconInput.js';
import MyBuilderMenuTabSelect          from './builderMenuTabSelect.js';
import {getCollectionConsumerTemplate} from '../shared/collection.js';
import {getDependentModules}           from '../shared/builder.js';
import {getNilUuid}                    from '../shared/generic.js';
import {getCaptionForLang}             from '../shared/language.js';
export {MyBuilderMenu as default};

let MyBuilderMenuItems = {
	name:'my-builder-menu-items',
	components:{
		'chrome-picker':VueColor.Chrome,
		MyBuilderCaption,
		MyBuilderCollectionInput,
		MyBuilderFormInput,
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
						<!-- color preview -->
						<div class="color-preview clickable"
							@click="showOptionsIndex = index"
							:style="colorStyle(element.color)"
						></div>
						
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
						<my-builder-form-input
							v-model="element.formId"
							:captionEmpty="capApp.formId"
							:module="module"
							:readonly="readonly"
						/>
						
						<!-- show options -->
						<my-button image="settings.png"
							@trigger="showOptionsIndex = index"
							:captionTitle="capGen.settings"
						/>
					</div>
				</div>
				
				<!-- options -->
				<div class="app-sub-window under-header"
					v-if="showOptionsIndex === index"
					@mousedown.self="showOptionsIndex = -1"
				>
					<div class="contentBox scroll float">
						<div class="top lower">
							<div class="area nowrap">
								<img class="icon" src="images/settings.png" />
								<h1 class="title">{{ capGen.settings }}</h1>
							</div>
							<div class="area">
								<my-button image="ok.png"
									@trigger="showOptionsIndex = -1"
									:caption="capGen.button.ok"
								/>
							</div>
						</div>
						
						<div class="content default-inputs">
							<table class="generic-table-vertical tight fullWidth default-inputs">
								<tbody>
									<tr>
										<td>{{ capApp.showChildrenHint }}</td>
										<td>
											<my-bool v-model="element.showChildren"
												:readonly="readonly"
											/>
										</td>
									</tr>
									<tr>
										<td>{{ capGen.color }}</td>
										<td>
											<div class="column gap">
												<div class="row gap">
													<input class="short"
														@input="element.color = applyColor($event.target.value)"
														:disabled="readonly"
														:value="element.color"
													/>
													<my-button image="cancel.png"
														@trigger="element.color = null"
														:active="element.color !== null"
														:naked="true"
													/>
												</div>
												<chrome-picker
													v-if="!readonly"
													@update:modelValue="element.color = $event.hex.substr(1)"
													:disable-alpha="true"
													:disable-fields="true"
													:modelValue="element.color !== null ? element.color : '000000'"
												/>
											</div>
										</td>
									</tr>
									<tr>
										<td>
											<div class="column gap">
												<span>{{ capApp.collections }}</span>
												<my-button image="add.png"
													@trigger="element.collections.push(getCollectionConsumerTemplate())"
													:active="!readonly"
													:caption="capGen.button.add"
													:naked="true"
												/>
											</div>
										</td>
										<td>
											<my-builder-collection-input
												v-for="(c,i) in element.collections"
												@remove="element.collections.splice(i,1)"
												@update:consumer="element.collections[i] = $event"
												:allowFormOpen="false"
												:allowRemove="true"
												:consumer="c"
												:fixedCollection="false"
												:flagsEnable="['noDisplayEmpty','showRowCount']"
												:module="module"
												:readonly="readonly"
												:showOnMobile="true"
											/>
										</td>
									</tr>
								</tbody>
							</table>
						</div>
					</div>
				</div>
				
				<my-button image="delete.png"
					@trigger="remove(index)"
					:active="!readonly"
					:cancel="true"
					:captionTitle="capGen.button.delete"
				/>
				
				<!-- nested menus -->
				<my-builder-menu-items class="nested"
					:builderLanguage="builderLanguage"
					:colorParent="element.color"
					:list="element.menus"
					:module="module"
					:readonly="readonly"
				/>
			</div>
		</template>
	</draggable>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		colorParent:    { required:false, default:null },
		module:         { type:Object,  required:true },
		list:           { type:Array,   required:true },
		readonly:       { type:Boolean, required:true }
	},
	data() {
		return {
			showOptionsIndex:-1
		};
	},
	computed:{
		// stores
		moduleIdMap:(s) => s.$store.getters['schema/moduleIdMap'],
		capApp:     (s) => s.$store.getters.captions.builder.menu,
		capGen:     (s) => s.$store.getters.captions.generic,
		settings:   (s) => s.$store.getters.settings
	},
	methods:{
		// externals
		getCollectionConsumerTemplate,
		getNilUuid,
		
		// presentation
		colorStyle(color) {
			const c = color !== null ? color : (this.colorParent !== null ? this.colorParent : 'transparent');
			return `background-color:#${c}`;
		},
		
		// actions
		applyColor(input) {
			return input === '' ? null : input;
		},
		remove(i) {
			this.list.splice(i,1);
		}
	}
};

let MyBuilderMenuTabOptions = {
	name:'my-builder-menu-tab-options',
	components:{
		MyBuilderCaption,
		MyBuilderIconInput
	},
	template:`<table class="generic-table-vertical tight fullWidth default-inputs">
		<tbody>
			<tr>
				<td>{{ capGen.title }}</td>
				<td>
					<my-builder-caption
						@update:modelValue="set('captions',{menuTabTitle:$event})"
						:language="builderLanguage"
						:modelValue="modelValue.captions.menuTabTitle"
					/>
				</td>
			</tr>
			<tr>
				<td>{{ capGen.icon }}</td>
				<td>
					<my-builder-icon-input
						@input="set('iconId',$event)"
						:icon-id-selected="modelValue.iconId"
						:module="module"
						:title="capGen.icon"
					/>
				</td>
			</tr>
		</tbody>
	</table>`,
	props:{
		builderLanguage:{ type:String, required:true },
		module:         { type:Object, required:true },
		modelValue:     { type:Object, required:true }
	},
	emits:['update:modelValue'],
	computed:{
		capGen:(s) => s.$store.getters.captions.generic
	},
	methods:{
		set(name,value) {
			let v = JSON.parse(JSON.stringify(this.modelValue));
			v[name] = value;
			this.$emit('update:modelValue',v);
		}
	}
};

let MyBuilderMenu = {
	name:'my-builder-menu',
	components:{
		MyBuilderMenuItems,
		MyBuilderMenuTabOptions,
		MyBuilderMenuTabSelect
	},
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
					@trigger="addEntry"
					:active="!readonly"
					:caption="capApp.button.add"
				/>
				<my-button image="add.png"
					@trigger="addTab"
					:active="!readonly"
					:caption="capApp.button.addTab"
				/>
			</div>
		</div>
		
		<div class="content row no-padding default-inputs">
			<div class="builder-menus-main">
				<my-builder-menu-tab-select
					v-if="menuTabs.length > 1"
					v-model="menuTabsIndexShown"
					:builderLanguage="builderLanguage"
					:menuTabs="menuTabs"
				/>
				<template v-for="(mt,i) in menuTabs">
					<my-builder-menu-items class="builder-menus-content"
						v-show="i === menuTabsIndexShown"
						:builderLanguage="builderLanguage"
						:module="module"
						:list="mt.menus"
						:readonly="readonly"
					/>
				</template>
			</div>
			<div class="builder-menus-sidebar column gap">
				<div class="row centered space-between">
					<h2 class="title">{{ capApp.titleMenuTab }}</h2>
					<div class="row gap">
						<my-button image="pagePrev.png"
							@trigger="moveTab(false)"
							:active="menuTabsIndexShown !== 0"
						/>
						<my-button image="pageNext.png"
							@trigger="moveTab(true)"
							:active="menuTabsIndexShown !== menuTabs.length-1"
						/>
						<my-button image="delete.png"
							@trigger="del"
							:active="canDelete"
							:cancel="true"
							:caption="capApp.button.delete"
						/>
					</div>
				</div>
				<my-builder-menu-tab-options
					v-if="menuTabShown !== false"
					v-model="menuTabShown"
					:builderLanguage="builderLanguage"
					:module="module"
				/>
				
				<!-- actions -->
				<span>{{ capApp.copy }}</span>
				<div class="row gap centered">
					<select v-model="copyModuleId" :disabled="readonly">
						<option
							v-for="mod in getDependentModules(module)"
							:value="mod.id"
						>
							{{ mod.name }}
						</option>
					</select>
					<select v-model="copyMenuTabId" :disabled="readonly || copyModuleId === null">
						<option
							v-if="copyModuleId !== null"
							v-for="mt in moduleIdMap[copyModuleId].menuTabs"
							:value="mt.id"
						>
							{{ getCaptionForLang('menuTabTitle',builderLanguage,mt.id,mt.captions,capGen.menu) }}
						</option>
					</select>
					<my-button image="ok.png"
						@trigger="copy"
						:active="copyModuleId !== null && copyMenuTabId !== null && !readonly"
						:caption="capGen.button.ok"
					/>
				</div>
			</div>
		</div>
	</div>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		id:             { type:String,  required:true },
		readonly:       { type:Boolean, required:true }
	},
	data() {
		return {
			copyMenuTabId:null,
			copyModuleId:null,
			newCntEntry:0, // temporary menu IDs, replaced with NULL UUIDs on SET
			newCntTab:0,   // temporary menu tab IDs, replaced with NULL UUIDs on SET
			menuTabs:[],
			menuTabsIndexShown:0,
			menuTabIdsRemoved:[]
		};
	},
	mounted() {
		this.$store.commit('keyDownHandlerAdd',{fnc:this.set,key:'s',keyCtrl:true});
	},
	unmounted() {
		this.$store.commit('keyDownHandlerDel',this.set);
	},
	watch:{
		module:{
			handler() {
				this.reset();
				this.switchToValidMenuTab();
			},
			immediate:true
		}
	},
	computed:{
		// inputs
		menuTabShown:{
			get() { return this.menuTabs[this.menuTabsIndexShown]; },
			set(v) {
				for(let i = 0, j = this.menuTabs.length; i < j; i++) {
					if(this.menuTabs[i].id === v.id)
						this.menuTabs[i] = v;
				}
			}
		},

		// simple
		canDelete: (s) => !s.readonly && s.menuTabs.length > 1,
		hasChanges:(s) => JSON.stringify(s.menuTabs) !== JSON.stringify(s.module.menuTabs) || s.menuTabIdsRemoved.length !== 0,
		module:    (s) => s.moduleIdMap[s.id] === undefined ? false : s.moduleIdMap[s.id],
		
		// stores
		moduleIdMap:(s) => s.$store.getters['schema/moduleIdMap'],
		capApp:     (s) => s.$store.getters.captions.builder.menu,
		capGen:     (s) => s.$store.getters.captions.generic,
		settings:   (s) => s.$store.getters.settings
	},
	methods:{
		// externals
		getCaptionForLang,
		getDependentModules,
		getNilUuid,
		
		// actions
		addEntry() {
			this.menuTabs[this.menuTabsIndexShown].menus.unshift({
				id:this.newCntEntry++,
				formId:null,
				iconId:null,
				menus:[],
				showChildren:false,
				color:null,
				collections:[],
				captions:{
					menuTitle:{}
				}
			});
		},
		addTab() {
			this.menuTabs.push({
				id:this.newCntTab++,
				moduleId:this.module.id,
				iconId:null,
				menus:[],
				captions:{
					menuTabTitle:{}
				}
			});
		},
		copy() {
			const mod = this.moduleIdMap[this.copyModuleId];
			for(const mt of mod.menuTabs) {
				if(mt.id === this.copyMenuTabId) {
					return this.menuTabs[this.menuTabsIndexShown].menus = this.replaceMenuIdsNested(
						this.menuTabs[this.menuTabsIndexShown].menus.concat(JSON.parse(JSON.stringify(mt.menus))),false);
				}
			}
		},
		moveTab(forward) {
			const newIndex = forward ? this.menuTabsIndexShown+1 : this.menuTabsIndexShown-1;
			this.menuTabs.splice(newIndex, 0, this.menuTabs.splice(this.menuTabsIndexShown,1)[0]);
			this.menuTabsIndexShown = newIndex;
		},
		replaceMenuIdsNested(menus,newToNilUuid) {
			for(let i = 0, j = menus.length; i < j; i++) {

				// replace temporary counter IDs with NULL UUIDs (for SET of new menu entries)
				if(newToNilUuid && Number.isInteger(menus[i].id))
					menus[i].id = this.getNilUuid();

				// replace existing UUIDs with temporary counter IDs (for menu copy)
				if(!newToNilUuid && !Number.isInteger(menus[i].id))
					menus[i].id = this.newCntEntry++;
				
				menus[i].menus = this.replaceMenuIdsNested(menus[i].menus,newToNilUuid);
			}
			return menus;
		},
		reset() {
			if(this.module) {
				this.menuTabs = JSON.parse(JSON.stringify(this.module.menuTabs));
				this.switchToValidMenuTab();
			}
		},

		// presentation
		switchToValidMenuTab() {
			if(this.menuTabsIndexShown > this.menuTabs.length - 1)
				this.menuTabsIndexShown = 0;
		},
		
		// backend functions
		del() {
			if(!Number.isInteger(this.menuTabs[this.menuTabsIndexShown].id))
				this.menuTabIdsRemoved.push(this.menuTabs[this.menuTabsIndexShown].id);

			this.menuTabs.splice(this.menuTabsIndexShown,1);
			this.switchToValidMenuTab();
		},
		set() {
			let requests = [];
			for(let i = 0, j = this.menuTabs.length; i < j; i++) {
				let mt   = JSON.parse(JSON.stringify(this.menuTabs[i]));
				mt.menus = this.replaceMenuIdsNested(mt.menus,true);

				if(Number.isInteger(mt.id))
					mt.id = this.getNilUuid();

				requests.push(ws.prepare('menuTab','set',{menuTab:mt,position:i}));
			}
			for(const id of this.menuTabIdsRemoved) {
				requests.push(ws.prepare('menuTab','del',id));
			}
			requests.push(ws.prepare('schema','check',{moduleId:this.module.id}));
			
			ws.sendMultiple(requests,true).then(
				() => {
					this.menuTabIdsRemoved = [];
					this.$root.schemaReload(this.module.id);
				},
				this.$root.genericError
			);
		}
	}
};