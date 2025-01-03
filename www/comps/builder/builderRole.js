import MyBuilderCaption       from './builderCaption.js';
import MyBuilderMenuTabSelect from './builderMenuTabSelect.js';
import MyTabs                 from '../tabs.js';
import {getDependentModules}  from '../shared/builder.js';
import {copyValueDialog}      from '../shared/generic.js';
export {MyBuilderRole as default};

let MyBuilderRoleAccessApi = {
	name:'my-builder-role-access-api',
	template:`<tr class="entry">
		<td>
			<span class="builder-role-td-name">{{ api.name + ' (v' + api.version + ')' }}</span>
		</td>
		<td>
			<my-bool
				@update:modelValue="$emit('apply',api.id,access === 1 ? -1 : 1)"
				:modelValue="access === 1 ? true : false"
				:readonly="readonly"
			/>
		</td>
		<td class="maximum"></td>
	</tr>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		api:            { type:Object,  required:true },
		idMapAccess:    { type:Object,  required:true },
		readonly:       { type:Boolean, required:true }
	},
	emits:['apply'],
	computed:{
		access:(s) => typeof s.idMapAccess[s.api.id] === 'undefined'
			? -1 : s.idMapAccess[s.api.id]
	}
};

let MyBuilderRoleAccessClientEvent = {
	name:'my-builder-role-access-client-event',
	template:`<tr class="entry">
		<td>
			<span class="builder-role-td-name">
				{{ clientEvent.captions.clientEventTitle[builderLanguage] }}
			</span>
		</td>
		<td>
			<my-bool
				@update:modelValue="$emit('apply',clientEvent.id,access === 1 ? -1 : 1)"
				:modelValue="access === 1 ? true : false"
				:readonly="readonly"
			/>
		</td>
		<td class="maximum"></td>
	</tr>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		clientEvent:    { type:Object,  required:true },
		idMapAccess:    { type:Object,  required:true },
		readonly:       { type:Boolean, required:true }
	},
	emits:['apply'],
	computed:{
		access:(s) => typeof s.idMapAccess[s.clientEvent.id] === 'undefined'
			? -1 : s.idMapAccess[s.clientEvent.id]
	}
};

let MyBuilderRoleAccessCollection = {
	name:'my-builder-role-access-collection',
	template:`<tr class="entry">
		<td>
			<span class="builder-role-td-name">{{ collection.name }}</span>
		</td>
		<td>
			<my-bool
				@update:modelValue="$emit('apply',collection.id,access === 1 ? -1 : 1)"
				:modelValue="access === 1 ? true : false"
				:readonly="readonly"
			/>
		</td>
		<td class="maximum"></td>
	</tr>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		collection:     { type:Object,  required:true },
		idMapAccess:    { type:Object,  required:true },
		readonly:       { type:Boolean, required:true }
	},
	emits:['apply'],
	computed:{
		access:(s) => typeof s.idMapAccess[s.collection.id] === 'undefined'
			? -1 : s.idMapAccess[s.collection.id]
	}
};

let MyBuilderRoleAccessMenu = {
	name:'my-builder-role-access-menu',
	template:`<tr class="entry">
		<td>
			<span class="builder-role-td-name" :style="style">{{ title }}</span>
		</td>
		<td>
			<my-button
				v-if="subsExist"
				@trigger="$emit('toggle',menu.id)"
				:caption="String(menu.menus.length)"
				:image="subsExist && subsShow ? 'triangleDown.png' : 'triangleRight.png'"
				:naked="true"
			/>
		</td>
		<td>
			<my-bool
				@update:modelValue="$emit('apply',menu.id,access === 1 ? -1 : 1)"
				:modelValue="access === 1 ? true : false"
				:readonly="readonly"
			/>
		</td>
		<td class="maximum"></td>
	</tr>
	
	<my-builder-role-access-menu
		v-if="subsExist && subsShow"
		v-for="m in menu.menus"
		@apply="(...args) => $emit('apply',...args)"
		@toggle="(...args) => $emit('toggle',...args)"
		:builderLanguage="builderLanguage"
		:depth="depth + 1"
		:idMapAccess="idMapAccess"
		:key="m.id"
		:menu="m"
		:menuIdsShow="menuIdsShow"
		:readonly="readonly"
		:role="role"
	/>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		depth:          { type:Number,  required:true },
		idMapAccess:    { type:Object,  required:true },
		menu:           { type:Object,  required:true },
		menuIdsShow:    { type:Array,   required:true },
		readonly:       { type:Boolean, required:true },
		role:           { type:Object,  required:true },
	},
	emits:['apply','toggle'],
	data() {
		return { showSubs:false };
	},
	computed:{
		access:   (s) => typeof s.idMapAccess[s.menu.id] === 'undefined' ? -1 : s.idMapAccess[s.menu.id],
		style:    (s) => `margin-left:${s.depth * 30}px;`,
		subsExist:(s) => s.menu.menus.length !== 0,
		subsShow: (s) => s.menuIdsShow.includes(s.menu.id),
		title:    (s) => {
			// 1st preference: proper menu title
			if(typeof s.menu.captions.menuTitle[s.builderLanguage] !== 'undefined')
				return s.menu.captions.menuTitle[s.builderLanguage];
			
			// 2nd preference (if form is referenced): form title
			if(s.menu.formId !== null) {
				let form = s.formIdMap[s.menu.formId];
				
				if(typeof form.captions.formTitle[s.builderLanguage] !== 'undefined')
					return form.captions.formTitle[s.builderLanguage];
			}
			return s.capGen.missingCaption;
		},
		
		// stores
		formIdMap:(s) => s.$store.getters['schema/formIdMap'],
		capGen:   (s) => s.$store.getters.captions.generic
	}
};

