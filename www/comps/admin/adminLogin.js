import MyAdminLoginMeta from './adminLoginMeta.js';
import MyForm           from '../form.js';
import MyTabs           from '../tabs.js';
import MyInputSelect    from '../inputSelect.js';
import {getLoginIcon}   from '../shared/admin.js';
import {dialogCloseAsk} from '../shared/dialog.js';
import {deepIsEqual}    from '../shared/generic.js';
import srcBase64Icon    from '../shared/image.js';
import {getCaption}     from '../shared/language.js';
export {MyAdminLogin as default};

const MyAdminLoginRole = {
	name:'my-admin-login-role',
	template:`<td class="minimum role-content">
		<div class="row wrap gap">
			<my-button
				v-for="r in module.roles.filter(v => v.assignable && v.content === content)"
				@trigger="$emit('toggle',r.id)"
				:active="!readonly"
				:caption="getCaption('roleTitle',module.id,r.id,r.captions,r.name)"
				:captionTitle="getCaption('roleDesc',module.id,r.id,r.captions)"
				:image="roleIds.includes(r.id) ? 'checkbox1.png' : 'checkbox0.png'"
				:naked="true"
			/>
		</div>
	</td>`,
	props:{
		content: { type:String,  required:true }, // role content to filter by
		module:  { type:Object,  required:true }, // current module
		readonly:{ type:Boolean, required:true },
		roleIds: { type:Array,   required:true }  // already enabled roles by ID
	},
	emits:['toggle'],
	methods:{
		getCaption
	}
};

