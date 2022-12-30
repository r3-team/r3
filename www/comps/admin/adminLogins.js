import srcBase64Icon          from '../shared/image.js';
import MyInputOffset          from '../inputOffset.js';
import MyInputSelect          from '../inputSelect.js';
import MyForm                 from '../form.js';
import {
	getCaptionForModule,
	getValidLanguageCode
} from '../shared/language.js';
export {MyAdminLogins as default};

let MyAdminLoginsItemRole = {
	name:'my-admin-logins-item-role',
	template:`<td class="minimum role-content">
		<my-button
			v-for="r in module.roles.filter(v => v.assignable && v.content === content)"
			@trigger="$emit('toggle',r.id)"
			:caption="getCaptionForModule(r.captions['roleTitle'],r.name,module)"
			:captionTitle="getCaptionForModule(r.captions['roleDesc'],'',module)"
			:image="roleIds.includes(r.id) ? 'checkbox1.png' : 'checkbox0.png'"
			:naked="true"
		/>
	</td>`,
	props:{
		content:{ type:String, required:true }, // role content to filter by
		module: { type:Object, required:true }, // current module
		roleIds:{ type:Array,  required:true }  // already enabled roles by ID
	},
	emits:['toggle'],
	methods:{
		getCaptionForModule
	}
};