let MyBuilderRoleAccessRelation = {
	name:'my-builder-role-access-relation',
	template:`<tr>
		<td>
			<span class="builder-role-td-name">{{ relation.name + (brokenInheritance ? '*' : '') }}</span>
		</td>
		<td>
			<my-button
				@trigger="$emit('relation-selected',relation.id)"
				:caption="String(relation.attributes.length)"
				:image="showEntries ? 'triangleDown.png' : 'triangleRight.png'"
				:naked="true"
			/>
		</td>
		<td></td>
		<td>
			<my-bool caption0="R" caption1="R"
				@update:modelValue="setRelation(1)"
				:modelValue="access >= 1"
				:readonly="readonly"
			/>
		</td>
		<td>
			<my-bool caption0="W" caption1="W"
				@update:modelValue="setRelation(2)"
				:modelValue="access >= 2"
				:readonly="readonly"
			/>
		</td>
		<td>
			<my-bool caption0="D" caption1="D"
				@update:modelValue="setRelation(3)"
				:modelValue="access === 3"
				:readonly="readonly"
			/>
		</td>
		<td class="maximum"></td>
	</tr>
	<tr class="entry"
		v-if="showEntries"
		v-for="atr in relation.attributes"
		:key="atr.id"
	>
		<td></td>
		<td>{{ attributeIdMap[atr.id].name }}</td>
		<td>
			<my-button
				@trigger="$emit('apply-attribute',atr.id,attributeIdMapAccessParsed[atr.id] === -1 ? 0 : -1)"
				:active="!readonly"
				:caption="capApp.accessInherit"
				:image="attributeIdMapAccessParsed[atr.id] === -1 ? 'checkbox1.png' : 'checkbox0.png'"
				:naked="true"
			/>
		</td>
		<td>
			<my-bool caption0="R" caption1="R"
				v-if="attributeIdMapAccessParsed[atr.id] !== -1"
				@update:modelValue="setAttribute(1,atr.id)"
				:modelValue="attributeIdMapAccessParsed[atr.id] >= 1"
				:readonly="readonly"
			/>
		</td>
		<td>
			<my-bool caption0="W" caption1="W"
				v-if="attributeIdMapAccessParsed[atr.id] !== -1"
				@update:modelValue="setAttribute(2,atr.id)"
				:modelValue="attributeIdMapAccessParsed[atr.id] === 2"
				:readonly="readonly"
			/>
		</td>
		<td></td>
		<td class="maximum"></td>
	</tr>`,
	props:{
		readonly:            { type:Boolean, required:true },
		relation:            { type:Object,  required:true },
		role:                { type:Object,  required:true },
		showEntries:         { type:Boolean, required:true },
		relationIdMapAccess: { type:Object,  required:true },
		attributeIdMapAccess:{ type:Object,  required:true }
	},
	emits:['apply-attribute','apply-relation','relation-selected'],
	computed:{
		access:(s) => typeof s.relationIdMapAccess[s.relation.id] === 'undefined'
			? -1 : s.relationIdMapAccess[s.relation.id],
		attributeIdMapAccessParsed:(s) => {
			let out = {};
			for(let a of s.relation.attributes) {
				if(typeof s.attributeIdMapAccess[a.id] === 'undefined') {
					out[a.id] = -1;
					continue;
				}
				out[a.id] = s.attributeIdMapAccess[a.id];
			}
			return out;
		},
		brokenInheritance:(s) => {
			for(let key in s.attributeIdMapAccessParsed) {
				if(s.attributeIdMapAccessParsed[key] !== -1)
					return true;
			}
			return false;
		},
		
		// stores
		relationIdMap: (s) => s.$store.getters['schema/relationIdMap'],
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		capApp:        (s) => s.$store.getters.captions.builder.role
	},
	methods:{
		setAttribute(access,attributeId) {
			this.$emit('apply-attribute',attributeId,this.attributeIdMapAccessParsed[attributeId] >= access ? access - 1 : access);
		},
		setRelation(access) {
			this.$emit('apply-relation',this.relation.id,this.access >= access ? access - 1 : access);
		}
	}
};

