import MyBuilderCaption                from './builderCaption.js';
import MyBuilderCollectionInput        from './builderCollectionInput.js';
import MyBuilderFormInput              from './builderFormInput.js';
import MyBuilderIconInput              from './builderIconInput.js';
import MyTabs                          from '../tabs.js';
import {getCollectionConsumerTemplate} from '../shared/collection.js';
import {getDependentModules}           from '../shared/builder.js';
import {getNilUuid}                    from '../shared/generic.js';
import srcBase64Icon                   from '../shared/image.js';
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
					<div class="contentBox float">
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
												:module="module"
												:readonly="readonly"
												:showMultiValue="false"
												:showNoDisplayEmpty="true"
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
					@trigger="remove(element.id,index)"
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
		remove(id,i) {
			this.list.splice(i,1);
		}
	}
};

let MyBuilderMenu = {
	name:'my-builder-menu',
	components:{
		MyBuilderMenuItems,
		MyTabs
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
		
		<div class="content no-padding default-inputs">

			<my-tabs
				v-if="menuTabs.length > 1"
				v-model="menuTabIdShown"
				:entries="tabs.ids"
				:entriesIcon="tabs.imgs"
				:entriesText="tabs.caps"
			/>
		
			<template v-for="mt in menuTabs">
				<my-builder-menu-items
					v-if="mt.id === menuTabIdShown"
					:builderLanguage="builderLanguage"
					:module="module"
					:list="mt.menus"
					:readonly="readonly"
				/>
			</template>
			
			<div class="builder-menus-actions">
				<span>{{ capApp.copy }}</span>
				<select v-model="menuIdCopy" :disabled="readonly">
					<option :value="null">-</option>
					<option
						v-for="mod in getDependentModules(module).filter(v => v.id !== module.id)"
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
	props:{
		builderLanguage:{ type:String,  required:true },
		id:             { type:String,  required:true },
		readonly:       { type:Boolean, required:true }
	},
	data() {
		return {
			newCnt:0, // temporary menu IDs, replaced with NULL UUIDs on SET
			menuIdCopy:null,
			menuTabs:[],
			menuTabIdShown:null,
			showCollections:false
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
				this.menuTabIdShown = this.module.menuTabs[0].id;
				this.reset();
			},
			immediate:true
		}
	},
	computed:{
		tabs:(s) => {
			let ids  = [];
			let imgs = [];
			let caps = [];

			for(const mt of s.menuTabs) {
				ids.push(mt.id);
				imgs.push(s.srcBase64Icon(mt.iconId,'images/icon_missing.png'));
				caps.push('TAB CAP!');
			}
			return {
				ids:ids,
				imgs:imgs,
				caps:caps
			};
		},

		// simple
		hasChanges:(s) => JSON.stringify(s.menuTabs) !== JSON.stringify(s.module.menuTabs),
		module:    (s) => s.moduleIdMap[s.id] === undefined ? false : s.moduleIdMap[s.id],
		
		// stores
		moduleIdMap:(s) => s.$store.getters['schema/moduleIdMap'],
		capApp:     (s) => s.$store.getters.captions.builder.menu,
		capGen:     (s) => s.$store.getters.captions.generic,
		settings:   (s) => s.$store.getters.settings
	},
	methods:{
		// externals
		getDependentModules,
		getNilUuid,
		srcBase64Icon,
		
		// actions
		addEntry() {
			for(let i = 0, j = this.menuTabs.length; i < j; i++) {
				if(this.menuTabs[i].id !== this.menuTabIdShown)
					continue;

				return this.menuTabs[i].menus.unshift({
					id:this.newCnt++,
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
			}
		},
		addTab() {
			this.menuTabs.push({
				moduleId:this.module.id,
				iconId:null,
				menus:[],
				captions:{
					menuTabTitle:{}
				}
			});
		},
		reset() {
			if(this.module)
				this.menuTabs = JSON.parse(JSON.stringify(this.module.menuTabs));
		},
		
		// backend functions
		copy() {
			/*ws.send('menu','copy',{
				moduleId:this.menuIdCopy,
				moduleIdNew:this.module.id
			},true).then(
				() => {
					this.menuIdCopy = null;
					this.$root.schemaReload(this.module.id);
				},
				this.$root.genericError
			);*/
		},
		set() {
			// replace temporary counter IDs with NULL UUIDs for SET
			let replaceIds;
			replaceIds = menus => {
				for(let i = 0, j = menus.length; i < j; i++) {
					
					if(Number.isInteger(menus[i].id))
						menus[i].id = this.getNilUuid();
					
					menus[i].menus = replaceIds(menus[i].menus);
				}
				return menus;
			}

			let requests = [];
			for(let i = 0, j = this.menuTabs.length; i < j; i++) {
				let mt = JSON.parse(JSON.stringify(this.menuTabs[i]));
				mt.menus = replaceIds(mt.menus);
				requests.push(ws.prepare('menuTab','set',{menuTab:mt,position:i}));
			}
			requests.push(ws.prepare('schema','check',{moduleId:this.module.id}));
			
			ws.sendMultiple(requests,true).then(
				() => this.$root.schemaReload(this.module.id),
				this.$root.genericError
			);
		}
	}
};