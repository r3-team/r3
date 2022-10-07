import MyBuilderCaption from './builderCaption.js';
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
				<div class="separator"></div>
				<my-builder-caption
					v-model="captions.roleTitle"
					:contentName="capApp.titleOne"
					:language="builderLanguage"
					:longInput="true"
					:readonly="isEveryone"
				/>
				<my-button :active="false" :caption="role.name" :naked="true "/>
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
			accessAttributes:{},
			accessCollections:{},
			accessMenus:{},
			accessRelations:{},
			captions:{},
			ready:false,
			relationIdsShown:[]
		};
	},
	computed:{
		// entities
		module:(s) => {
			return s.role === false
				? false : s.moduleIdMap[s.role.moduleId];
		},
		role:(s) => {
			return typeof s.roleIdMap[s.id] === 'undefined'
				? false : s.roleIdMap[s.id];
		},
		
		// states
		hasChanges:(s) => {
			return JSON.stringify(s.accessAttributes)  !== JSON.stringify(s.role.accessAttributes)
				|| JSON.stringify(s.accessCollections) !== JSON.stringify(s.role.accessCollections)
				|| JSON.stringify(s.accessMenus)       !== JSON.stringify(s.role.accessMenus)
				|| JSON.stringify(s.accessRelations)   !== JSON.stringify(s.role.accessRelations)
				|| JSON.stringify(s.captions)          !== JSON.stringify(s.role.captions);
		},
		isEveryone:(s) => s.role.name === 'everyone',
		
		// stores
		moduleIdMap:(s) => s.$store.getters['schema/moduleIdMap'],
		roleIdMap:  (s) => s.$store.getters['schema/roleIdMap'],
		capApp:     (s) => s.$store.getters.captions.builder.role,
		capGen:     (s) => s.$store.getters.captions.generic
	},
	methods:{
		// actions
		apply(type,id,access) {
			switch(type) {
				case 'attribute':  this.accessAttributes[id]  = access; break;
				case 'collection': this.accessCollections[id] = access; break;
				case 'menu':       this.accessMenus[id]       = access; break;
				case 'relation':   this.accessRelations[id]   = access; break;
			}
		},
		reset() {
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
		set() {
			ws.send('role','set',{
				id:this.role.id,
				name:this.role.name,
				content:this.role.content,
				assignable:this.role.assignable,
				childrenIds:this.role.childrenIds,
				
				// changable values in this UI
				accessAttributes:this.accessAttributes,
				accessCollections:this.accessCollections,
				accessMenus:this.accessMenus,
				accessRelations:this.accessRelations,
				captions:this.captions
			},true).then(
				() => this.$root.schemaReload(this.module.id),
				this.$root.genericError
			);
		}
	}
};