
import MyForm from '../form.js';
import MyInputDecimal from '../inputDecimal.js';
import MyInputSelect from '../inputSelect.js';

import { getLoginIcon } from '../shared/admin.js';
import { dialogCloseAsk, dialogDeleteAsk } from '../shared/dialog.js';
import { deepIsEqual } from '../shared/generic.js';
import srcBase64Icon from '../shared/image.js';
import { getCaption } from '../shared/language.js';

import MyAdminLoginMeta from './adminLoginMeta.js';
import MyAdminLoginTemplateInput from './adminLoginTemplateInput.js';
import MyAdminMailAccountInput from './adminMailAccountInput.js';
import MyAdminMailTemplateInput from './adminMailTemplateInput.js';

const MyAdminLoginRole = {
	name: 'my-admin-login-role',
	template: `<td class="minimum role-content">
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
	props: {
		content: { type: String, required: true }, // role content to filter by
		module: { type: Object, required: true }, // current module
		readonly: { type: Boolean, required: true },
		roleIds: { type: Array, required: true }  // already enabled roles by ID
	},
	emits: ['toggle'],
	methods: {
		getCaption
	}
};

export default {
	name: 'my-admin-login',
	components: {
		MyAdminLoginMeta, MyAdminLoginRole, MyAdminLoginTemplateInput, MyAdminMailAccountInput,
		MyAdminMailTemplateInput, MyForm, MyInputDecimal, MyInputSelect
	},
	template: `<div class="app-sub-window under-header at-top with-margin" @mousedown.self="closeAsk">

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
					<my-button image="delete.png"
						v-if="!isNew"
						@trigger="dialogDeleteAsk(del,capApp.dialog.delete)"
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
									<input v-model="inputs.name" v-focus @input="typedUniqueField('name',inputs.name)" :disabled="!isAuthLocal" />
									<div v-if="notUniqueName && inputs.name !== ''" class="message error">
										{{ capApp.dialog.notUniqueName }}
									</div>
								</div>
							</td>
							<td>{{ capApp.hint.name }}</td>
						</tr>
						<template v-if="isNew">
							<tr>
								<td>
									<div class="title-cell">
										<img src="images/personTemplate.png" />
										<span>{{ capGen.loginTemplate }}</span>
									</div>
								</td>
								<td class="default-inputs">
									<my-admin-login-template-input v-model="templateId" />
								</td>
								<td>{{ capGen.loginTemplateHint }}</td>
							</tr>
							<tr>
								<td>
									<div class="title-cell">
										<img src="images/key.png" />
										<span>{{ capGen.password }}</span>
									</div>
								</td>
								<td class="default-inputs">
									<input autocomplete="new-password" type="password"
										v-model="inputs.pass"
										:disabled="!isAuthLocalPw"
										:placeholder="capGen.threeDots"
									/>
								</td>
							</tr>
						</template>
						<tr v-if="!isAuthLocal">
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
						:entries="tabs.items"
						:entriesIcon="tabs.icons"
						:entriesText="tabs.names"
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
								:readonly="!isAuthLocal"
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
									<td><my-bool v-model="inputs.noAuth" :readonly="!isAuthLocal" /></td>
									<td>
										<div class="column gap default-inputs">
											<span>{{ capApp.hint.noAuth }}</span>
											<div class="row gap centered" v-if="isAuthPublic">
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
											<img src="images/smartphone.png" />
											<span>{{ capGen.mfa }}</span>
										</div>
									</td>
									<td class="default-inputs">
										<select v-model="mfaRequiredSelect" :disabled="isAuthPublic || isOauth">
											<option value="">{{ capGen.systemDefault }}</option>
											<option value="1">{{ capGen.required }}</option>
											<option value="0">{{ capGen.optional }}</option>
										</select>
									</td>
									<td>{{ inputs.mfaRequired === null ? '' : capApp.hint.mfaRequired }}</td>
								</tr>
								<tr>
									<td>
										<div class="title-cell">
											<img src="images/clock.png" />
											<span>{{ capApp.tokenExpiryHours }}</span>
										</div>
									</td>
									<td class="default-inputs">
										<my-input-decimal
											v-model="inputs.tokenExpiryHours"
											:allowNull="true"
											:lengthFract="0"
											:min="0"
											:placeholder="capGen.systemDefault"
										/>
									</td>
									<td>{{ inputs.tokenExpiryHours === null ? '' : capApp.hint.tokenExpiryHours }}</td>
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

						<!-- actions -->
						<table class="generic-table-vertical w1200" v-if="tabTarget === 'actions'">
							<tbody>
								<tr><td colspan="3" class="grouping">{{ capApp.passwordReset }}</td></tr>
								<tr>
									<td class="default-inputs">
										<div class="column gap">
											<my-admin-mail-account-input
												v-model="mailAccountId"
												:onlySend="true"
												:readonly="!isAuthLocalPw"
											/>
											<my-admin-mail-template-input
												v-model="mailTemplateId"
												:onlyPwReset="true"
												:readonly="!isAuthLocalPw"
											/>
											<div class="row gap centered">
												<span>{{ capGen.expireAfter }}</span>
												<my-input-decimal class="short"
													v-model="passResetExpire"
													:allowNull="false"
													:lengthFract="0"
													:min="60"
													:readonly="!isAuthLocalPw"
												/>
												<span>{{ capGen.seconds }}</span>
											</div>
											<div class="row">
												<my-button image="mail2.png"
													@trigger="sendResetMail"
													:active="mailAccountId !== 0 && mailTemplateId !== 0 && passResetExpire !== 0 && passResetExpire !== null"
													:caption="capGen.button.send"
												/>
											</div>
										</div>
									</td>
									<td>{{ capApp.hint.passwordReset }}</td>
								</tr>
								<tr><td colspan="3" class="grouping">{{ capApp.password }}</td></tr>
								<tr>
									<td class="default-inputs">
										<div class="column gap">
											<input autocomplete="new-password" type="password"
												v-model="passSet"
												:disabled="!isAuthLocalPw"
												:placeholder="capGen.threeDots"
											/>
											<div class="row">
												<my-button image="save.png"
													@trigger="setPassword"
													:active="passSet !== ''"
													:caption="capGen.button.execute"
												/>
											</div>
										</div>
									</td>
									<td>{{ capApp.hint.password }}</td>
								</tr>
								<tr><td colspan="3" class="grouping">{{ capApp.mfaReset }}</td></tr>
								<tr>
									<td>
										<my-button image="save.png"
											@trigger="resetTotpAsk"
											:active="!isAuthPublic && !isOauth"
											:caption="capGen.button.execute"
										/>
									</td>
									<td>{{ capApp.hint.mfaReset }}</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	</div>`,
	props: {
		ldaps: { type: Array, required: true },
		loginId: { type: Number, required: true }, // login ID to load, 0 if new
		loginForms: { type: Array, required: true },
		loginFormLookups: { type: Array, required: true },
		oauthClients: { type: Array, required: true }
	},
	emits: ['close', 'set-login-id'],
	data() {
		return {
			// states
			inputs: {},         // input values
			inputsOrg: {},      // input values on load
			notUniqueEmail: false,
			notUniqueName: false,
			ready: false,
			recordInput: '',    // record lookup input
			recordList: [],     // record lookup dropdown values
			roleFilter: '',     // filter for role selection
			tabTarget: 'meta',
			templateId: null,   // login template for new login
			timerNotUniqueCheck: null,

			// login form
			loginFormIndexesDropdown: [],
			loginFormIndexOpen: null,
			loginFormRecords: null,

			// PW set action
			passSet: '',

			// PW reset action
			mailAccountId: 0,
			mailTemplateId: 0,
			passResetExpire: 86400
		};
	},
	computed: {
		modulesFiltered: s => s.modules.filter(v => !s.moduleIdMapMeta[v.id].hidden &&
			(s.roleFilter === '' || s.getCaption('moduleTitle', v.id, v.id, v.captions, v.name).toLowerCase().includes(s.roleFilter.toLowerCase()))),
		roleTotalNonHidden: s => {
			let cnt = 0;
			for (const roleId of s.inputs.roleIds) {
				if (!s.moduleIdMapMeta[s.roleIdMap[roleId].moduleId].hidden)
					cnt++
			}
			return cnt;
		},
		tabs: s => {
			const out = {
				icons: ['images/editBox.png', 'images/personMultiple.png', 'images/personCog.png'],
				items: ['meta', 'roles', 'properties'],
				names: [s.capGen.details, s.capApp.roles.replace('{COUNT}', s.roleTotalNonHidden), s.capGen.properties]
			};
			if (!s.isNew) {
				out.icons.push('images/cogMultiple.png');
				out.items.push('actions');
				out.names.push(s.capGen.actions);
			}
			return out;
		},

		// inputs
		mfaRequiredSelect: {
			get() {
				return this.inputs.mfaRequired === null ? '' : (this.inputs.mfaRequired ? '1' : '0');
			},
			set(v) {
				this.inputs.mfaRequired = v === '' ? null : v === '1';
			}
		},

		// simple states
		anyInfo: s => s.isLimited,
		canSave: s => s.isChanged && !s.notUniqueName && s.inputs.name !== '',
		isAuthLocal: s => !s.isLdap && !s.isOauth,
		isAuthLocalPw: s => s.isAuthLocal && !s.isAuthPublic,
		isAuthPublic: s => s.inputs.noAuth,
		isChanged: s => s.ready && !s.deepIsEqual(s.inputsOrg, s.inputs),
		isExtRole: s => s.isLdapAssignedRoles || s.isOauthClientAssignedRoles,
		isFormOpen: s => s.loginFormIndexOpen !== null,
		isLdap: s => s.inputs.ldapId !== null,
		isLdapAssignedRoles: s => s.ldaps.filter(v => v.assignRoles && v.id === s.inputs.ldapId).length !== 0,
		isLimited: s => s.activated && s.inputs.roleIds.length < 2 && !s.inputs.admin && !s.inputs.noAuth,
		isNew: s => s.loginId === 0,
		isOauth: s => s.inputs.oauthClientId !== null,
		isOauthClientAssignedRoles: s => s.oauthClients.filter(v => v.claimRoles !== null && v.claimRoles !== '' && v.id === s.inputs.oauthClientId).length !== 0,
		noAuthUrl: s => !s.inputs.noAuth ? '' : `${location.protocol}//${location.host}/#/?login=${s.inputs.name}`,

		// stores
		activated: s => s.$store.getters['local/activated'],
		modules: s => s.$store.getters['schema/modules'],
		moduleIdMap: s => s.$store.getters['schema/moduleIdMap'],
		formIdMap: s => s.$store.getters['schema/formIdMap'],
		roleIdMap: s => s.$store.getters['schema/roleIdMap'],
		capApp: s => s.$store.getters.captions.admin.login,
		capGen: s => s.$store.getters.captions.generic,
		mailTemplateContent: s => s.$store.getters.constants.mailTemplateContent,
		moduleIdMapMeta: s => s.$store.getters.moduleIdMapMeta
	},
	mounted() {
		window.addEventListener('keydown', this.handleHotkeys);
		this.reset(true);

		if (!this.isNew)
			this.get();

		if (this.isNew) {
			// set defaults
			for (const lf of this.loginForms) {
				this.inputs.records.push({ id: null, label: '' });
			}
		}
	},
	unmounted() {
		window.removeEventListener('keydown', this.handleHotkeys);
	},
	methods: {
		// externals
		deepIsEqual,
		dialogCloseAsk,
		dialogDeleteAsk,
		getCaption,
		getLoginIcon,
		srcBase64Icon,

		handleHotkeys(e) {
			if (e.ctrlKey && e.key === 's') {
				if (this.canSave)
					this.set();

				e.preventDefault();
			}
			if (e.key === 'Escape' && !this.isFormOpen) {
				this.closeAsk();
				e.preventDefault();
			}
		},

		// actions
		closeAsk() {
			this.dialogCloseAsk(this.close, this.isChanged);
		},
		close() {
			this.$emit('close');
		},
		copyToClipboard() {
			navigator.clipboard.writeText(this.noAuthUrl);
		},
		openLoginForm(index) {
			this.loginFormIndexOpen = index;
			this.loginFormRecords = this.inputs.records[index].id !== null
				? [this.inputs.records[index].id] : [];
		},
		openLoginFormDropdown(index, state) {
			const pos = this.loginFormIndexesDropdown.indexOf(index);
			if (pos === -1 && state) this.loginFormIndexesDropdown.push(index);
			if (pos !== -1 && !state) this.loginFormIndexesDropdown.splice(pos, 1);
		},
		reset(initNew) {
			if (initNew) {
				this.inputs = {
					ldapId: null,
					oauthClientId: null,
					active: true,
					admin: false,
					meta: {},
					mfaRequired: null,
					name: '',
					noAuth: false,
					pass: '',
					tokenExpiryHours: null,
					records: [],
					roleIds: []
				};
			} else {
				this.$emit('set-login-id', 0);
				this.inputs.ldapId = null;
				this.inputs.oauthClientId = null;
				this.inputs.name = '';
				this.inputs.meta.email = '';
				this.getIsNotUnique('email', this.inputs.meta.email);
			}
			this.inputsOrg = JSON.parse(JSON.stringify(this.inputs));
			this.notUniqueEmail = false;
			this.notUniqueName = false;
			this.ready = true;
		},
		toggleRoleId(roleId) {
			const pos = this.inputs.roleIds.indexOf(roleId);
			if (pos === -1) this.inputs.roleIds.push(roleId);
			else this.inputs.roleIds.splice(pos, 1);
		},
		toggleRolesByContent(content) {
			const roleIdsByContent = [];
			for (let i = 0, j = this.modules.length; i < j; i++) {
				for (let x = 0, y = this.modules[i].roles.length; x < y; x++) {
					const r = this.modules[i].roles[x];

					if (r.assignable && r.content === content)
						roleIdsByContent.push(r.id);
				}
			}

			// has all roles, remove all
			if (roleIdsByContent.length === this.inputs.roleIds.filter(v => roleIdsByContent.includes(v)).length) {
				for (let i = 0, j = roleIdsByContent.length; i < j; i++) {
					this.inputs.roleIds.splice(this.inputs.roleIds.indexOf(roleIdsByContent[i]), 1);
				}
				return;
			}

			// does not have all roles, add missing
			for (let i = 0, j = roleIdsByContent.length; i < j; i++) {
				if (!this.inputs.roleIds.includes(roleIdsByContent[i]))
					this.inputs.roleIds.push(roleIdsByContent[i]);
			}
		},
		typedUniqueField(content, value) {
			clearInterval(this.timerNotUniqueCheck);
			this.timerNotUniqueCheck = setTimeout(() => this.getIsNotUnique(content, value), 750);
		},
		updateLoginRecord(loginFormIndex, recordId) {
			this.recordInput = '';
			this.inputs.records[loginFormIndex].id = recordId;

			if (recordId !== null) this.getRecords(loginFormIndex);
			else this.inputs.records[loginFormIndex].label = '';
		},

		// backend calls
		del() {
			ws.send('login', 'del', { id: this.loginId }, true).then(
				() => {
					ws.send('login', 'kick', { id: this.loginId }, true).then(
						() => this.$emit('close'),
						this.$root.genericError
					);
				},
				this.$root.genericError
			);
		},
		get() {
			ws.send('login', 'get', {
				byId: this.loginId,
				meta: true,
				roles: true,
				recordRequests: this.loginFormLookups
			}, true).then(
				res => {
					if (res.payload.logins.length !== 1) return;

					this.inputs = res.payload.logins[0];
					this.inputsOrg = JSON.parse(JSON.stringify(this.inputs));
					this.getIsNotUnique('email', this.inputs.meta.email);
				},
				this.$root.genericError
			);
		},
		getIsNotUnique(content, value) {
			value = value.trim().toLowerCase();
			if (value === '')
				return;

			ws.send('login', 'getIsNotUnique', {
				loginId: this.loginId,
				content: content,
				value: value
			}, true).then(
				res => {
					switch (content) {
						case 'email': this.notUniqueEmail = res.payload; break;
						case 'name': this.notUniqueName = res.payload; break;
					}
				},
				this.$root.genericError
			);
		},
		getRecords(loginFormIndex) {
			this.recordList = [];
			const isIdLookup = this.inputs.records[loginFormIndex].id !== null;

			ws.send('login', 'getRecords', {
				attributeIdLookup: this.loginForms[loginFormIndex].attributeIdLookup,
				byId: isIdLookup ? this.inputs.records[loginFormIndex].id : 0,
				byString: isIdLookup ? '' : this.recordInput
			}, true).then(
				res => {
					if (!isIdLookup) {
						this.recordList = res.payload;
						return;
					}
					if (res.payload.length === 1)
						this.inputs.records[loginFormIndex].label = res.payload[0].name;
				},
				this.$root.genericError
			);
		},
		set() {
			const records = [];
			for (let i = 0, j = this.loginForms.length; i < j; i++) {
				records.push({
					attributeId: this.loginForms[i].attributeIdLogin,
					recordId: this.inputs.records[i].id
				});
			}

			ws.send('login', 'set', {
				id: this.loginId,
				templateId: this.templateId,
				name: this.inputs.name,
				pass: this.inputs.pass,
				active: this.inputs.active,
				admin: this.inputs.admin,
				meta: this.inputs.meta,
				mfaRequired: this.inputs.mfaRequired,
				noAuth: this.inputs.noAuth,
				tokenExpiryHours: this.inputs.tokenExpiryHours,
				roleIds: this.inputs.roleIds,
				records
			}, true).then(
				res => {
					// if login was changed, reauth. or kick client
					if (!this.isNew)
						ws.send('login', this.inputs.active ? 'reauth' : 'kick', { id: this.loginId }, false);

					if (this.isNew)
						this.$emit('set-login-id', res.payload);

					this.$nextTick(this.get);
				},
				this.$root.genericError
			);
		},
		setPassword() {
			ws.send('loginPassword', 'set', {
				loginIdTarget: this.loginId,
				pwNew: this.passSet
			}, true).then(
				() => this.passSet = '',
				this.$root.genericError
			);
		},

		// PW reset calls
		sendResetMail() {
			ws.send('loginReset', 'set', {
				expireAfterSeconds: this.passResetExpire,
				mailAccountId: this.mailAccountId,
				mailTemplateId: this.mailTemplateId,
				mailTemplateContent: this.mailTemplateContent.loginPwReset,
				loginIdsReset: [this.loginId],
			}, true).then(
				() => {
					this.$store.commit('dialog', { captionBody: this.capApp.dialog.resetCodeSent });
					this.mailAccountId = 0;
					this.mailTemplateId = 0;
				},
				this.$root.genericError
			);
		},

		// MFA calls
		resetTotpAsk() {
			this.$store.commit('dialog', {
				captionBody: this.capApp.dialog.resetTotp,
				image: 'warning.png',
				buttons: [{
					cancel: true,
					caption: this.capGen.button.reset,
					exec: this.resetTotp,
					keyEnter: true,
					image: 'refresh.png'
				}, {
					caption: this.capGen.button.cancel,
					keyEscape: true,
					image: 'cancel.png'
				}]
			});
		},
		resetTotp() {
			ws.send('login', 'resetTotp', { id: this.loginId }, true).then(
				() => { }, this.$root.genericError
			);
		}
	}
};
