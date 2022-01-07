export {MyBuilderRole as default};

let MyBuilderRoleMenuAccess = {
	name:'my-builder-role-menu-access',
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
			<td class="maximum clickable"
				@click="showSubs = !showSubs"
			>
				{{ title }}
			</td>
			<td>
				<my-bool
					@update:modelValue="$emit('apply-menu',menu.id,access === 1 ? -1 : 1)"
					:modelValue="access === 1 ? true : false"
				/>
			</td>
		</tr>
		
		<tr v-if="subsExist && showSubs">
			<td></td>
			<td colspan="999">
				<table class="box">
					<my-builder-role-menu-access
						v-for="men in menu.menus"
						@apply-menu="(...args) => $emit('apply-menu',...args)"
						:builder-language="builderLanguage"
						:id-map-access="idMapAccess"
						:key="men.id"
						:menu="men"
						:role="role"
					/>
				</table>
			</td>
		</tr>
	</tbody>`,
	props:{
		builderLanguage:{ type:String, required:true },
		idMapAccess:    { type:Object, required:true },
		menu:           { type:Object, required:true },
		role:           { type:Object, required:true }
	},
	emits:['apply-menu'],
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

let MyBuilderRoleRelationAccess = {
	name:'my-builder-role-relation-access',
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
			<td colspan="2" class="clickable"
				@click="$emit('relation-selected',relation.id)"
			>
				{{ relation.name + (brokenInheritance ? '*' : '') }}
			</td>
			<td>
				<select
					@input="$emit('apply-relation',relation.id,parseInt($event.target.value))"
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
					:value="attributeIdMapAccessParsed[atr.id]"
					@input="$emit('apply-attribute',atr.id,parseInt($event.target.value))"
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
		MyBuilderRoleMenuAccess,
		MyBuilderRoleRelationAccess
	},
	template:`<div class="builder-role contentBox grow" v-if="ready">
			
		<div class="top">
			<div class="area nowrap">
				<div class="separator"></div>
				<h1 class="title">
					{{ capApp.titleOne.replace('{NAME}',role.name) }}
				</h1>
			</div>
		</div>
		<div class="top lower">
			<div class="area">
				<my-button image="save.png"
					@trigger="set"
					:active="hasChanges"
					:caption="capGen.button.save"
					:darkBg="true"
				/>
				<my-button image="refresh.png"
					@trigger="reset"
					:active="hasChanges"
					:caption="capGen.button.refresh"
					:darkBg="true"
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
					
					<my-builder-role-relation-access
						v-for="rel in module.relations"
						@apply-attribute="applyAttribute"
						@apply-relation="applyRelation"
						@relation-selected="toggleRelationShow"
						:attribute-id-map-access="accessAttributes"
						:key="role.id + '_' + rel.id"
						:relation="rel"
						:role="role"
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
					
					<my-builder-role-menu-access
						v-for="men in module.menus"
						@apply-menu="applyMenu"
						:builder-language="builderLanguage"
						:id-map-access="accessMenus"
						:key="role.id + '_' + men.id"
						:menu="men"
						:role="role"
					/>
				</table>
			</div>
		</div>
	</div>`,
	props:{
		builderLanguage:{ type:String, required:true },
		id:             { type:String, required:true }
	},
	watch:{
		role:{
			handler:function(v) {
				if(v !== false) this.reset();
			},
			immediate:true
		}
	},
	data:function() {
		return {
			accessAttributes:{},
			accessMenus:{},
			accessRelations:{},
			ready:false,
			relationIdsShown:[]
		};
	},
	computed:{
		module:function() {
			if(this.role === false)
				return false;
			
			return this.moduleIdMap[this.role.moduleId];
		},
		role:function() {
			if(typeof this.roleIdMap[this.id] === 'undefined')
				return false;
			
			return this.roleIdMap[this.id];
		},
		hasChanges:function() {
			return JSON.stringify(this.accessRelations)  !== JSON.stringify(this.role.accessRelations)
				|| JSON.stringify(this.accessAttributes) !== JSON.stringify(this.role.accessAttributes)
				|| JSON.stringify(this.accessMenus)      !== JSON.stringify(this.role.accessMenus)
			;
		},
		
		// stores
		moduleIdMap:function() { return this.$store.getters['schema/moduleIdMap']; },
		roleIdMap:  function() { return this.$store.getters['schema/roleIdMap']; },
		capApp:     function() { return this.$store.getters.captions.builder.role; },
		capGen:     function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		applyAttribute:function(id,access) {
			this.accessAttributes[id] = access;
		},
		applyMenu:function(id,access) {
			this.accessMenus[id] = access;
		},
		applyRelation:function(id,access) {
			this.accessRelations[id] = access;
		},
		reset:function() {
			this.accessAttributes = JSON.parse(JSON.stringify(this.role.accessAttributes));
			this.accessMenus      = JSON.parse(JSON.stringify(this.role.accessMenus));
			this.accessRelations  = JSON.parse(JSON.stringify(this.role.accessRelations));
			this.ready = true;
		},
		toggleRelationShow:function(id) {
			let pos = this.relationIdsShown.indexOf(id);
			
			if(pos === -1) this.relationIdsShown.push(id);
			else           this.relationIdsShown.splice(pos,1);
		},
		
		set:function() {
			ws.send('role','set',{
				id:this.role.id,
				name:this.role.name,
				assignable:this.role.assignable,
				childrenIds:this.role.childrenIds,
				captions:this.role.captions,
				
				// changable values in this UI
				accessRelations:this.accessRelations,
				accessAttributes:this.accessAttributes,
				accessMenus:this.accessMenus
			},true).then(
				(res) => this.$root.schemaReload(this.module.id),
				(err) => this.$root.genericError(err)
			);
		}
	}
};