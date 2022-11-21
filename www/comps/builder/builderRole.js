import MyBuilderCaption      from './builderCaption.js';
import {getDependentModules} from '../shared/builder.js';
import {copyValueDialog}     from '../shared/generic.js';
export {MyBuilderRole as default};

let MyBuilderRoleAccessCollection = {
	name:'my-builder-role-access-collection',
	template:`<tbody>
		<tr class="entry">
			<td class="maximum">{{ collection.name }}</td>
			<td>
				<my-bool
					@update:modelValue="$emit('apply',collection.id,access === 1 ? -1 : 1)"
					:modelValue="access === 1 ? true : false"
					:readonly="readonly"
				/>
			</td>
		</tr>
	</tbody>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		collection:     { type:Object,  required:true },
		idMapAccess:    { type:Object,  required:true },
		readonly:       { type:Boolean, required:true }
	},
	emits:['apply'],
	computed:{
		access:function() {
			return typeof this.idMapAccess[this.collection.id] === 'undefined'
				? -1 : this.idMapAccess[this.collection.id];
		}
	}
};

let MyBuilderRoleAccessMenu = {
	name:'my-builder-role-access-menu',
	template:`<tbody>
		<tr class="entry">
			<td class="minimum">
				<my-button
					v-if="subsExist"
					@trigger="showSubs = !showSubs"
					:image="showSubs ? 'triangleDown.png' : 'triangleRight.png'"
					:naked="true"
				/>
			</td>
			<td class="maximum clickable" @click="showSubs = !showSubs">
				{{ title }}
			</td>
			<td>
				<my-bool
					@update:modelValue="$emit('apply',menu.id,access === 1 ? -1 : 1)"
					:modelValue="access === 1 ? true : false"
					:readonly="readonly"
				/>
			</td>
		</tr>
		
		<tr v-if="subsExist && showSubs">
			<td></td>
			<td colspan="999">
				<table class="box">
					<my-builder-role-access-menu
						v-for="men in menu.menus"
						@apply="(...args) => $emit('apply',...args)"
						:builder-language="builderLanguage"
						:id-map-access="idMapAccess"
						:key="men.id"
						:menu="men"
						:readonly="readonly"
						:role="role"
					/>
				</table>
			</td>
		</tr>
	</tbody>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		idMapAccess:    { type:Object,  required:true },
		menu:           { type:Object,  required:true },
		readonly:       { type:Boolean, required:true },
		role:           { type:Object,  required:true }
	},
	emits:['apply'],
	data:function() {
		return { showSubs:true };
	},
	computed:{
		access:function() {
			if(typeof this.idMapAccess[this.menu.id] === 'undefined')
				return -1;
			
			return this.idMapAccess[this.menu.id];
		},
		subsExist:function() {
			return this.menu.menus.length !== 0;
		},
		title:function() {
			// 1st preference: proper menu title
			if(typeof this.menu.captions.menuTitle[this.builderLanguage] !== 'undefined')
				return this.menu.captions.menuTitle[this.builderLanguage];
			
			// 2nd preference (if form is referenced): form title
			if(this.menu.formId !== null) {
				let form = this.formIdMap[this.menu.formId];
				
				if(typeof form.captions.formTitle[this.builderLanguage] !== 'undefined')
					return form.captions.formTitle[this.builderLanguage];
			}
			return this.capGen.missingCaption;
		},
		
		// stores
		formIdMap:function() { return this.$store.getters['schema/formIdMap']; },
		capGen:   function() { return this.$store.getters.captions.generic; }
	}
};