let MyAdminLoginsItem = {
	name:'my-admin-logins-item',
	components:{
		MyAdminLoginsItemRole,
		MyInputSelect
	},
	template:`<tbody>
		<tr class="default-inputs">
			<td>
				<div class="row">
					<my-button image="save.png"
						@trigger="set"
						:active="hasChanges && name !== ''"
						:caption="isNew ? capGen.button.create : ''"
						:captionTitle="isNew ? capGen.button.create : capGen.button.save"
					/>
					<my-button image="delete.png"
						v-if="!isNew"
						@trigger="delAsk"
						:cancel="true"
						:captionTitle="capGen.button.delete"
					/>
				</div>
			</td>
			<td>
				<input class="long"
					v-model="name"
					:disabled="ldapId !== null"
					:placeholder="isNew ? capApp.newLogin : ''"
				/>
			</td>
			<td>
				<my-bool
					v-model="noAuth"
					:readonly="!isNew && ldapId !== null"
				/>
			</td>
			<td>
				<select v-if="ldapId !== null" v-model="ldapId" disabled="disabled">
					<option :value="l.id" v-for="l in ldaps">LDAP: {{ l.name }}</option>
				</select>
				
				<input type="password"
					v-if="ldapId === null"
					v-model="pass"
					:disabled="noAuth"
					:placeholder="!noAuth ? capApp.passwordHint : capApp.passwordHintNoAuth"
				/>
			</td>
			<td><my-bool v-model="admin" /></td>
			<td><my-bool v-model="active" /></td>
			<td>
				<my-button
					@trigger="showRoles = !showRoles"
					:active="anyRoles && !isLdapAssignedRoles"
					:caption="String(roleTotalNonHidden)"
					:captionTitle="!isLdapAssignedRoles ? '' : capApp.ldapAssignActive"
					:image="showRoles ? 'triangleDown.png' : 'triangleRight.png'"
				/>
			</td>
			<td>
				<select class="short" v-model="languageCode">
					<option
						v-for="l in languageCodes"
						:value="l"
					>{{ l }}</option>
				</select>
			</td>
			<td><input class="short" disabled="disabled" :value="id" /></td>
			<td>
				<my-button image="warning.png"
					@trigger="resetTotpAsk"
					:active="!isNew && !noAuth"
					:cancel="true"
					:caption="capGen.button.reset"
				/>
			</td>
			<td></td>
			<td class="left-border" v-for="(lf,lfi) in loginForms">
				<div class="login-record" v-if="!isNew && !loginFormsHidden.includes(lfi)">
					<my-button
						@trigger="openLoginForm(lfi)"
						:captionTitle="login.records[lfi].id !== null ? capGen.button.edit : capGen.button.create"
						:image="login.records[lfi].id ? 'open.png' : 'add.png'"
					/>
					
					<div class="login-record-input">
					
						<input disabled="disabled"
							v-if="login.records[lfi].id !== null"
							:value="login.records[lfi].label"
						/>
						<my-input-select
							v-if="login.records[lfi].id === null"
							@request-data="getRecords(lfi)"
							@updated-text-input="loginRecordInput = $event"
							@update:selected="$emit('set-record',lfi,login.id,$event)"
							:nakedIcons="false"
							:options="loginRecordList"
							:placeholder="capApp.recordSelectHint"
						/>
						<my-button image="cancel.png"
							v-if="login.records[lfi].id !== null"
							@trigger="$emit('set-record',lfi,null,login.records[lfi].id)"
							:cancel="true"
						/>
					</div>
				</div>
			</td>
		</tr>
		
		<tr v-if="showRoles">
			<td colspan="999">
				<table class="table-default role-select shade">
					<thead>
						<tr>
							<th colspan="3">
								<div class="row">
									<my-button image="save.png"
										@trigger="set"
										:active="hasChanges"
										:caption="capGen.button.save"
									/>
									<my-button image="cancel.png"
										@trigger="showRoles = false"
										:cancel="true"
										:caption="capGen.button.close"
									/>
								</div>
							</th>
							<th class="minimum default-inputs">
								<input v-model="filter" class="app-filter" placeholder="..." />
							</th>
						</tr>
						<tr>
							<th>{{ capGen.application }}</th>
							<th class="role-content"><my-button @trigger="toggleRolesByContent('admin')" :caption="capApp.roleContentAdmin" :naked="true" /></th>
							<th class="role-content"><my-button @trigger="toggleRolesByContent('user')"  :caption="capApp.roleContentUser"  :naked="true" /></th>
							<th class="role-content"><my-button @trigger="toggleRolesByContent('other')" :caption="capApp.roleContentOther" :naked="true" /></th>
						</tr>
					</thead>
					<tbody>
						<tr
							v-for="m in modules.filter(v => getCaptionForModule(v.captions['moduleTitle'],v.name,v).includes(filter))"
							:class="{ grouping:m.parentId === null }"
							:key="m.id"
						>
							<td class="minimum">
								<div class="row centered">
									<my-button image="dash.png"
										v-if="m.parentId !== null"
										:active="false"
										:naked="true"
									/>
									<img class="module-icon"
										:src="srcBase64Icon(m.iconId,'images/module.png')"
									/>
									<span>
										{{ getCaptionForModule(m.captions['moduleTitle'],m.name,m) }}
									</span>
								</div>
							</td>
							
							<!-- roles to toggle -->
							<template v-if="!m.hidden">
								<my-admin-logins-item-role content="admin" @toggle="toggleRoleId($event)" :module="m" :roleIds="roleIds" />
								<my-admin-logins-item-role content="user"  @toggle="toggleRoleId($event)" :module="m" :roleIds="roleIds" />
								<my-admin-logins-item-role content="other" @toggle="toggleRoleId($event)" :module="m" :roleIds="roleIds" />
							</template>
						</tr>
					</tbody>
				</table>
			</td>
		</tr>
	</tbody>`,
	props:{
		ldaps:{ type:Array, required:true },
		login:{
			type:Object,
			required:false,
			default:function() { return{
				id:0,
				ldapId:null,
				ldapKey:null,
				name:'',
				languageCode:'',
				active:true,
				admin:false,
				noAuth:false,
				records:[],
				roleIds:[]
			}}
		},
		loginForms:      { type:Array, required:true },
		loginFormsHidden:{ type:Array, required:true }
	},
	watch:{
		login:{
			handler(v){
				this.id           = v.id;
				this.ldapId       = v.ldapId;
				this.ldapKey      = v.ldapKey;
				this.name         = v.name;
				this.languageCode = v.languageCode;
				this.active       = v.active;
				this.admin        = v.admin;
				this.noAuth       = v.noAuth;
				this.roleIds      = JSON.parse(JSON.stringify(v.roleIds));
				this.pass         = '';
			},
			immediate:true
		}
	},
	emits:['open-login-form','set-record','updated'],
	data:function() {
		return {
			id:0,
			ldapId:null,
			ldapKey:null,
			name:'',
			languageCode:'',
			active:false,
			admin:false,
			noAuth:false,
			roleIds:[],
			pass:'',
			
			// states
			filter:'',
			loginRecordInput:'',
			loginRecordList:[],
			showRoles:false
		};
	},
	computed:{
		anyRoles:(s) => {
			for(let m of s.modules) {
				if(m.roles.length !== 1)
					return true;
			}
			return false;
		},
		isLdapAssignedRoles:(s) => {
			if(s.ldapId === null)
				return false;
			
			for(let l of s.ldaps) {
				if(l.id === s.ldapId)
					return l.assignRoles;
			}
			return false;
		},
		hasChanges:(s) => s.name !== s.login.name
			|| (!s.isNew && s.languageCode !== s.login.languageCode)
			|| s.active !== s.login.active
			|| s.admin !== s.login.admin
			|| s.noAuth !== s.login.noAuth
			|| s.pass !== ''
			|| JSON.stringify([...s.roleIds].sort()) !== JSON.stringify([...s.login.roleIds].sort()),
		roleTotalNonHidden:(s) => {
			let cnt = 0;
			for(let roleId of s.roleIds) {
				if(!s.moduleIdMap[s.roleIdMap[roleId].moduleId].hidden)
					cnt++
			}
			return cnt;
		},
		
		// simple states
		isNew:(s) => s.login.id === 0,
		
		// stores
		languageCodes:(s) => s.$store.getters['schema/languageCodes'],
		modules:      (s) => s.$store.getters['schema/modules'],
		moduleIdMap:  (s) => s.$store.getters['schema/moduleIdMap'],
		formIdMap:    (s) => s.$store.getters['schema/formIdMap'],
		roleIdMap:    (s) => s.$store.getters['schema/roleIdMap'],
		capApp:       (s) => s.$store.getters.captions.admin.login,
		capGen:       (s) => s.$store.getters.captions.generic,
		config:       (s) => s.$store.getters.config
	},
	mounted() {
		if(this.languageCode === '')
			this.languageCode = this.config.defaultLanguageCode;
	},
	methods:{
		// externals
		getCaptionForModule,
		getValidLanguageCode,
		srcBase64Icon,
		
		// actions
		openLoginForm(index) {
			let frm = this.formIdMap[this.loginForms[index].formId];
			let mod = this.moduleIdMap[frm.moduleId];
			
			this.$store.commit('moduleLanguage',this.getValidLanguageCode(mod));
			this.$emit('open-login-form',index,this.id,this.login.records[index].id);
		},
		toggleRoleId(roleId) {
			let pos = this.roleIds.indexOf(roleId);
			
			if(pos === -1)      this.roleIds.push(roleId);
			else if(pos !== -1) this.roleIds.splice(pos,1);
		},
		toggleRolesByContent(content) {
			let roleIdsByContent = [];
			for(let i = 0, j = this.modules.length; i < j; i++) {
				for(let x = 0, y = this.modules[i].roles.length; x < y; x++) {
					let r = this.modules[i].roles[x];
					
					if(r.assignable && r.content === content)
						roleIdsByContent.push(r.id);
				}
			}
			
			// has all roles, remove all
			if(roleIdsByContent.length === this.roleIds.filter(v => roleIdsByContent.includes(v)).length) {
				for(let i = 0, j = roleIdsByContent.length; i < j; i++) {
					this.roleIds.splice(this.roleIds.indexOf(roleIdsByContent[i]),1);
				}
				return;
			}
			
			// does not have all roles, add missing
			for(let i = 0, j = roleIdsByContent.length; i < j; i++) {
				if(!this.roleIds.includes(roleIdsByContent[i]))
					this.roleIds.push(roleIdsByContent[i]);
			}
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
			ws.send('login','del',{id:this.login.id},true).then(
				() => {
					this.$emit('updated');
					ws.send('login','kick',{id:this.login.id},true).then(
						() => {},
						this.$root.genericError
					);
				},
				this.$root.genericError
			);
		},
		set() {
			ws.send('login','set',{
				id:this.login.id,
				ldapId:this.login.ldapId,
				ldapKey:this.login.ldapKey,
				name:this.name,
				pass:this.pass,
				languageCode:this.languageCode,
				active:this.active,
				admin:this.admin,
				noAuth:this.noAuth,
				roleIds:this.roleIds
			},true).then(
				() => {
					if(this.isNew) {
						this.name      = '';
						this.showRoles = false;
					}
					this.pass = '';
					this.$emit('updated');
					
					if(this.login.id === 0)
						return;
					
					// login was changed, reauth. or kick client
					let action = this.active ? 'reauth' : 'kick';
					ws.send('login',action,{id:this.login.id},false).then(
						() => {},
						this.$root.genericError
					);
				},
				this.$root.genericError
			);
		},
		
		// MFA calls
		resetTotpAsk() {
			this.$store.commit('dialog',{
				captionBody:this.capApp.dialog.resetTotp,
				image:'warning.png',
				buttons:[{
					cancel:true,
					caption:this.capGen.button.reset,
					exec:this.resetTotp,
					keyEnter:true,
					image:'refresh.png'
				},{
					caption:this.capGen.button.cancel,
					keyEscape:true,
					image:'cancel.png'
				}]
			});
		},
		resetTotp(loginId) {
			ws.send('login','resetTotp',{id:this.id},true).then(
				res => {},this.$root.genericError
			);
		},
		
		// record calls
		getRecords(loginFormIndex) {
			let loginForm  = this.loginForms[loginFormIndex];
			let excludeIds = [];
			
			if(this.login.records[loginFormIndex].id !== null)
				excludeIds.push(this.login.records[loginFormIndex].id);
			
			ws.send('login','getRecords',{
				attributeIdLookup:loginForm.attributeIdLookup,
				byString:this.loginRecordInput,
				idsExclude:excludeIds
			},true).then(
				res => this.loginRecordList = res.payload,
				this.$root.genericError
			);
		}
	}
};

