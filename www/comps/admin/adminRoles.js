import srcBase64Icon         from '../shared/image.js';
import {getCaptionForModule} from '../shared/language.js';
import MyInputLogin          from '../inputLogin.js';
import {MyModuleSelect}      from '../input.js';
export {MyAdminRoles as default};

let MyAdminRoleItem = {	
	name:'my-admin-role-item',
	components:{MyInputLogin},
	template:`<div class="admin-role">
		
		<!-- role title -->
		<div class="admin-role-title">
			<my-button
				@trigger="showMembers = !showMembers"
				:active="!showAll"
				:caption="getCaptionForModule(role.captions['roleTitle'],role.name,module)"
				:image="titleIcon"
				:naked="true"
			/>
		</div>
		
		<!-- role description -->
		<template v-if="showDesc">
			<div class="admin-role-desc" v-if="description !== ''">
				{{ description }}
			</div>
			<div class="admin-role-desc" v-else>
				<i>{{ capApp.descriptionEmpty }}</i>
			</div>
		</template>
		
		<div class="admin-role-members" v-if="showMembers || showAll">
			
			<!-- login assignment input -->
			<div class="entry">
				<my-input-login
					@update:modelValue="add($event)"
					:clearInput="true"
					:idsExclude="loginIds"
					:modelValue="loginId"
					:noLdapAssign="true"
					:placeholder="capApp.addLogin"
				/>
			</div>
			
			<!-- assigned logins -->
			<div class="entry" v-for="(l,i) in logins" :key="l.id">
				<my-button image="cancel.png"
					@trigger="remove(i)"
					:naked="true"
				/>
				<span>{{ l.name }}</span>
			</div>
		</div>
	</div>`,
	props:{
		logins:  { type:Array,   required:true },
		module:  { type:Object,  required:true },
		role:    { type:Object,  required:true },
		showAll: { type:Boolean, required:true },
		showDesc:{ type:Boolean, required:true }
	},
	emits:['add','remove-by-index'],
	data:function() {
		return {
			loginId:null,
			showMembers:false
		};
	},
	computed:{
		description:function() {
			return this.getCaptionForModule(this.role.captions['roleDesc'],'',this.module);
		},
		loginIds:function() {
			let out = [];
			for(let i = 0, j = this.logins.length; i < j; i++) {
				out.push(this.logins[i].id);
			}
			return out;
		},
		titleIcon:function() {
			if(this.showAll)
				return '';
			
			return this.showMembers ? 'triangleDown.png' : 'triangleRight.png';
		},
		
		// stores
		capApp:function() { return this.$store.getters.captions.admin.roles; }
	},
	methods:{
		// externals
		getCaptionForModule,
		
		// actions
		add:function(loginId) {
			// clear login input
			this.loginId = loginId;
			this.$nextTick(function() {
				this.loginId = null;
			});
			
			// add, if not already in list
			for(let i = 0, j = this.logins.length; i < j; i++) {
				if(this.logins[i].id === loginId)
					return false;
			}
			this.getNewName(loginId);
		},
		remove:function(loginIndex) {
			this.$emit('remove-by-index',loginIndex);
		},
		
		// backend calls
		getNewName:function(id) {
			ws.send('login','getNames',{id:id},true).then(
				(res) => this.$emit('add',{id:id,name:res.payload[0].name}),
				(err) => this.$root.genericError(err)
			);
		}
	}
};