let MyBuilderRoleAccessWidget = {
	name:'my-builder-role-access-widget',
	template:`<tr class="entry">
		<td>
			<span class="builder-role-td-name">{{ widget.name }}</span>
		</td>
		<td>
			<my-bool
				@update:modelValue="$emit('apply',widget.id,access === 1 ? -1 : 1)"
				:modelValue="access === 1 ? true : false"
				:readonly="readonly"
			/>
		</td>
		<td class="maximum"></td>
	</tr>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		idMapAccess:    { type:Object,  required:true },
		readonly:       { type:Boolean, required:true },
		widget:         { type:Object,  required:true }
	},
	emits:['apply'],
	computed:{
		access:(s) => typeof s.idMapAccess[s.widget.id] === 'undefined'
			? -1 : s.idMapAccess[s.widget.id]
	}
};

let MyBuilderRole = {
	name:'my-builder-role',
	components:{
		MyBuilderCaption,
		MyBuilderMenuTabSelect,
		MyBuilderRoleAccessApi,
		MyBuilderRoleAccessClientEvent,
		MyBuilderRoleAccessCollection,
		MyBuilderRoleAccessMenu,
		MyBuilderRoleAccessRelation,
		MyBuilderRoleAccessWidget,
		MyTabs
	},
	template:`<div class="builder-role contentBox grow" v-if="ready">
			
		<div class="top">
			<div class="area nowrap">
				<img class="icon" src="images/personMultiple.png" />
				<h1 class="title">{{ capApp.titleOne.replace('{NAME}',name) }}</h1>
			</div>
			<div class="area nowrap">
				<my-builder-caption class="title"
					v-model="captions.roleTitle"
					:contentName="capGen.title"
					:language="builderLanguage"
					:longInput="true"
					:readonly="readonly"
				/>
			</div>
			<div class="area nowrap"></div>
		</div>
		<div class="top lower">
			<div class="area">
				<my-button image="save.png"
					@trigger="set"
					:active="canSave"
					:caption="capGen.button.save"
				/>
				<my-button image="refresh.png"
					@trigger="reset"
					:active="hasChanges"
					:caption="capGen.button.refresh"
				/>
				<my-button image="visible1.png"
					@trigger="copyValueDialog(name,id,id)"
					:caption="capGen.id"
				/>
				<my-button image="delete.png"
					@trigger="delAsk"
					:active="!readonly && !isEveryone"
					:cancel="true"
					:caption="capGen.button.delete"
					:captionTitle="capGen.button.delete"
				/>
			</div>
		</div>
		
		<div class="content no-padding row grow">
			<div class="column grow">
				<my-tabs
					v-model="tabTarget"
					:entries="['data','menus','collections','apis','widgets','clientEvents']"
					:entriesIcon="['images/database.png','images/menu.png','images/tray.png','images/api.png','images/tiles.png','images/screen.png']"
					:entriesText="tabCaptions"
				/>
				
				<div class="builder-role-content">
					<table class="generic-table sticky-top default-inputs" v-if="tabTarget === 'data'">
						<thead>
							<tr>
								<th>{{ capGen.relation }}</th>
								<th colspan="2">
									<my-button
										@trigger="toggleRelationsAll"
										:caption="capGen.attribute"
										:image="module.relations.length === relationIdsShown.length ? 'triangleDown.png' : 'triangleRight.png'"
										:naked="true"
									/>
								</th>
								<th>
									<div class="mixed-header">
										<img src="images/visible1.png" />
										<span>{{ capApp.accessRead }}</span>
									</div>
								</th>
								<th>
									<div class="mixed-header">
										<img src="images/edit.png" />
										<span>{{ capApp.accessWrite }}</span>
									</div>
								</th>
								<th>
									<div class="mixed-header">
										<img src="images/delete.png" />
										<span>{{ capApp.accessDelete }}</span>
									</div>
								</th>
								<th class="maximum"></th>
							</tr>
						</thead>
						<tbody>
							<my-builder-role-access-relation
								v-for="rel in module.relations"
								@apply-attribute="(...args) => apply('attribute',args[0],args[1])"
								@apply-relation="(...args) => apply('relation',args[0],args[1])"
								@relation-selected="toggleRelation"
								:attributeIdMapAccess="accessAttributes"
								:key="role.id + '_' + rel.id"
								:relation="rel"
								:role="role"
								:readonly="readonly"
								:relationIdMapAccess="accessRelations"
								:showEntries="relationIdsShown.includes(rel.id)"
							/>
						</tbody>
					</table>
					
					<template v-if="tabTarget === 'menus'">
						<div v-if="module.menuTabs.length > 1">
							<div class="builder-role-menu-tab-select"></div>
							<my-builder-menu-tab-select
								v-model="menuTabIdShown"
								:builderLanguage="builderLanguage"
								:menuTabs="module.menuTabs"
							/>
						</div>
						<table class="generic-table sticky-top default-inputs">
							<thead>
								<tr>
									<th>{{ capGen.menu }}</th>
									<th>
										<my-button
											@trigger="toggleMenusAll"
											:caption="capApp.menusSub"
											:image="menuIdsAll.length === menuIdsShow.length ? 'triangleDown.png' : 'triangleRight.png'"
											:naked="true"
										/>
									</th>
									<th>
										<div class="mixed-header">
											<img src="images/visible1.png" />
											<span>{{ capApp.access }}</span>
										</div>
									</th>
									<th class="maximum"></th>
								</tr>
							</thead>
							<tbody>
								<template v-for="mt in module.menuTabs">
									<my-builder-role-access-menu
										v-if="mt.id === menuTabIdShown"
										v-for="men in mt.menus"
										@apply="(...args) => apply('menu',args[0],args[1])"
										@toggle="toggleMenu"
										:builderLanguage="builderLanguage"
										:depth="0"
										:idMapAccess="accessMenus"
										:key="role.id + '_' + men.id"
										:menu="men"
										:menuIdsShow="menuIdsShow"
										:role="role"
										:readonly="readonly"
									/>
								</template>
							</tbody>
						</table>
					</template>
					
					<table class="generic-table sticky-top default-inputs" v-if="tabTarget === 'clientEvents'">
						<thead>
							<tr>
								<th>{{ capGen.clientEvent }}</th>
								<th>{{ capApp.access }}</th>
								<th class="maximum"></th>
							</tr>
						</thead>
						<tbody>
							<my-builder-role-access-client-event
								v-for="ce in module.clientEvents"
								@apply="(...args) => apply('clientEvent',args[0],args[1])"
								:builderLanguage="builderLanguage"
								:clientEvent="ce"
								:idMapAccess="accessClientEvents"
								:key="role.id + '_' + ce.id"
								:readonly="readonly"
							/>
						</tbody>
					</table>
					
					<table class="generic-table sticky-top default-inputs" v-if="tabTarget === 'collections'">
						<thead>
							<tr>
								<th>{{ capGen.collection }}</th>
								<th>{{ capApp.access }}</th>
								<th class="maximum"></th>
							</tr>
						</thead>
						<tbody>
							<my-builder-role-access-collection
								v-for="c in module.collections"
								@apply="(...args) => apply('collection',args[0],args[1])"
								:builderLanguage="builderLanguage"
								:collection="c"
								:idMapAccess="accessCollections"
								:key="role.id + '_' + c.id"
								:readonly="readonly"
							/>
						</tbody>
					</table>
					
					<table class="generic-table sticky-top default-inputs" v-if="tabTarget === 'apis'">
						<thead>
							<tr>
								<th>{{ capGen.api }}</th>
								<th>{{ capApp.access }}</th>
								<th class="maximum"></th>
							</tr>
						</thead>
						<tbody>
							<my-builder-role-access-api
								v-for="a in module.apis"
								@apply="(...args) => apply('api',args[0],args[1])"
								:api="a"
								:builderLanguage="builderLanguage"
								:idMapAccess="accessApis"
								:key="role.id + '_' + a.id"
								:readonly="readonly"
							/>
						</tbody>
					</table>
					
					<table class="generic-table sticky-top default-inputs" v-if="tabTarget === 'widgets'">
						<thead>
							<tr>
								<th>{{ capGen.widget }}</th>
								<th>{{ capApp.access }}</th>
								<th class="maximum"></th>
							</tr>
						</thead>
						<tbody>
							<my-builder-role-access-widget
								v-for="w in module.widgets"
								@apply="(...args) => apply('widget',args[0],args[1])"
								:builderLanguage="builderLanguage"
								:idMapAccess="accessWidgets"
								:key="role.id + '_' + w.id"
								:readonly="readonly"
								:widget="w"
							/>
						</tbody>
					</table>
				</div>
			</div>
			
			<!-- sidebar -->
			<div class="contentBox sidebar" v-if="!isEveryone">
				<div class="content padding default-inputs">
					<h3 class="title">{{ capGen.properties }}</h3>
					<table class="generic-table-vertical default-inputs">
						<tbody>
							<tr>
								<td>{{ capGen.name }}</td>
								<td><input v-model="name" :disabled="isEveryone || readonly" /></td>
							</tr>
							<tr>
								<td>{{ capGen.title }}</td>
								<td>
									<my-builder-caption
										v-model="captions.roleTitle"
										:contentName="capGen.title"
										:language="builderLanguage"
										:readonly="readonly"
									/>
								</td>
							</tr>
							<tr>
								<td>{{ capGen.description }}</td>
								<td>
									<my-builder-caption
										v-model="captions.roleDesc"
										:contentName="capGen.description"
										:language="builderLanguage"
										:multiLine="true"
										:readonly="readonly"
									/>
								</td>
							</tr>
							<tr>
								<td>{{ capGen.category }}</td>
								<td>
									<select v-model="content" :disabled="readonly">
										<option value="admin">{{ capApp.option.contentAdmin }}</option>
										<option value="user">{{ capApp.option.contentUser }}</option>
										<option value="other">{{ capApp.option.contentOther }}</option>
										<option v-if="isEveryone" value="everyone">
											{{ capApp.option.contentEveryone }}
										</option>
									</select>
								</td>
							</tr>
							<tr>
								<td>{{ capApp.assignable }}</td>
								<td><my-bool v-model="assignable" :readonly="readonly" /></td>
							</tr>
							<tr>
								<td>{{ capApp.children }}</td>
								<td>
									<my-button image="delete.png"
										v-for="c in childrenIds"
										@trigger="childRemove(c)"
										:active="!readonly"
										:caption="moduleIdMap[roleIdMap[c].moduleId].name + '->' + roleIdMap[c].name"
										:naked="true"
									/>
									
									<select
										@change="childAdd($event.target.value)"
										:disabled="readonly"
										:value="null"
									>
										<option disabled :value="null">[{{ capGen.button.add }}]</option>
										<optgroup
											v-for="mod in getDependentModules(module)"
											:label="mod.name"
										>
											<option
												v-for="r in mod.roles.filter(v => v.id !== role.id && !childrenIds.includes(v.id) && v.name !== 'everyone')"
												:value="r.id"
											>
												{{ r.name }}
											</option>
										</optgroup>
									</select>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</div>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		id:             { type:String,  required:true },
		readonly:       { type:Boolean, required:true }
	},
	watch:{
		role:{
			handler(v) { if(v !== false) this.reset(); },
			immediate:true
		}
	},
	mounted() {
		this.$store.commit('keyDownHandlerAdd',{fnc:this.set,key:'s',keyCtrl:true});
	},
	unmounted() {
		this.$store.commit('keyDownHandlerDel',this.set);
	},
	data() {
		return {
			// inputs
			accessApis:{},
			accessAttributes:{},
			accessClientEvents:{},
			accessCollections:{},
			accessMenus:{},
			accessRelations:{},
			accessWidgets:{},
			assignable:true,
			captions:{},
			childrenIds:[],
			content:'user',
			name:'',
			
			// states
			menuIdsShow:[],
			menuTabIdShown:null,
			ready:false,
			relationIdsShown:[],
			tabTarget:'data'
		};
	},
	computed:{
		hasChanges:(s) =>
			s.name          !== s.role.name
			|| s.content    !== s.role.content
			|| s.assignable !== s.role.assignable
			|| JSON.stringify(s.childrenIds)        !== JSON.stringify(s.role.childrenIds)
			|| JSON.stringify(s.accessApis)         !== JSON.stringify(s.role.accessApis)
			|| JSON.stringify(s.accessAttributes)   !== JSON.stringify(s.role.accessAttributes)
			|| JSON.stringify(s.accessClientEvents) !== JSON.stringify(s.role.accessClientEvents)
			|| JSON.stringify(s.accessCollections)  !== JSON.stringify(s.role.accessCollections)
			|| JSON.stringify(s.accessMenus)        !== JSON.stringify(s.role.accessMenus)
			|| JSON.stringify(s.accessRelations)    !== JSON.stringify(s.role.accessRelations)
			|| JSON.stringify(s.accessWidgets)      !== JSON.stringify(s.role.accessWidgets)
			|| JSON.stringify(s.captions)           !== JSON.stringify(s.role.captions),
		menuIdsAll:(s) => {
			let out = [];
			const getChildren = function(menus) {
				for(const m of menus) {
					if(m.menus.length === 0)
						continue;
					
					out.push(m.id);
					getChildren(m.menus);
				}
			};
			for(const mt of s.module.menuTabs) {
				getChildren(mt.menus);
			}
			return out;
		},
		tabCaptions:(s) => {
			return [
				`${s.capGen.data} (${s.module.relations.length})`,
				`${s.capGen.menus} (${s.module.menuTabs.length})`,
				`${s.capGen.collections} (${s.module.collections.length})`,
				`${s.capGen.apis} (${s.module.apis.length})`,
				`${s.capGen.widgets} (${s.module.widgets.length})`,
				`${s.capGen.clientEvents} (${s.module.clientEvents.length})`
			];
		},
		
		// simple
		canSave:   (s) => s.hasChanges && !s.readonly,
		isEveryone:(s) => s.role.name === 'everyone',
		module:    (s) => s.role === false ? false : s.moduleIdMap[s.role.moduleId],
		role:      (s) => typeof s.roleIdMap[s.id] === 'undefined' ? false : s.roleIdMap[s.id],
		
		// stores
		moduleIdMap: (s) => s.$store.getters['schema/moduleIdMap'],
		roleIdMap:   (s) => s.$store.getters['schema/roleIdMap'],
		appFunctions:(s) => s.$store.getters.appFunctions,
		capApp:      (s) => s.$store.getters.captions.builder.role,
		capGen:      (s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		copyValueDialog,
		getDependentModules,
		
		// actions
		apply(type,id,access) {
			switch(type) {
				case 'api':         this.accessApis[id]         = access; break;
				case 'attribute':   this.accessAttributes[id]   = access; break;
				case 'clientEvent': this.accessClientEvents[id] = access; break;
				case 'collection':  this.accessCollections[id]  = access; break;
				case 'menu':        this.accessMenus[id]        = access; break;
				case 'relation':    this.accessRelations[id]    = access; break;
				case 'widget':      this.accessWidgets[id]      = access; break;
			}
		},
		childAdd(id) {
			this.childrenIds.push(id);
		},
		childRemove(id) {
			let pos = this.childrenIds.indexOf(id);
			if(pos !== -1)
				this.childrenIds.splice(pos,1);
		},
		reset() {
			this.name               = this.role.name;
			this.content            = this.role.content;
			this.assignable         = this.role.assignable;
			this.childrenIds        = JSON.parse(JSON.stringify(this.role.childrenIds)),
			this.accessApis         = JSON.parse(JSON.stringify(this.role.accessApis));
			this.accessAttributes   = JSON.parse(JSON.stringify(this.role.accessAttributes));
			this.accessClientEvents = JSON.parse(JSON.stringify(this.role.accessClientEvents));
			this.accessCollections  = JSON.parse(JSON.stringify(this.role.accessCollections));
			this.accessMenus        = JSON.parse(JSON.stringify(this.role.accessMenus));
			this.accessRelations    = JSON.parse(JSON.stringify(this.role.accessRelations));
			this.accessWidgets      = JSON.parse(JSON.stringify(this.role.accessWidgets));
			this.captions           = JSON.parse(JSON.stringify(this.role.captions));

			if(this.menuTabIdShown === null && this.module.menuTabs.length !== 0)
				this.menuTabIdShown = this.module.menuTabs[0].id;
				
			this.ready = true;
		},
		toggleMenu(id) {
			const pos = this.menuIdsShow.indexOf(id);
			if(pos !== -1) this.menuIdsShow.splice(pos,1);
			else           this.menuIdsShow.push(id);
		},
		toggleMenusAll() {
			if(this.menuIdsShow.length === this.menuIdsAll.length)
				return this.menuIdsShow = [];
			
			this.menuIdsShow = JSON.parse(JSON.stringify(this.menuIdsAll));
		},
		toggleRelation(id) {
			let pos = this.relationIdsShown.indexOf(id);
			
			if(pos === -1) this.relationIdsShown.push(id);
			else           this.relationIdsShown.splice(pos,1);
		},
		toggleRelationsAll() {
			if(this.relationIdsShown.length === this.module.relations.length)
				return this.relationIdsShown = [];
			
			let out = [];
			for(const rel of this.module.relations) {
				out.push(rel.id);
			}
			this.relationIdsShown = out;
		},
		
		// backend calls
		delAsk() {
			this.$store.commit('dialog',{
				captionBody:this.capApp.dialog.delete,
				buttons:[{
					cancel:true,
					caption:this.capGen.button.delete,
					exec:this.del,
					image:'delete.png'
				},{
					caption:this.capGen.button.cancel,
					image:'cancel.png'
				}]
			});
		},
		del() {
			ws.send('role','del',{id:this.role.id},true).then(
				() => {
					this.$root.schemaReload(this.role.moduleId);
					this.appFunctions.loginReauthAll(false);
					this.$router.push('/builder/roles/'+this.role.moduleId);
				},
				this.$root.genericError
			);
		},
		set() {
			if(!this.canSave) return;
			
			ws.send('role','set',{
				id:this.role.id,
				name:this.name,
				content:this.content,
				assignable:this.assignable,
				childrenIds:this.childrenIds,
				accessApis:this.accessApis,
				accessAttributes:this.accessAttributes,
				accessClientEvents:this.accessClientEvents,
				accessCollections:this.accessCollections,
				accessMenus:this.accessMenus,
				accessRelations:this.accessRelations,
				accessWidgets:this.accessWidgets,
				captions:this.captions
			},true).then(
				() => {
					this.$root.schemaReload(this.role.moduleId);
					this.appFunctions.loginReauthAll(false);
				},
				this.$root.genericError
			);
		}
	}
};