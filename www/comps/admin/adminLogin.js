import MyForm        from '../form.js';
import MyTabs        from '../tabs.js';
import MyInputSelect from '../inputSelect.js';
import srcBase64Icon from '../shared/image.js';
import {
	getCaptionForModule,
	getValidLanguageCode
} from '../shared/language.js';
export {MyAdminLogin as default};

let MyAdminLoginRole = {
	name:'my-admin-login-role',
	template:`<td class="minimum role-content">
		<my-button
			v-for="r in module.roles.filter(v => v.assignable && v.content === content)"
			@trigger="$emit('toggle',r.id)"
			:active="!readonly"
			:caption="getCaptionForModule(r.captions['roleTitle'],r.name,module)"
			:captionTitle="getCaptionForModule(r.captions['roleDesc'],'',module)"
			:image="roleIds.includes(r.id) ? 'checkbox1.png' : 'checkbox0.png'"
			:naked="true"
		/>
	</td>`,
	props:{
		content: { type:String,  required:true }, // role content to filter by
		module:  { type:Object,  required:true }, // current module
		readonly:{ type:Boolean, required:true },
		roleIds: { type:Array,   required:true }  // already enabled roles by ID
	},
	emits:['toggle'],
	methods:{
		getCaptionForModule
	}
};

let MyAdminLogin = {
	name:'my-admin-login',
	components:{
		MyAdminLoginRole,
		MyForm,
		MyInputSelect,
		MyTabs
	},
	template:`<div class="app-sub-window under-header at-top with-margin" @mousedown.self="$emit('close')">
		
		<!-- login record form -->
		<div class="app-sub-window under-header"
			v-if="isFormOpen"
			@mousedown.self="$refs.popUpForm.closeAsk()"
		>
			<my-form ref="popUpForm"
				@close="loginFormIndexOpen = null"
				@record-updated="updateLoginRecord(loginFormIndexOpen,$event,true);loginFormIndexOpen = null"
				:allowDel="false"
				:allowNew="false"
				:formId="loginForms[loginFormIndexOpen].formId"
				:isPopUp="true"
				:isPopUpFloating="true"
				:moduleId="formIdMap[loginForms[loginFormIndexOpen].formId].moduleId"
				:recordIds="loginFormRecords"
			/>
		</div>
		
		<div class="contentBox admin-login float" v-if="inputsReady">
			<div class="top">
				<div class="area nowrap">
					<img class="icon" src="images/person.png" />
					<h1 class="title">{{ isNew ? capApp.titleNew : capApp.title.replace('{NAME}',name) }}</h1>
				</div>
				<div class="area">
					<my-button image="cancel.png"
						@trigger="$emit('close')"
						:cancel="true"
					/>
				</div>
			</div>
			<div class="top lower">
				<div class="area">
					<my-button image="save.png"
						@trigger="set"
						:active="canSave"
						:caption="isNew ? capGen.button.create : capGen.button.save"
					/>
					<my-button image="refresh.png"
						v-if="!isNew"
						@trigger="get"
						:active="hasChanges"
						:caption="capGen.button.refresh"
					/>
					<my-button image="add.png"
						v-if="!isNew"
						@trigger="id = 0"
						:active="!isLdap"
						:caption="capGen.button.new"
					/>
					<my-button image="warning.png"
						v-if="!isNew"
						@trigger="resetTotpAsk"
						:active="!noAuth"
						:cancel="true"
						:caption="capApp.button.resetMfa"
					/>
					<my-button image="delete.png"
						v-if="!isNew"
						@trigger="delAsk"
						:cancel="true"
						:caption="capGen.button.delete"
					/>
				</div>
			</div>
			
			<my-tabs
				v-model="tabTarget"
				:entries="['properties','roles']"
				:entriesText="[capGen.properties,capApp.roles.replace('{COUNT}',roleTotalNonHidden)]"
			/>
			
			<div class="content default-inputs" :class="{ 'no-padding':tabTarget === 'roles' }">
				<table class="table-default generic-table-vertical fullWidth" v-if="tabTarget === 'properties'">
					<tr>
						<td>
							<div class="title-cell">
								<img src="images/person.png" />
								<span>{{ capGen.name }}</span>
							</div>
						</td>
						<td><input v-model="name" v-focus :disabled="isLdap" /></td>
						<td>{{ capApp.hint.name }}</td>
					</tr>
					<tr>
						<td>
							<div class="title-cell">
								<img src="images/personCog.png" />
								<span>{{ capApp.admin }}</span>
							</div>
						</td>
						<td><my-bool v-model="admin" /></td>
						<td>{{ capApp.hint.admin }}</td>
					</tr>
					
					<!-- login records -->
					<tr v-for="(lf,lfi) in loginForms">
						<td>
							<div class="title-cell">
								<img :src="srcBase64Icon(moduleIdMap[lf.moduleId].iconId,'images/module.png')" />
								<span>{{ getCaptionForModule(lf.captions['loginFormTitle'],lf.name,moduleIdMap[lf.moduleId]) }}</span>
							</div>
						</td>
						<td colspan="2" class="login-record row gap">
							<my-button
								@trigger="openLoginForm(lfi)"
								:captionTitle="records[lfi].id !== null ? capGen.button.edit : capGen.button.create"
								:image="records[lfi].id ? 'open.png' : 'add.png'"
							/>
							<div class="login-record-input row gap">
								<input disabled="disabled"
									v-if="records[lfi].id !== null"
									:value="records[lfi].label"
								/>
								<my-input-select
									v-if="records[lfi].id === null"
									@request-data="getRecords(lfi)"
									@updated-text-input="recordInput = $event"
									@update:selected="updateLoginRecord(lfi,$event,true)"
									:nakedIcons="false"
									:options="recordList"
									:placeholder="capGen.threeDots"
								/>
								<my-button image="cancel.png"
									v-if="records[lfi].id !== null"
									@trigger="updateLoginRecord(lfi,records[lfi].id,false)"
									:cancel="true"
								/>
							</div>
						</td>
						<td></td>
					</tr>
					
					<tr>
						<td>
							<div class="title-cell">
								<img src="images/remove.png" />
								<span>{{ capGen.active }}</span>
							</div>
						</td>
						<td><my-bool v-model="active" /></td>
						<td>{{ capApp.hint.active }}</td>
					</tr>
					<tr>
						<td>
							<div class="title-cell">
								<img src="images/globe.png" />
								<span>{{ capApp.noAuth }}</span>
							</div>
						</td>
						<td><my-bool v-model="noAuth" :readonly="isLdap" /></td>
						<td>{{ capApp.hint.noAuth }}</td>
					</tr>
					<tr v-if="isNew">
						<td>
							<div class="title-cell">
								<img src="images/personTemplate.png" />
								<span>{{ capApp.template }}</span>
							</div>
						</td>
						<td>
							<select v-model="templateId">
								<option v-for="t in templates" :title="t.comment" :value="t.id">
									{{ t.name }}
								</option>
							</select>
						</td>
						<td>{{ capApp.hint.template }}</td>
					</tr>
					<tr v-if="!isLdap">
						<td>
							<div class="title-cell">
								<img src="images/lock.png" />
								<span>{{ capApp.password }}</span>
							</div>
						</td>
						<td><input v-model="pass" :placeholder="capGen.threeDots" /></td>
						<td>{{ capApp.hint.password }}</td>
					</tr>
					<tr v-if="isLdap">
						<td>
							<div class="title-cell">
								<img src="images/hierarchy.png" />
								<span>{{ capApp.ldap }}</span>
							</div>
						</td>
						<td>
							<select v-model="ldapId" disabled="disabled">
								<option :value="l.id" v-for="l in ldaps">{{ l.name }}</option>
							</select>
						</td>
						<td></td>
					</tr>
				</table>
				
				<!-- roles -->
				<table class="table-default role-select" v-if="tabTarget === 'roles'">
					<thead>
						<tr>
							<th v-if="isLdapAssignedRoles" colspan="4"><b>{{ capApp.ldapAssignActive }}</b></th>
						</tr>
						<tr>
							<th class="minimum">
								<div class="row centered gap space-between">
									<span>{{ capGen.application }}</span>
									<input class="short" placeholder="..." v-model="roleFilter" :title="capGen.button.filter" />
								</div>
							</th>
							<th><my-button @trigger="toggleRolesByContent('admin')" :active="!isLdapAssignedRoles" :caption="capApp.roleContentAdmin" :naked="true" /></th>
							<th><my-button @trigger="toggleRolesByContent('user')"  :active="!isLdapAssignedRoles" :caption="capApp.roleContentUser"  :naked="true" /></th>
							<th><my-button @trigger="toggleRolesByContent('other')" :active="!isLdapAssignedRoles" :caption="capApp.roleContentOther" :naked="true" /></th>
						</tr>
					</thead>
					<tbody>
						<tr
							v-for="m in modulesFiltered"
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
							<my-admin-login-role content="admin" @toggle="toggleRoleId($event)" :module="m" :readonly="isLdapAssignedRoles" :roleIds="roleIds" />
							<my-admin-login-role content="user"  @toggle="toggleRoleId($event)" :module="m" :readonly="isLdapAssignedRoles" :roleIds="roleIds" />
							<my-admin-login-role content="other" @toggle="toggleRoleId($event)" :module="m" :readonly="isLdapAssignedRoles" :roleIds="roleIds" />
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>`,
	props:{
		ldaps:           { type:Array,  required:true },
		loginId:         { type:Number, required:true }, // login ID from parent, 0 if new
		loginForms:      { type:Array,  required:true },
		loginFormLookups:{ type:Array,  required:true }
	},
	emits:['close'],
	data() {
		return {
			// inputs
			id:0,
			ldapId:null,
			ldapKey:null,
			name:'',
			active:true,
			admin:false,
			pass:'',
			noAuth:false,
			records:[],
			roleIds:[],
			templateId:null,
			
			// states
			inputKeys:['name','active','admin','pass','noAuth','records','roleIds'],
			inputsOrg:{},      // map of original input values, key = input key
			inputsReady:false, // inputs have been loaded
			recordInput:'',    // record lookup input
			recordList:[],     // record lookup dropdown values
			roleFilter:'',     // filter for role selection
			tabTarget:'properties',
			templates:[],      // login templates
			
			// login form
			loginFormIndexOpen:null,
			loginFormRecords:null
		};
	},
	computed:{
		hasChanges:(s) => {
			if(!s.inputsReady)
				return false;
			
			for(let k of s.inputKeys) {
				if(JSON.stringify(s.inputsOrg[k]) !== JSON.stringify(s[k]))
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
		roleTotalNonHidden:(s) => {
			let cnt = 0;
			for(let roleId of s.roleIds) {
				if(!s.moduleIdMapOptions[s.roleIdMap[roleId].moduleId].hidden)
					cnt++
			}
			return cnt;
		},
		modulesFiltered:(s) => s.modules.filter(v => !s.moduleIdMapOptions[v.id].hidden &&
			(s.roleFilter === '' || 	s.getCaptionForModule(v.captions['moduleTitle'],v.name,v).toLowerCase().includes(s.roleFilter.toLowerCase()))),
		
		// simple states
		canSave:   (s) => s.hasChanges && s.name !== '',
		isFormOpen:(s) => s.loginFormIndexOpen !== null,
		isLdap:    (s) => s.ldapId !== null,
		isNew:     (s) => s.id     === 0,
		
		// stores
		modules:           (s) => s.$store.getters['schema/modules'],
		moduleIdMap:       (s) => s.$store.getters['schema/moduleIdMap'],
		moduleIdMapOptions:(s) => s.$store.getters['schema/moduleIdMapOptions'],
		formIdMap:         (s) => s.$store.getters['schema/formIdMap'],
		roleIdMap:         (s) => s.$store.getters['schema/roleIdMap'],
		capApp:            (s) => s.$store.getters.captions.admin.login,
		capGen:            (s) => s.$store.getters.captions.generic
	},
	mounted() {
		window.addEventListener('keydown',this.handleHotkeys);
		this.id = this.loginId;
		this.getTemplates();
		
		// existing login, get values
		if(this.id !== 0)
			return this.get();
		
		// new login, set defaults
		for(let lf of this.loginForms) {
			this.records.push({id:null,label:''});
		}
		this.inputsLoaded();
	},
	unmounted() {
		window.removeEventListener('keydown',this.handleHotkeys);
	},
	methods:{
		// externals
		getCaptionForModule,
		getValidLanguageCode,
		srcBase64Icon,
		
		handleHotkeys(e) {
			if(e.ctrlKey && e.key === 's') {
				if(this.canSave)
					this.set();
				
				e.preventDefault();
			}
			if(e.key === 'Escape' && !this.isFormOpen) {
				this.$emit('close');
				e.preventDefault();
			}
		},
		inputsLoaded() {
			for(let k of this.inputKeys) {
				this.inputsOrg[k] = JSON.parse(JSON.stringify(this[k]));
			}
			this.inputsReady = true;
		},
		
		// actions
		openLoginForm(index) {
			let frm = this.formIdMap[this.loginForms[index].formId];
			let mod = this.moduleIdMap[frm.moduleId];
			
			this.$store.commit('moduleLanguage',this.getValidLanguageCode(mod));
			
			this.loginFormIndexOpen = index;
			this.loginFormRecords   = this.records[index].id !== null
				? [this.records[index].id] : [];
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
		updateLoginRecord(loginFormIndex,recordId,add) {
			this.recordInput = '';
			this.records[loginFormIndex].id = add ? recordId : null;
			
			if(add)
				this.getRecords(loginFormIndex);
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
			ws.send('login','del',{id:this.id},true).then(
				() => {
					ws.send('login','kick',{id:this.id},true).then(
						() => this.$emit('close'),
						this.$root.genericError
					);
				},
				this.$root.genericError
			);
		},
		get() {
			ws.send('login','get',{
				byId:this.id,
				recordRequests:this.loginFormLookups
			},true).then(
				res => {
					if(res.payload.logins.length !== 1) return;
					
					let login = res.payload.logins[0];
					this.ldapId  = login.ldapId;
					this.ldapKey = login.ldapKey;
					this.name    = login.name;
					this.active  = login.active;
					this.admin   = login.admin;
					this.noAuth  = login.noAuth;
					this.records = login.records;
					this.roleIds = login.roleIds;
					this.pass    = '';
					this.inputsLoaded();
				},
				this.$root.genericError
			);
		},
		getRecords(loginFormIndex) {
			this.recordList = [];
			let isIdLookup = this.records[loginFormIndex].id !== null;
			
			ws.send('login','getRecords',{
				attributeIdLookup:this.loginForms[loginFormIndex].attributeIdLookup,
				byId:isIdLookup ? this.records[loginFormIndex].id : 0,
				byString:isIdLookup ? '' : this.recordInput
			},true).then(
				res => {
					if(!isIdLookup)
						return this.recordList = res.payload;
					
					if(res.payload.length === 1)
						this.records[loginFormIndex].label = res.payload[0].name;
				},
				this.$root.genericError
			);
		},
		getTemplates() {
			ws.send('loginTemplate','get',{byId:0},true).then(
				res => {
					this.templates = res.payload;
					
					// apply global template if empty
					if(this.templateId === null && this.templates.length > 0)
						this.templateId = this.templates[0].id;
				},
				this.$root.genericError
			);
		},
		set() {
			let records = [];
			for(let i = 0, j = this.loginForms.length; i < j; i++) {
				records.push({
					attributeId:this.loginForms[i].attributeIdLogin,
					recordId:this.records[i].id
				});
			}
			
			ws.send('login','set',{
				id:this.id,
				ldapId:this.ldapId,
				ldapKey:this.ldapKey,
				name:this.name,
				pass:this.pass,
				active:this.active,
				admin:this.admin,
				noAuth:this.noAuth,
				roleIds:this.roleIds,
				records:records,
				templateId:this.templateId
			},true).then(
				res => {
					// if login was changed, reauth. or kick client
					if(!this.isNew)
						ws.send('login',this.active ? 'reauth' : 'kick',{id:this.id},false);
					
					if(this.isNew)
						this.id = res.payload;
					
					this.get();
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
		resetTotp() {
			ws.send('login','resetTotp',{id:this.id},true).then(
				res => {},this.$root.genericError
			);
		}
	}
};