let MyAdminRoles = {
	name:'my-admin-roles',
	components:{
		MyAdminRoleItem,
		MyModuleSelect
	},
	template:`<div class="admin-roles contentBox grow scroll">
		
		<div class="top">
			<div class="area">
				<img class="icon" src="images/admin.png" />
				<h1>{{ menuTitle }}</h1>
			</div>
		</div>
		<div class="top lower default-inputs ">
			<div class="area">
				<my-button image="save.png"
					@trigger="set"
					:active="hasChanges"
					:caption="capGen.button.save"
					:darkBg="true"
				/>
				<my-button image="refresh.png"
					@trigger="get"
					:active="hasChanges"
					:caption="capGen.button.refresh"
					:darkBg="true"
				/>
			</div>
			<div class="area nowrap">
				<img class="icon"
					v-if="module !== false"
					:src="srcBase64Icon(module.iconId,'images/module.png')"
				/>
				<my-module-select class="selector"
					v-if="modules.length !== 0"
					@update:modelValue="moduleId = $event;get()"
					:enableAssignable="true"
					:modelValue="moduleId"
				/>
			</div>
			<div class="area">
				<my-button
					@trigger="showAll = !showAll"
					:caption="capApp.button.all"
					:darkBg="true"
					:image="showAll ? 'visible1.png' : 'visible0.png'"
				/>
				<my-button
					@trigger="showDesc = !showDesc"
					:caption="capApp.button.descriptions"
					:darkBg="true"
					:image="showDesc ? 'visible1.png' : 'visible0.png'"
				/>
			</div>
		</div>
		
		<div class="content" v-if="module === false">
			<i>{{ capApp.nothingInstalled }}</i>
		</div>
		
		<div class="content no-padding" v-if="module !== false">
			<my-admin-role-item
				v-for="r in rolesValid"
				@add="add(r.id,$event)"
				@remove-by-index="remove(r.id,$event)"
				@toggle-members=""
				:key="r.id"
				:logins="roleIdMapLogins[r.id]"
				:module="module"
				:role="r"
				:show-all="showAll"
				:show-desc="showDesc"
			/>
		</div>
	</div>`,
	props:{
		menuTitle:{ type:String, required:true }
	},
	data:function() {
		return {
			loginIdsChanged:[],
			moduleId:null,
			roleIdMapLogins:{},
			
			// states
			ready:false,
			showAll:true,
			showDesc:false
		};
	},
	computed:{
		module:function() {
			if(this.moduleId === null)
				return false;
			
			return this.moduleIdMap[this.moduleId];
		},
		rolesValid:function() {
			if(this.module === false)
				return [];
			
			let out = [];
			for(let i = 0, j = this.module.roles.length; i < j; i++) {
				let r  = this.module.roles[i];
				
				if(!r.hidden && r.assignable && r.name !== 'everyone')
					out.push(r);
			}
			return out;
		},
		
		// simple
		hasChanges:function() { return this.loginIdsChanged.length !== 0; },
		
		// stores
		modules:    function() { return this.$store.getters['schema/modules']; },
		moduleIdMap:function() { return this.$store.getters['schema/moduleIdMap']; },
		capApp:     function() { return this.$store.getters.captions.admin.roles; },
		capGen:     function() { return this.$store.getters.captions.generic; }
	},
	mounted:function() {
		this.$store.commit('pageTitle',this.menuTitle);
	},
	methods:{
		// externals
		srcBase64Icon,
		
		// actions
		add:function(roleId,login) {
			let c = JSON.parse(JSON.stringify(this.roleIdMapLogins));
			c[roleId].push(login);
			this.roleIdMapLogins = c;
			
			if(!this.loginIdsChanged.includes(login.id))
				this.loginIdsChanged.push(login.id);
		},
		remove:function(roleId,loginIndex) {
			let login = this.roleIdMapLogins[roleId][loginIndex];
			
			let c = JSON.parse(JSON.stringify(this.roleIdMapLogins));
			c[roleId].splice(loginIndex,1);
			this.roleIdMapLogins = c;
			
			if(!this.loginIdsChanged.includes(login.id))
				this.loginIdsChanged.push(login.id);
		},
		
		// backend calls
		get:function() {
			// reset and get logins for all valid roles
			this.roleIdMapLogins = {};
			
			let requests = [];
			for(let i = 0, j = this.rolesValid.length; i < j; i++) {
				this.roleIdMapLogins[this.rolesValid[i].id] = [];
				
				requests.push(ws.prepare('login','getMembers',{
					roleId:this.rolesValid[i].id
				}));
			}
			
			ws.sendMultiple(requests,true).then(
				(res) => {
					for(let i = 0, j = requests.length; i < j; i++) {
						this.roleIdMapLogins[requests[i].payload.roleId] = res[i].payload.logins;
					}
					this.loginIdsChanged = [];
				},
				(err) => this.$root.genericError(err)
			);
		},
		set:function() {
			let requests = [];
			for(let i = 0, j = this.rolesValid.length; i < j; i++) {
				
				let role     = this.rolesValid[i];
				let logins   = this.roleIdMapLogins[role.id];
				let loginIds = [];
				
				for(let x = 0, y = logins.length; x < y; x++) {
					loginIds.push(logins[x].id);
				}
				
				requests.push(ws.prepare('login','setMembers',{
					roleId:role.id,
					loginIds:loginIds
				}));
			}
			
			ws.sendMultiple(requests,true).then(
				(res) => {
					// reauth all affected logins
					requests = [];
					for(let i = 0, j = this.loginIdsChanged.length; i < j; i++) {
						requests.push(ws.prepare('login','reauth',{id:this.loginIdsChanged[i]}));
					}
					
					ws.sendMultiple(requests,false).then(
						(res) => {},
						(err) => this.$root.genericError(err)
					);
					
					// reload data
					this.get();
				},
				(err) => this.$root.genericError(err)
			);
		}
	}
};