let MyBuilderRoleAccessRelation = {
	name:'my-builder-role-access-relation',
	template:`<tbody>
		<tr>
			<td class="minimum">
				<my-button
					v-if="relation.attributes.length !== 0"
					@trigger="$emit('relation-selected',relation.id)"
					:image="showEntries ? 'triangleDown.png' : 'triangleRight.png'"
					:naked="true"
				/>
			</td>
			<td colspan="2" class="clickable maximum"
				@click="$emit('relation-selected',relation.id)"
			>
				{{ relation.name + (brokenInheritance ? '*' : '') }}
			</td>
			<td>
				<select
					@input="$emit('apply-relation',relation.id,parseInt($event.target.value))"
					:disabled="readonly"
					:value="access"
				>
					<!-- null state (-1) for relation means: no access -->
					<option value="-1">{{ capApp.option.accessNone }}</option>
					<option value="1">{{ capApp.option.accessRead }}</option>
					<option value="2">{{ capApp.option.accessWrite }}</option>
					<option value="3">{{ capApp.option.accessDelete }}</option>
				</select>
			</td>
		</tr>
		<tr class="entry"
			v-if="showEntries"
			v-for="atr in relation.attributes"
			:key="atr.id"
		>
			<td colspan="2"></td>
			<td>{{ attributeIdMap[atr.id].name }}</td>
			<td>
				<select
					@input="$emit('apply-attribute',atr.id,parseInt($event.target.value))"
					:disabled="readonly"
					:value="attributeIdMapAccessParsed[atr.id]"
				>
					<!-- null state (-1) for attribute means: follow relation -->
					<option value="-1">{{ capApp.option.accessInherit }}</option>
					<option value="0">{{ capApp.option.accessNone }}</option>
					<option value="1">{{ capApp.option.accessRead }}</option>
					<option value="2">{{ capApp.option.accessWrite }}</option>
				</select>
			</td>
		</tr>
	</tbody>`,
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
		access:function() {
			if(typeof this.relationIdMapAccess[this.relation.id] === 'undefined')
				return -1;
			
			return this.relationIdMapAccess[this.relation.id];
		},
		attributeIdMapAccessParsed:function() {
			let out = {};
			for(let i = 0, j = this.relation.attributes.length; i < j; i++) {
				let a = this.relation.attributes[i];
				
				if(typeof this.attributeIdMapAccess[a.id] === 'undefined') {
					out[a.id] = -1;
					continue;
				}
				out[a.id] = this.attributeIdMapAccess[a.id];
			}
			return out;
		},
		brokenInheritance:function() {
			for(let key in this.attributeIdMapAccessParsed) {
				if(this.attributeIdMapAccessParsed[key] !== -1)
					return true;
			}
			return false;
		},
		
		// stores
		relationIdMap: function() { return this.$store.getters['schema/relationIdMap']; },
		attributeIdMap:function() { return this.$store.getters['schema/attributeIdMap']; },
		capApp:        function() { return this.$store.getters.captions.builder.role; }
	}
};