let MyAdminLogins = {
	name:'my-admin-logins',
	components:{
		MyAdminLoginsItem,
		MyForm,
		MyInputOffset
	},
	template:`<div class="admin-logins contentBox grow">
		
		<div class="top">
			<div class="area">
				<img class="icon" src="images/admin.png" />
				<h1>{{ menuTitle }}</h1>
			</div>
		</div>
		<div class="top lower">
			<div class="area">
				<my-button image="refresh.png"
					@trigger="get"
					:caption="capGen.button.refresh"
				/>
			</div>
			<div class="area default-inputs">
				<my-input-offset class-input="selector"
					@input="offsetSet"
					:caption="true"
					:limit="limit"
					:offset="offset"
					:total="total"
				/>
			</div>
			<div class="area nowrap default-inputs">
				<my-button
					@trigger="limitSet(20)"
					:caption="capGen.limit"
					:naked="true"
				/>
				<select class="short selector"
					@change="limitSet($event.target.value)"
					:value="limit"
				>
					<option :value="20">{{ 20 }}</option>
					<option :value="30">{{ 30 }}</option>
					<option :value="50">{{ 50 }}</option>
					<option :value="100">{{ 100 }}</option>
					<option :value="200">{{ 200 }}</option>
					<option :value="500">{{ 500 }}</option>
				</select>
				<input class="selector"
					v-model="byString"
					@keyup.enter.space="byStringSet"
					:placeholder="capGen.username"
				/>
			</div>
		</div>
		
		<div class="content no-padding grow">
			<table class="table-default">
				<thead>
					<tr>
						<th class="minimum">
							<div class="mixed-header">
								<img src="images/ok.png" />
								<span>{{ capGen.actions }}</span>
							</div>
						</th>
						<th>
							<div class="mixed-header">
								<img src="images/person.png" />
								<span>{{ capGen.username }}</span>
							</div>
						</th>
						<th class="minimum" :title="capApp.noAuthHint">
							<div class="mixed-header">
								<img src="images/warning.png" />
								<span>{{ capApp.noAuth }}</span>
							</div>
						</th>
						<th>
							<div class="mixed-header">
								<img src="images/key.png" />
								<span>{{ capApp.authentication }}</span>
							</div>
						</th>
						<th class="minimum" :title="capApp.adminHint">
							<div class="mixed-header">
								<img src="images/settings.png" />
								<span>{{ capApp.admin }}</span>
							</div>
						</th>
						<th class="minimum">
							<div class="mixed-header">
								<img src="images/remove.png" />
								<span>{{ capGen.active }}</span>
							</div>
						</th>
						<th class="minimum">
							<div class="mixed-header">
								<img src="images/admin.png" />
								<span>{{ capApp.roles }}</span>
							</div>
						</th>
						<th>
							<div class="mixed-header">
								<img src="images/languages.png" />
								<span>{{ capApp.language }}</span>
							</div>
						</th>
						<th>
							<div class="mixed-header">
								<img src="images/form.png" />
								<span>{{ capGen.id }}</span>
							</div>
						</th>
						<th class="minimum" :title="capApp.mfaHint">
							<div class="mixed-header">
								<img src="images/smartphone.png" />
								<span>{{ capApp.mfa }}</span>
							</div>
						</th>
						<th class="gab"></th>
						<th class="left-border" v-for="(lf,lfi) in loginForms">
							<div class="mixed-header">
								<img class="clickable"
									@click="toggleLoginForms(lfi)"
									:src="loginFormsHidden.includes(lfi) ? 'images/triangleRight.png' : 'images/triangleDown.png'"
								/>
								<my-button
									@trigger="toggleLoginForms(lfi)"
									:caption="loginFormsHidden.includes(lfi) ? '' : getCaptionForModule(lf.captions['loginFormTitle'],lf.name,moduleIdMap[lf.moduleId])"
									:imageBase64="srcBase64Icon(moduleIdMap[lf.moduleId].iconId,'images/module.png')"
									:naked="true"
								/>
							</div>
						</th>
					</tr>
				</thead>
				
				<!-- login form -->
				<div class="app-sub-window under-header"
					v-if="loginFormIndexOpen !== null"
					@mousedown.self="$refs.popUpForm.closeAsk()"
				>
					<my-form ref="popUpForm"
						@close="loginFormIndexOpen = null"
						@record-updated="setRecord(loginFormIndexOpen,loginFormLogin,$event);loginFormIndexOpen = null"
						:allowDel="false"
						:allowNew="false"
						:formId="loginForms[loginFormIndexOpen].formId"
						:isPopUp="true"
						:moduleId="formIdMap[loginForms[loginFormIndexOpen].formId].moduleId"
						:recordId="loginFormRecord"
					/>
				</div>
				
				<!-- new login -->
				<my-admin-logins-item
					@updated="get"
					:key="0"
					:ldaps="ldaps"
					:loginForms="loginForms"
					:loginFormsHidden="loginFormsHidden"
				/>
				
				<!-- existing logins -->
				<my-admin-logins-item
					v-for="l in logins"
					@open-login-form="openLoginForm"
					@set-record="setRecord"
					@updated="get"
					:key="l.id"
					:ldaps="ldaps"
					:login="l"
					:loginForms="loginForms"
					:loginFormsHidden="loginFormsHidden"
				/>
			</table>
		</div>
	</div>`,
	props:{
		menuTitle:{ type:String, required:true }
	},
	data:function() {
		return {
			logins:[],
			ldaps:[],
			total:0,
			
			// login form
			loginFormIndexOpen:null,
			loginFormLogin:null,
			loginFormRecord:null,
			
			// state
			byString:'',
			limit:30,
			offset:0,
			loginFormsHidden:[]
		};
	},
	computed:{
		loginForms:(s) => {
			let out = [];
			for(let i = 0, j = s.modules.length; i < j; i++) {
				for(let x = 0, y = s.modules[i].loginForms.length; x < y; x++) {
					out.push(s.modules[i].loginForms[x]);
				}
			}
			return out;
		},
		
		// stores
		modules:    (s) => s.$store.getters['schema/modules'],
		moduleIdMap:(s) => s.$store.getters['schema/moduleIdMap'],
		formIdMap:  (s) => s.$store.getters['schema/formIdMap'],
		capApp:     (s) => s.$store.getters.captions.admin.login,
		capGen:     (s) => s.$store.getters.captions.generic
	},
	mounted() {
		this.get();
		this.getLdaps();
		this.$store.commit('pageTitle',this.menuTitle);
	},
	methods:{
		// externals
		getCaptionForModule,
		srcBase64Icon,
		
		byStringSet() {
			this.offset = 0;
			this.get();
		},
		limitSet(newLimit) {
			this.limit  = parseInt(newLimit);
			this.offset = 0;
			this.get();
		},
		offsetSet(newOffset) {
			this.offset = newOffset;
			this.get();
		},
		openLoginForm(index,loginId,recordId) {
			this.loginFormIndexOpen = index;
			this.loginFormLogin     = loginId;
			this.loginFormRecord    = recordId !== null ? recordId : 0;
		},
		toggleLoginForms(index) {
			let pos = this.loginFormsHidden.indexOf(index);
			
			if(pos === -1)
				return this.loginFormsHidden.push(index);
			
			this.loginFormsHidden.splice(pos,1);
		},
		
		// backend calls
		get() {
			let forms = [];
			for(let i = 0, j = this.loginForms.length; i < j; i++) {
				forms.push({
					attributeIdLogin:this.loginForms[i].attributeIdLogin,
					attributeIdLookup:this.loginForms[i].attributeIdLookup
				});
			}
			
			ws.send('login','get',{
				byString:this.byString,
				limit:this.limit,
				offset:this.offset,
				recordRequests:forms
			},true).then(
				res => {
					this.logins = res.payload.logins;
					this.total  = res.payload.total;
				},
				this.$root.genericError
			);
		},
		getLdaps() {
			ws.send('ldap','get',{},true).then(
				res => this.ldaps = res.payload.ldaps,
				this.$root.genericError
			);
		},
		setRecord(index,loginId,recordId) {
			ws.send('login','setRecord',{
				attributeIdLogin:this.loginForms[index].attributeIdLogin,
				loginId:loginId,
				recordId:recordId
			},true).then(
				() => {
					this.get();
					
					// reauth login to update collections (can be dependent on assigned record)
					ws.send('login','reauth',{id:loginId},false).then(
						() => {}, this.$root.genericError
					);
				},
				this.$root.genericError
			);
		}
	}
};