import MyBuilderCaption      from './builderCaption.js';
import {getDependentModules} from '../shared/builder.js';
import {copyValueDialog}     from '../shared/generic.js';
export {MyBuilderRole as default};

let MyBuilderRoleAccessApi = {
	name:'my-builder-role-access-api',
	template:`<tbody>
		<tr class="entry">
			<td class="maximum">{{ api.name + ' (v' + api.version + ')' }}</td>
			<td>
				<my-bool
					@update:modelValue="$emit('apply',api.id,access === 1 ? -1 : 1)"
					:modelValue="access === 1 ? true : false"
					:readonly="readonly"
				/>
			</td>
		</tr>
	</tbody>`,
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
		access:(s) => typeof s.idMapAccess[s.collection.id] === 'undefined'
			? -1 : s.idMapAccess[s.collection.id]
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
					:tight="true"
				/>
			</td>
			<td class="clickable" @click="showSubs = !showSubs">
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
						:builderLanguage="builderLanguage"
						:idMapAccess="idMapAccess"
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
	data() {
		return { showSubs:true };
	},
	computed:{
		access:   (s) => typeof s.idMapAccess[s.menu.id] === 'undefined' ? -1 : s.idMapAccess[s.menu.id],
		subsExist:(s) => s.menu.menus.length !== 0,
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
	template:`<tbody>
		<tr>
			<td colspan="2">
				<my-button
					@trigger="$emit('relation-selected',relation.id)"
					:caption="relation.name + (brokenInheritance ? '*' : '')"
					:image="showEntries ? 'triangleDown.png' : 'triangleRight.png'"
					:naked="true"
					:tight="true"
				/>
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
			<td></td>
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
	}
};

let MyBuilderRole = {
	name:'my-builder-role',
	components:{
		MyBuilderCaption,
		MyBuilderRoleAccessApi,
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
					:active="hasChanges && !readonly"
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
				<my-button
					@trigger="showProperties = !showProperties"
					:active="!isEveryone"
					:caption="capGen.properties"
					:image="showProperties ? 'checkbox1.png' : 'checkbox0.png'"
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
		
		<div class="content no-padding">
			<div class="contentBox grow access">
				<div class="contentPart">
					<div class="contentPartHeader">
						<img class="icon" src="images/database.png" />
						<h1>{{ capApp.data }}</h1>
					</div>
					
					<table class="default-inputs">
						<thead>
							<th>{{ capApp.relation }}</th>
							<th>{{ capApp.attribute }}</th>
							<th>{{ capApp.access }}*</th>
						</thead>
						
						<my-builder-role-access-relation
							v-for="rel in module.relations"
							@apply-attribute="(...args) => apply('attribute',args[0],args[1])"
							@apply-relation="(...args) => apply('relation',args[0],args[1])"
							@relation-selected="toggleRelationShow"
							:attributeIdMapAccess="accessAttributes"
							:key="role.id + '_' + rel.id"
							:relation="rel"
							:role="role"
							:readonly="readonly"
							:relationIdMapAccess="accessRelations"
							:show-entries="relationIdsShown.includes(rel.id)"
						/>
					</table>
					
					<p>{{ capApp.legend }}</p>
				</div>
				<div class="contentPart">
					<div class="contentPartHeader">
						<img class="icon" src="images/menu.png" />
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
							:builderLanguage="builderLanguage"
							:idMapAccess="accessMenus"
							:key="role.id + '_' + men.id"
							:menu="men"
							:role="role"
							:readonly="readonly"
						/>
					</table>
				</div>
				<div class="contentPart">
					<div class="contentPartHeader">
						<img class="icon" src="images/tray.png" />
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
							:builderLanguage="builderLanguage"
							:collection="c"
							:idMapAccess="accessCollections"
							:key="role.id + '_' + c.id"
							:readonly="readonly"
						/>
					</table>
				</div>
				<div class="contentPart">
					<div class="contentPartHeader">
						<img class="icon" src="images/api.png" />
						<h1>{{ capApp.apis }}</h1>
					</div>
					
					<table class="default-inputs">
						<thead>
							<th>{{ capApp.api }}</th>
							<th>{{ capApp.access }}</th>
						</thead>
						
						<my-builder-role-access-api
							v-for="a in module.apis"
							@apply="(...args) => apply('api',args[0],args[1])"
							:api="a"
							:builderLanguage="builderLanguage"
							:idMapAccess="accessApis"
							:key="role.id + '_' + a.id"
							:readonly="readonly"
						/>
					</table>
				</div>
			</div>
			
			<!-- sidebar -->
			<div class="contentBox sidebar" v-if="!isEveryone && showProperties">
				<div class="top lower">
					<div class="area nowrap">
						<h1 class="title">{{ capGen.properties }}</h1>
					</div>
				</div>
				<div class="content padding default-inputs">
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
			handler(v) { if(v !== false) this.reset(); },
			immediate:true
		}
	},
	mounted() {
		this.$emit('hotkeysRegister',[{fnc:this.set,key:'s',keyCtrl:true}]);
	},
	unmounted() {
		this.$emit('hotkeysRegister',[]);
	},
	data() {
		return {
			// inputs
			accessApis:{},
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
			|| JSON.stringify(s.accessApis)        !== JSON.stringify(s.role.accessApis)
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
		
		// actions
		apply(type,id,access) {
			switch(type) {
				case 'api':        this.accessApis[id]        = access; break;
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
			this.accessApis        = JSON.parse(JSON.stringify(this.role.accessApis));
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
				accessApis:this.accessApis,
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