const MyAdminLogin = {
	name:'my-admin-login',
	components:{
		MyAdminLoginMeta,
		MyAdminLoginRole,
		MyForm,
		MyInputSelect,
		MyTabs
	},
	template:`<div class="app-sub-window under-header at-top with-margin" @mousedown.self="closeAsk">
		
		<!-- login record form -->
		<div class="app-sub-window under-header"
			v-if="isFormOpen"
			@mousedown.self="$refs.popUpForm.closeAsk()"
		>
			<my-form ref="popUpForm"
				@close="loginFormIndexOpen = null"
				@record-updated="updateLoginRecord(loginFormIndexOpen,$event);loginFormIndexOpen = null"
				:formId="loginForms[loginFormIndexOpen].formId"
				:isPopUp="true"
				:isPopUpFloating="true"
				:moduleId="formIdMap[loginForms[loginFormIndexOpen].formId].moduleId"
				:recordIds="loginFormRecords"
				:showButtonDel="false"
				:showButtonNew="false"
			/>
		</div>
		
		<div class="contentBox admin-login float" v-if="ready">
			<div class="top">
				<div class="area nowrap">
					<img class="icon" :src="getLoginIcon(inputs.active,inputs.admin,isLimited,inputs.noAuth)" />
					<h1 class="title" v-if="!isNew && isLimited">{{ capApp.titleLimited.replace('{NAME}',inputs.name) }}</h1>
					<h1 class="title" v-else>{{ isNew ? capApp.titleNew : capApp.title.replace('{NAME}',inputs.name) }}</h1>
				</div>
				<div class="area">
					<my-button image="cancel.png"
						@trigger="closeAsk"
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
						:active="isChanged"
						:caption="capGen.button.refresh"
					/>
					<my-button image="add.png"
						v-if="!isNew"
						@trigger="reset(false)"
						:caption="capGen.button.new"
					/>
				</div>
				<div class="area">
					<my-button image="warning.png"
						v-if="!isNew"
						@trigger="resetTotpAsk"
						:active="!inputs.noAuth && !isOauth"
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
			
			<div class="content no-padding">
				<table class="generic-table-vertical w1200">
					<tbody>
						<tr>
							<td>
								<div class="title-cell">
									<img src="images/person.png" />
									<span>{{ capGen.name }}</span>
								</div>
							</td>
							<td class="default-inputs">
								<div class="column gap">
									<input v-model="inputs.name" v-focus @keyup="typedUniqueField('name',inputs.name)" :disabled="!isAuthR3" />
									<div v-if="notUniqueName && inputs.name !== ''" class="message error">
										{{ capApp.dialog.notUniqueName }}
									</div>
								</div>
							</td>
							<td>{{ capApp.hint.name }}</td>
						</tr>
						<tr v-if="isNew">
							<td>
								<div class="title-cell">
									<img src="images/personTemplate.png" />
									<span>{{ capGen.loginTemplate }}</span>
								</div>
							</td>
							<td class="default-inputs">
								<select v-model="templateId">
									<option v-for="t in templates" :title="t.comment" :value="t.id">
										{{ t.name }}
									</option>
								</select>
							</td>
							<td>{{ capGen.loginTemplateHint }}</td>
						</tr>
						<tr v-if="!isAuthR3">
							<td>
								<div v-if="isLdap" class="title-cell">
									<img src="images/hierarchy.png" />
									<span>{{ capApp.ldap }}</span>
								</div>
								<div v-if="isOauth" class="title-cell">
									<img src="images/lockCog.png" />
									<span>{{ capApp.oauth }}</span>
								</div>
							</td>
							<td class="default-inputs">
								<select v-if="isLdap" v-model="inputs.ldapId" disabled="disabled">
									<option :value="l.id" v-for="l in ldaps">{{ l.name }}</option>
								</select>
								<select v-if="isOauth" v-model="inputs.oauthClientId" disabled="disabled">
									<option :value="c.id" v-for="c in oauthClients">{{ c.name }}</option>
								</select>
							</td>
							<td></td>
						</tr>
					</tbody>
				</table>

				<div class="login-details">
					<my-tabs class="login-details-tabs"
						v-model="tabTarget"
						:entries="['meta','roles','properties']"
						:entriesIcon="['images/editBox.png','images/personMultiple.png','images/personCog.png']"
						:entriesText="[capGen.details,capApp.roles.replace('{COUNT}',roleTotalNonHidden),capGen.properties]"
					/>
					<div class="login-details-content" :class="{ roles:tabTarget === 'roles' }">

						<!-- meta data -->
						<template v-if="tabTarget === 'meta'">
							<span class="login-details-content-message" v-if="isLdap"><b>{{ capApp.ldapMeta }}</b></span>
							<span class="login-details-content-message" v-if="isOauth"><b>{{ capApp.oauthMeta }}</b></span>
							<my-admin-login-meta
								@input-in-unique-field="typedUniqueField"
								v-model="inputs.meta"
								:notUniqueEmail="notUniqueEmail"
								:readonly="!isAuthR3"
							/>
						</template>
						
						<!-- roles -->
						<table class="generic-table sticky-top bright" v-if="tabTarget === 'roles'">
							<thead>
								<tr v-if="isLdapAssignedRoles">
									<th colspan="4"><b>{{ capApp.ldapAssignActive }}</b></th>
								</tr>
								<tr v-if="isOauthClientAssignedRoles">
									<th colspan="4"><b>{{ capApp.oauthAssignActive }}</b></th>
								</tr>
								<tr>
									<th class="minimum">
										<div class="row centered gap space-between default-inputs">
											<span>{{ capGen.application }}</span>
											<input class="short" placeholder="..." v-model="roleFilter" :title="capGen.button.filter" />
										</div>
									</th>
									<th><my-button image="ok.png" @trigger="toggleRolesByContent('admin')" :active="!isExtRole" :caption="capApp.roleContentAdmin" :naked="true" /></th>
									<th><my-button image="ok.png" @trigger="toggleRolesByContent('user')"  :active="!isExtRole" :caption="capApp.roleContentUser"  :naked="true" /></th>
									<th><my-button image="ok.png" @trigger="toggleRolesByContent('other')" :active="!isExtRole" :caption="capApp.roleContentOther" :naked="true" /></th>
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
											<img class="module-icon" :src="srcBase64Icon(m.iconId,'images/module.png')" />
											<span>{{ getCaption('moduleTitle',m.id,m.id,m.captions,m.name) }}</span>
										</div>
									</td>
									
									<!-- roles to toggle -->
									<my-admin-login-role content="admin" @toggle="toggleRoleId($event)" :module="m" :readonly="isExtRole" :roleIds="inputs.roleIds" />
									<my-admin-login-role content="user"  @toggle="toggleRoleId($event)" :module="m" :readonly="isExtRole" :roleIds="inputs.roleIds" />
									<my-admin-login-role content="other" @toggle="toggleRoleId($event)" :module="m" :readonly="isExtRole" :roleIds="inputs.roleIds" />
								</tr>
							</tbody>
						</table>

						<!-- properties -->
						<table class="generic-table-vertical w1200" v-if="tabTarget === 'properties'">
							<tbody>
								<tr>
									<td>
										<div class="title-cell">
											<img src="images/personCog.png" />
											<span>{{ capApp.admin }}</span>
										</div>
									</td>
									<td><my-bool v-model="inputs.admin" /></td>
									<td>{{ capApp.hint.admin }}</td>
								</tr>
								
								<!-- login records -->
								<tr v-for="(lf,lfi) in loginForms">
									<td>
										<div class="title-cell">
											<img :src="srcBase64Icon(moduleIdMap[lf.moduleId].iconId,'images/module.png')" />
											<span>{{ getCaption('loginFormTitle',lf.moduleId,lf.id,lf.captions,lf.name) }}</span>
										</div>
									</td>
									<td>
										<div class="field login-details-login-form-input">
											<div class="field-content data intent" :class="{ dropdown:loginFormIndexesDropdown.includes(lfi) }">
												<my-input-select
													@dropdown-show="openLoginFormDropdown(lfi,$event)"
													@open="openLoginForm(lfi)"
													@request-data="getRecords(lfi)"
													@updated-text-input="recordInput = $event"
													@update:selected="updateLoginRecord(lfi,$event)"
													:dropdownShow="loginFormIndexesDropdown.includes(lfi)"
													:nakedIcons="true"
													:options="recordList"
													:placeholder="capGen.threeDots"
													:selected="inputs.records[lfi].id"
													:showOpen="true"
													:inputTextSet="inputs.records[lfi].label"
												/>
											</div>
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
									<td><my-bool v-model="inputs.active" /></td>
									<td>{{ capApp.hint.active }}</td>
								</tr>
								<tr>
									<td>
										<div class="title-cell">
											<img src="images/globe.png" />
											<span>{{ capApp.noAuth }}</span>
										</div>
									</td>
									<td><my-bool v-model="inputs.noAuth" :readonly="!isAuthR3" /></td>
									<td>
										<div class="column gap default-inputs">
											<span>{{ capApp.hint.noAuth }}</span>
											<div class="row gap centered" v-if="inputs.noAuth">
												<input disabled :value="noAuthUrl" />
												<my-button image="copyClipboard.png"
													@trigger="copyToClipboard"
													:captionTitle="capGen.button.copyClipboard"
												/>
											</div>
										</div>
									</td>
								</tr>
								<tr>
									<td>
										<div class="title-cell">
											<img src="images/clock.png" />
											<span>{{ capApp.tokenExpiryHours }}</span>
										</div>
									</td>
									<td class="default-inputs">
										<input v-model="inputs.tokenExpiryHours" />
									</td>
									<td>{{ capApp.hint.tokenExpiryHours }}</td>
								</tr>

								<tr v-if="anyAction"><td colspan="3" class="grouping">{{ capGen.actions }}</td></tr>
								<tr v-if="isAuthR3">
									<td>
										<div class="title-cell">
											<img src="images/lock.png" />
											<span>{{ capApp.password }}</span>
										</div>
									</td>
									<td class="default-inputs">
										<input type="password" v-model="inputs.pass" :placeholder="capGen.threeDots" />
									</td>
									<td>{{ capApp.hint.password }}</td>
								</tr>

								<tr v-if="anyInfo"><td colspan="3" class="grouping">{{ capGen.information }}</td></tr>
								<tr v-if="isLimited">
									<td>
										<div class="title-cell">
											<img src="images/personDot.png" />
											<span>{{ capApp.limited }}</span>
										</div>
									</td>
									<td colspan="2"><span v-html="capApp.limitedDesc"></span></td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	</div>`,
	props:{
		ldaps:           { type:Array,  required:true },
		loginId:         { type:Number, required:true }, // login ID to load, 0 if new
		loginForms:      { type:Array,  required:true },
		loginFormLookups:{ type:Array,  required:true },
		oauthClients:    { type:Array,  required:true }
	},
	emits:['close','set-login-id'],
	data() {
		return {
			// states
			inputs:{},         // input values
			inputsOrg:{},      // input values on load
			notUniqueEmail:false,
			notUniqueName:false,
			ready:false,
			recordInput:'',    // record lookup input
			recordList:[],     // record lookup dropdown values
			roleFilter:'',     // filter for role selection
			tabTarget:'meta',
			templates:[],      // login templates
			templateId:null,   // login template, selected
			timerNotUniqueCheck:null,
			
			// login form
			loginFormIndexesDropdown:[],
			loginFormIndexOpen:null,
			loginFormRecords:null
		};
	},
	computed:{
		roleTotalNonHidden:(s) => {
			let cnt = 0;
			for(const roleId of s.inputs.roleIds) {
				if(!s.moduleIdMapMeta[s.roleIdMap[roleId].moduleId].hidden)
					cnt++
			}
			return cnt;
		},
		modulesFiltered:(s) => s.modules.filter(v => !s.moduleIdMapMeta[v.id].hidden &&
			(s.roleFilter === '' || s.getCaption('moduleTitle',v.id,v.id,v.captions,v.name).toLowerCase().includes(s.roleFilter.toLowerCase()))),
		
		// simple states
		anyAction: (s) => s.isAuthR3,
		anyInfo:   (s) => s.isLimited,
		canSave:   (s) => s.isChanged && !s.notUniqueName && s.inputs.name !== '',
		isAuthR3:  (s) => !s.isLdap && !s.isOauth,
		isChanged: (s) => s.ready && !s.deepIsEqual(s.inputsOrg,s.inputs),
		isExtRole: (s) => s.isLdapAssignedRoles || s.isOauthClientAssignedRoles,
		isFormOpen:(s) => s.loginFormIndexOpen !== null,
		isLdap:    (s) => s.inputs.ldapId !== null,
		isLimited: (s) => s.activated && s.inputs.roleIds.length < 2 && !s.inputs.admin && !s.inputs.noAuth,
		isNew:     (s) => s.loginId === 0,
		isOauth:   (s) => s.inputs.oauthClientId !== null,
		noAuthUrl: (s) => !s.inputs.noAuth ? '' : `${location.protocol}//${location.host}/#/?login=${s.inputs.name}`,

		isLdapAssignedRoles:       (s) => s.ldaps.filter(v => v.assignRoles && v.id === s.inputs.ldapId).length !== 0,
		isOauthClientAssignedRoles:(s) => s.oauthClients.filter(v => v.claimRoles !== null && v.claimRoles !== '' && v.id === s.inputs.oauthClientId).length !== 0,
		
		// stores
		activated:      (s) => s.$store.getters['local/activated'],
		modules:        (s) => s.$store.getters['schema/modules'],
		moduleIdMap:    (s) => s.$store.getters['schema/moduleIdMap'],
		formIdMap:      (s) => s.$store.getters['schema/formIdMap'],
		roleIdMap:      (s) => s.$store.getters['schema/roleIdMap'],
		capApp:         (s) => s.$store.getters.captions.admin.login,
		capGen:         (s) => s.$store.getters.captions.generic,
		moduleIdMapMeta:(s) => s.$store.getters.moduleIdMapMeta
	},
	mounted() {
		window.addEventListener('keydown',this.handleHotkeys);
		this.reset(true);
		
		if(!this.isNew)
			this.get();
		
		if(this.isNew) {
			// set defaults
			for(let lf of this.loginForms) {
				this.inputs.records.push({id:null,label:''});
			}
		}
	},
	unmounted() {
		window.removeEventListener('keydown',this.handleHotkeys);
	},
	methods:{
		// externals
		deepIsEqual,
		dialogCloseAsk,
		getCaption,
		getLoginIcon,
		srcBase64Icon,
		
		handleHotkeys(e) {
			if(e.ctrlKey && e.key === 's') {
				if(this.canSave)
					this.set();
				
				e.preventDefault();
			}
			if(e.key === 'Escape' && !this.isFormOpen) {
				this.closeAsk();
				e.preventDefault();
			}
		},
		
		// actions
		closeAsk() {
			this.dialogCloseAsk(this.close,this.isChanged);
		},
		close() {
			this.$emit('close');
		},
		copyToClipboard() {
			navigator.clipboard.writeText(this.noAuthUrl);
		},
		openLoginForm(index) {
			const frm = this.formIdMap[this.loginForms[index].formId];
			const mod = this.moduleIdMap[frm.moduleId];
			
			this.loginFormIndexOpen = index;
			this.loginFormRecords   = this.inputs.records[index].id !== null
				? [this.inputs.records[index].id] : [];
		},
		openLoginFormDropdown(index,state) {
			const pos = this.loginFormIndexesDropdown.indexOf(index);
			if(pos === -1 && state)  this.loginFormIndexesDropdown.push(index);
			if(pos !== -1 && !state) this.loginFormIndexesDropdown.splice(pos,1);
		},
		reset(initNew) {
			if(initNew) {
				this.inputs = {
					ldapId:null,
					oauthClientId:null,
					active:true,
					admin:false,
					meta:{},
					name:'',
					noAuth:false,
					pass:'',
					tokenExpiryHours:'',
					records:[],
					roleIds:[]
				};
			} else {
				this.$emit('set-login-id',0);
				this.inputs.ldapId        = null;
				this.inputs.oauthClientId = null;
				this.inputs.name          = '';
				this.inputs.meta.email    = '';
				this.getIsNotUnique('email',this.inputs.meta.email);
			}
			this.inputsOrg      = JSON.parse(JSON.stringify(this.inputs));
			this.notUniqueEmail = false;
			this.notUniqueName  = false;
			this.ready          = true;
			this.getTemplates();
		},
		toggleRoleId(roleId) {
			const pos = this.inputs.roleIds.indexOf(roleId);
			if(pos === -1) this.inputs.roleIds.push(roleId);
			else           this.inputs.roleIds.splice(pos,1);
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
			if(roleIdsByContent.length === this.inputs.roleIds.filter(v => roleIdsByContent.includes(v)).length) {
				for(let i = 0, j = roleIdsByContent.length; i < j; i++) {
					this.inputs.roleIds.splice(this.inputs.roleIds.indexOf(roleIdsByContent[i]),1);
				}
				return;
			}
			
			// does not have all roles, add missing
			for(let i = 0, j = roleIdsByContent.length; i < j; i++) {
				if(!this.inputs.roleIds.includes(roleIdsByContent[i]))
					this.inputs.roleIds.push(roleIdsByContent[i]);
			}
		},
		typedUniqueField(content,value) {
			clearInterval(this.timerNotUniqueCheck);
			this.timerNotUniqueCheck = setTimeout(() => this.getIsNotUnique(content,value),750);
		},
		updateLoginRecord(loginFormIndex,recordId) {
			this.recordInput = '';
			this.inputs.records[loginFormIndex].id = recordId;
			
			if(recordId !== null) this.getRecords(loginFormIndex);
			else                  this.inputs.records[loginFormIndex].label = '';
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
			ws.send('login','del',{id:this.loginId},true).then(
				() => {
					ws.send('login','kick',{id:this.loginId},true).then(
						() => this.$emit('close'),
						this.$root.genericError
					);
				},
				this.$root.genericError
			);
		},
		get() {
			ws.send('login','get',{
				byId:this.loginId,
				meta:true,
				roles:true,
				recordRequests:this.loginFormLookups
			},true).then(
				res => {
					if(res.payload.logins.length !== 1) return;
					
					this.inputs    = res.payload.logins[0];
					this.inputsOrg = JSON.parse(JSON.stringify(this.inputs));
					this.getIsNotUnique('email',this.inputs.meta.email);
				},
				this.$root.genericError
			);
		},
		getIsNotUnique(content,value) {
			value = value.trim().toLowerCase();
			if(value === '')
				return;

			ws.send('login','getIsNotUnique',{
				loginId:this.loginId,
				content:content,
				value:value
			},true).then(
				res => {
					switch(content) {
						case 'email': this.notUniqueEmail = res.payload; break;
						case 'name':  this.notUniqueName  = res.payload; break;
					}
				},
				this.$root.genericError
			);
		},
		getRecords(loginFormIndex) {
			this.recordList = [];
			let isIdLookup = this.inputs.records[loginFormIndex].id !== null;
			
			ws.send('login','getRecords',{
				attributeIdLookup:this.loginForms[loginFormIndex].attributeIdLookup,
				byId:isIdLookup ? this.inputs.records[loginFormIndex].id : 0,
				byString:isIdLookup ? '' : this.recordInput
			},true).then(
				res => {
					if(!isIdLookup)
						return this.recordList = res.payload;
					
					if(res.payload.length === 1)
						this.inputs.records[loginFormIndex].label = res.payload[0].name;
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
					recordId:this.inputs.records[i].id
				});
			}
			
			ws.send('login','set',{
				id:this.loginId,
				templateId:this.templateId,
				name:this.inputs.name,
				pass:this.inputs.pass,
				active:this.inputs.active,
				admin:this.inputs.admin,
				meta:this.inputs.meta,
				noAuth:this.inputs.noAuth,
				tokenExpiryHours:/^(0|[1-9]\d*)$/.test(this.inputs.tokenExpiryHours) ? parseInt(this.inputs.tokenExpiryHours) : null,
				roleIds:this.inputs.roleIds,
				records:records
			},true).then(
				res => {
					// if login was changed, reauth. or kick client
					if(!this.isNew)
						ws.send('login',this.inputs.active ? 'reauth' : 'kick',{id:this.loginId},false);
					
					if(this.isNew)
						this.$emit('set-login-id',res.payload);
					
					this.$nextTick(this.get);
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
			ws.send('login','resetTotp',{id:this.loginId},true).then(
				res => {},this.$root.genericError
			);
		}
	}
};