let MyBuilderRole = {
	name:'my-builder-role',
	components:{
		MyBuilderCaption,
		MyBuilderRoleAccessCollection,
		MyBuilderRoleAccessMenu,
		MyBuilderRoleAccessRelation
	},
	template:`<div class="builder-role contentBox grow" v-if="ready">
			
		<div class="top">
			<div class="area nowrap">
				<img class="icon" src="images/personMultiple.png" />
				<h1 class="title">{{ capApp.titleOne.replace('{NAME}',name) }}</h1>
			</div>
			
			<div class="area">
				<my-button image="visible1.png"
					@trigger="copyValueDialog(role.name,role.id,role.id)"
				/>
				<my-button image="delete.png"
					@trigger="delAsk"
					:active="!readonly"
					:cancel="true"
					:caption="capGen.button.delete"
					:captionTitle="capGen.button.delete"
				/>
			</div>
		</div>
		<div class="top lower">
			<div class="area">
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
			</div>
		</div>
		
		<div class="content no-padding">
		
			<!-- properties -->
			<div class="contentPart" v-if="!isEveryone">
				<div class="contentPartHeader clickable" @click="showProperties = !showProperties">
					<img class="icon" :src="displayArrow(showProperties)" />
					<h1>{{ capGen.properties }}</h1>
				</div>
				
				<template v-if="showProperties">
					<table class="builder-table-vertical default-inputs">
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
								<my-button image="cancel.png"
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
										v-for="mod in getDependentModules(module,modules)"
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
					</table>
				</template>
			</div>
			
			<!-- permissions -->
			<br />
			<div class="access-header">
				<img class="icon" src="images/lock.png" />
				<h1>{{ capApp.access }}</h1>
			</div>
			
			<div class="row">
				<div class="contentPart">
					<div class="contentPartHeader">
						<h1>{{ capApp.data }}</h1>
					</div>
					
					<table class="default-inputs">
						<thead>
							<th></th>
							<th>{{ capApp.relation }}</th>
							<th>{{ capApp.attribute }}</th>
							<th>{{ capApp.access }}*</th>
						</thead>
						
						<my-builder-role-access-relation
							v-for="rel in module.relations"
							@apply-attribute="(...args) => apply('attribute',args[0],args[1])"
							@apply-relation="(...args) => apply('relation',args[0],args[1])"
							@relation-selected="toggleRelationShow"
							:attribute-id-map-access="accessAttributes"
							:key="role.id + '_' + rel.id"
							:relation="rel"
							:role="role"
							:readonly="readonly"
							:relation-id-map-access="accessRelations"
							:show-entries="relationIdsShown.includes(rel.id)"
						/>
					</table>
					
					<p>{{ capApp.legend }}</p>
				</div>
				
				<div class="contentPart">
					<div class="contentPartHeader">
						<h1>{{ capApp.menus }}</h1>
					</div>
					
					<table class="default-inputs">
						<thead>
							<th colspan="2">{{ capApp.menu }}</th>
							<th>{{ capApp.access }}</th>
						</thead>
						
						<my-builder-role-access-menu
							v-for="men in module.menus"
							@apply="(...args) => apply('menu',args[0],args[1])"
							:builder-language="builderLanguage"
							:id-map-access="accessMenus"
							:key="role.id + '_' + men.id"
							:menu="men"
							:role="role"
							:readonly="readonly"
						/>
					</table>
				</div>
				
				<div class="contentPart">
					<div class="contentPartHeader">
						<h1>{{ capApp.collections }}</h1>
					</div>
					
					<table class="default-inputs">
						<thead>
							<th>{{ capApp.collection }}</th>
							<th>{{ capApp.access }}</th>
						</thead>
						
						<my-builder-role-access-collection
							v-for="c in module.collections"
							@apply="(...args) => apply('collection',args[0],args[1])"
							:builder-language="builderLanguage"
							:collection="c"
							:id-map-access="accessCollections"
							:key="role.id + '_' + c.id"
							:readonly="readonly"
						/>
					</table>
				</div>
			</div>
		</div>
	</div>`,
	emits:['hotkeysRegister'],
	props:{
		builderLanguage:{ type:String,  required:true },
		id:             { type:String,  required:true },
		readonly:       { type:Boolean, required:true }
	},
	watch:{
		role:{
			handler:function(v) { if(v !== false) this.reset(); },
			immediate:true
		}
	},
	mounted:function() {
		this.$emit('hotkeysRegister',[{fnc:this.set,key:'s',keyCtrl:true}]);
	},
	unmounted:function() {
		this.$emit('hotkeysRegister',[]);
	},
	data:function() {
		return {
			// inputs
			accessAttributes:{},
			accessCollections:{},
			accessMenus:{},
			accessRelations:{},
			assignable:true,
			captions:{},
			childrenIds:[],
			content:'user',
			name:'',
			
			// states
			ready:false,
			relationIdsShown:[],
			showProperties:false
		};
	},
	computed:{
		hasChanges:(s) =>
			s.name          !== s.role.name
			|| s.content    !== s.role.content
			|| s.assignable !== s.role.assignable
			|| JSON.stringify(s.childrenIds)       !== JSON.stringify(s.role.childrenIds)
			|| JSON.stringify(s.accessAttributes)  !== JSON.stringify(s.role.accessAttributes)
			|| JSON.stringify(s.accessCollections) !== JSON.stringify(s.role.accessCollections)
			|| JSON.stringify(s.accessMenus)       !== JSON.stringify(s.role.accessMenus)
			|| JSON.stringify(s.accessRelations)   !== JSON.stringify(s.role.accessRelations)
			|| JSON.stringify(s.captions)          !== JSON.stringify(s.role.captions),
		
		// simple
		isEveryone:(s) => s.role.name === 'everyone',
		module:    (s) => s.role === false ? false : s.moduleIdMap[s.role.moduleId],
		role:      (s) => typeof s.roleIdMap[s.id] === 'undefined' ? false : s.roleIdMap[s.id],
		
		// stores
		modules:    (s) => s.$store.getters['schema/modules'],
		moduleIdMap:(s) => s.$store.getters['schema/moduleIdMap'],
		roleIdMap:  (s) => s.$store.getters['schema/roleIdMap'],
		capApp:     (s) => s.$store.getters.captions.builder.role,
		capGen:     (s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		copyValueDialog,
		getDependentModules,
		
		// presentation
		displayArrow(state) {
			return state ? 'images/triangleDown.png' : 'images/triangleRight.png';
		},
		
		// actions
		apply(type,id,access) {
			switch(type) {
				case 'attribute':  this.accessAttributes[id]  = access; break;
				case 'collection': this.accessCollections[id] = access; break;
				case 'menu':       this.accessMenus[id]       = access; break;
				case 'relation':   this.accessRelations[id]   = access; break;
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
			this.name              = this.role.name;
			this.content           = this.role.content;
			this.assignable        = this.role.assignable;
			this.childrenIds       = JSON.parse(JSON.stringify(this.role.childrenIds)),
			this.accessAttributes  = JSON.parse(JSON.stringify(this.role.accessAttributes));
			this.accessCollections = JSON.parse(JSON.stringify(this.role.accessCollections));
			this.accessMenus       = JSON.parse(JSON.stringify(this.role.accessMenus));
			this.accessRelations   = JSON.parse(JSON.stringify(this.role.accessRelations));
			this.captions          = JSON.parse(JSON.stringify(this.role.captions));
			this.ready = true;
		},
		toggleRelationShow(id) {
			let pos = this.relationIdsShown.indexOf(id);
			
			if(pos === -1) this.relationIdsShown.push(id);
			else           this.relationIdsShown.splice(pos,1);
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
					this.$root.loginReauthAll(false);
					this.$router.push('/builder/roles/'+this.role.moduleId);
				},
				this.$root.genericError
			);
		},
		set() {
			ws.send('role','set',{
				id:this.role.id,
				name:this.name,
				content:this.content,
				assignable:this.assignable,
				childrenIds:this.childrenIds,
				accessAttributes:this.accessAttributes,
				accessCollections:this.accessCollections,
				accessMenus:this.accessMenus,
				accessRelations:this.accessRelations,
				captions:this.captions
			},true).then(
				() => {
					this.$root.schemaReload(this.role.moduleId);
					this.$root.loginReauthAll(false);
				},
				this.$root.genericError
			);
		}
	}
};