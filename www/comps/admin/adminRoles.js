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
	data() {
		return {
			loginId:null,
			showMembers:false
		};
	},
	computed:{
		loginIds:(s) => {
			let out = [];
			for(let l of s.logins) {
				out.push(l.id);
			}
			return out;
		},
		
		// simple
		description:(s) => s.getCaptionForModule(s.role.captions['roleDesc'],'',s.module),
		titleIcon:  (s) => s.showAll ? '' : (s.showMembers ? 'triangleDown.png' : 'triangleRight.png'),
		
		// stores
		capApp:(s) => s.$store.getters.captions.admin.roles
	},
	methods:{
		// externals
		getCaptionForModule,
		
		// actions
		add(loginId) {
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
		remove(loginIndex) {
			this.$emit('remove-by-index',loginIndex);
		},
		
		// backend calls
		getNewName(id) {
			ws.send('login','getNames',{id:id},true).then(
				res => this.$emit('add',{id:id,name:res.payload[0].name}),
				this.$root.genericError
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
				/>
				<my-button image="refresh.png"
					@trigger="get"
					:active="hasChanges"
					:caption="capGen.button.refresh"
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
					:image="showAll ? 'visible1.png' : 'visible0.png'"
				/>
				<my-button
					@trigger="showDesc = !showDesc"
					:caption="capApp.button.descriptions"
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
	data() {
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
	mounted() {
		this.$store.commit('pageTitle',this.menuTitle);
		this.$store.commit('keyDownHandlerAdd',{fnc:this.set,key:'s',keyCtrl:true});
	},
	unmounted() {
		this.$store.commit('keyDownHandlerDel',this.set);
	},
	computed:{
		rolesValid:(s) => {
			if(s.module === false) return [];
			
			let out = [];
			for(let r of s.module.roles) {
				if(!r.hidden && r.assignable && r.name !== 'everyone')
					out.push(r);
			}
			return out;
		},
		
		// simple
		hasChanges:(s) => s.loginIdsChanged.length !== 0,
		module:(s) => s.moduleId === null ? false : s.moduleIdMap[s.moduleId],
		
		// stores
		modules:    (s) => s.$store.getters['schema/modules'],
		moduleIdMap:(s) => s.$store.getters['schema/moduleIdMap'],
		capApp:     (s) => s.$store.getters.captions.admin.roles,
		capGen:     (s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		srcBase64Icon,
		
		// actions
		add(roleId,login) {
			let c = JSON.parse(JSON.stringify(this.roleIdMapLogins));
			c[roleId].push(login);
			this.roleIdMapLogins = c;
			
			if(!this.loginIdsChanged.includes(login.id))
				this.loginIdsChanged.push(login.id);
		},
		remove(roleId,loginIndex) {
			let login = this.roleIdMapLogins[roleId][loginIndex];
			
			let c = JSON.parse(JSON.stringify(this.roleIdMapLogins));
			c[roleId].splice(loginIndex,1);
			this.roleIdMapLogins = c;
			
			if(!this.loginIdsChanged.includes(login.id))
				this.loginIdsChanged.push(login.id);
		},
		
		// backend calls
		get() {
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
				res => {
					for(let i = 0, j = requests.length; i < j; i++) {
						this.roleIdMapLogins[requests[i].payload.roleId] = res[i].payload.logins;
					}
					this.loginIdsChanged = [];
				},
				this.$root.genericError
			);
		},
		set() {
			if(!this.hasChanges)
				return;
			
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
				() => {
					// reauth all affected logins
					requests = [];
					for(let i = 0, j = this.loginIdsChanged.length; i < j; i++) {
						requests.push(ws.prepare('login','reauth',{id:this.loginIdsChanged[i]}));
					}
					ws.sendMultiple(requests,false).then(
						() => {},
						this.$root.genericError
					);
					
					// reload data
					this.get();
				},
				this.$root.genericError
			);
		}
	}
};