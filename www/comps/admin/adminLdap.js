import { dialogCloseAsk, dialogDeleteAsk } from '../shared/dialog.js';
import { deepIsEqual } from '../shared/generic.js';

import MyAdminLoginMeta from './adminLoginMeta.js';
import MyAdminLoginRolesAssign from './adminLoginRolesAssign.js';

export default {
	name: 'my-admin-ldap',
	components: { MyAdminLoginMeta, MyAdminLoginRolesAssign },
	template: `<div class="app-sub-window under-header at-top with-margin" v-if="isReady" @mousedown.self="closeAsk">

		<div class="contentBox admin-ldap scroll float">
			<div class="top">
				<div class="area nowrap">
					<img class="icon" src="images/hierarchy.png" />
					<h1 class="title">{{ isNew ? capApp.titleNew : capApp.title.replace('{NAME}',ldap.name) }}</h1>
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
						@trigger="reset"
						:active="isChanged"
						:caption="capGen.button.refresh"
					/>
					<my-button image="add.png"
						v-if="!isNew"
						@trigger="$emit('makeNew')"
						:active="licenseValid"
						:caption="capGen.button.new"
					/>
				</div>
				<div class="area">
					<my-button image="settings.png"
						v-if="!isNew"
						@trigger="runCheck"
						:caption="capApp.button.test"
					/>
				</div>
				<div class="area">
					<my-button image="delete.png"
						v-if="!isNew"
						@trigger="dialogDeleteAsk(del,capApp.dialog.delete)"
						:active="licenseValid"
						:cancel="true"
						:caption="capGen.button.delete"
					/>
				</div>
			</div>

			<my-tabs
				v-model="tabTarget"
				:entries="tabs.items"
				:entriesIcon="tabs.icons"
				:entriesText="tabs.names"
			/>
			<div class="content grow no-padding" v-if="tabTarget === 'general'">
				<table class="generic-table-vertical default-inputs">
					<tbody>
						<tr>
							<td>{{ capGen.name }}</td>
							<td><input v-model="ldap.name" :disabled="!licenseValid" :placeholder="capApp.nameHint" /></td>
						</tr>
						<tr>
							<td>{{ capGen.loginTemplate }}</td>
							<td>
								<select v-model="ldap.loginTemplateId" :disabled="!licenseValid">
									<option v-for="t in templates" :title="t.comment" :value="t.id">
										{{ t.name }}
									</option>
								</select>
							</td>
						</tr>
						<tr>
							<td>{{ capApp.host }}</td>
							<td><input v-model="ldap.host" :disabled="!licenseValid" :placeholder="capApp.hostHint" /></td>
						</tr>
						<tr>
							<td>{{ capApp.port }}</td>
							<td><input v-model.number="ldap.port" :disabled="!licenseValid" :placeholder="capApp.portHint" /></td>
						</tr>
						<tr>
							<td>{{ capApp.bindUserDn }}</td>
							<td><input class="long" v-model="ldap.bindUserDn" :disabled="!licenseValid" :placeholder="capApp.bindUserDnHint" /></td>
						</tr>
						<tr>
							<td>{{ capApp.bindUserPw }}</td>
							<td><input class="long" v-model="ldap.bindUserPw" :disabled="!licenseValid" type="password" /></td>
						</tr>
						<tr>
							<td>{{ capApp.searchDn }}</td>
							<td><input class="long" v-model="ldap.searchDn" :disabled="!licenseValid || !isNew" :placeholder="capApp.searchDnHint" /></td>
						</tr>
						<tr>
							<td>{{ capApp.tls }}</td>
							<td><my-bool v-model="ldap.tls" :readonly="!licenseValid || ldap.starttls" /></td>
						</tr>
						<tr>
							<td>{{ capApp.starttls }}</td>
							<td><my-bool v-model="ldap.starttls" :readonly="!licenseValid || ldap.tls" /></td>
						</tr>
						<tr>
							<td>{{ capApp.tlsVerify }}</td>
							<td><my-bool v-model="ldap.tlsVerify" :readonly="!licenseValid || (!ldap.tls && !ldap.starttls)" /></td>
						</tr>
						<tr>
							<td>{{ capApp.msAdExt }}</td>
							<td>
								<my-bool v-model="ldap.msAdExt" :readonly="!licenseValid" />
								<span>{{ capApp.msAdExtHint }}</span>
							</td>
						</tr>
						<tr>
							<td>{{ capApp.searchClass }}</td>
							<td><input v-model="ldap.searchClass" :disabled="!licenseValid" :placeholder="capApp.searchClassHint" /></td>
						</tr>
						<tr>
							<td>{{ capApp.keyAttribute }}</td>
							<td><input v-model="ldap.keyAttribute" :disabled="!licenseValid" :placeholder="capApp.keyAttributeHint" /></td>
						</tr>
						<tr>
							<td>{{ capApp.loginAttribute }}</td>
							<td><input v-model="ldap.loginAttribute" :disabled="!licenseValid" :placeholder="capApp.loginAttributeHint" /></td>
						</tr>
					</tbody>
				</table>
			</div>

			<div class="content grow flex column no-padding" v-if="tabTarget === 'roles'">
				<table class="generic-table-vertical sticky-top default-inputs">
					<tbody>
						<tr>
							<td colspan="2">
								<div class="column gap">
									<div class="row space-between centered">
										<my-button-check
											v-model="ldap.assignRoles"
											:caption="capApp.assignRoles"
											:readonly="!licenseValid"
										/>
										<span>{{ capApp.assignRolesHint }}</span>
									</div>
									<template v-if="ldap.assignRoles">
										<div class="row gap centered">
											<span>{{ capApp.memberAttribute }}</span>
											<input
												v-model="ldap.memberAttribute"
												:disabled="!licenseValid"
												:placeholder="capApp.memberAttributeHint"
											/>
										</div>
										<my-admin-login-roles-assign
											v-model="ldap.loginRolesAssign"
											:placeholder="capApp.groupDnHint"
											:readonly="!licenseValid || ldap.memberAttribute === ''"
										/>
									</template>
								</div>
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			<div class="content grow no-padding" v-if="tabTarget === 'meta'">
				<my-admin-login-meta
					v-model="ldap.loginMetaMap"
					:is-mapper="true"
					:readonly="!licenseValid"
				/>
			</div>

			<div class="content grow flex column gap default-inputs" v-if="tabTarget === 'filter'">
				<div class="row space-between centered">
					<h2>{{ capApp.filterDn }}</h2>
					<my-button image="question.png" @trigger="showHelp('<p>' + capApp.filterDnHint.join('</p><p>') + '</p>')" :caption="capGen.contextHelp" />
				</div>
				<div class="column gap">
					<div class="row space-between centered">
						<span>{{ capApp.filterDnExclude }}</span>
						<my-button image="add.png" @trigger="filterDnAdd(true)" :active="licenseValid && ldap.filterDnInclude.length === 0" />
					</div>
					<div class="row gap centered" v-for="(f,i) in ldap.filterDnExclude">
						<input class="dynamic" v-model="ldap.filterDnExclude[i]" :disabled="!licenseValid" :placeholder="capApp.searchDnHint" />
						<my-button image="cancel.png" @trigger="filterDnRemove(true,i)" :active="licenseValid" :cancel="true" />
					</div>
				</div>
				<div class="column gap">
					<div class="row space-between centered">
						<span>{{ capApp.filterDnInclude }}</span>
						<my-button image="add.png" @trigger="filterDnAdd(false)" :active="licenseValid && ldap.filterDnExclude.length === 0" />
					</div>
					<div class="row gap centered" v-for="(f,i) in ldap.filterDnInclude">
						<input class="dynamic" v-model="ldap.filterDnInclude[i]" :disabled="!licenseValid" :placeholder="capApp.searchDnHint" />
						<my-button image="cancel.png" @trigger="filterDnRemove(false,i)" :active="licenseValid" :cancel="true" />
					</div>
				</div>
				<br />
			</div>
		</div>
	</div>`,
	props: {
		ldapOrg: { type: Object, required: true },
		templates: { type: Array, required: true },
	},
	emits: ['close', 'makeNew', 'reload'],
	watch: {
		ldapOrg: {
			handler() { this.reset(); },
			immediate: true
		}
	},
	data() {
		return {
			// inputs
			ldap: {},

			// states
			isReady: false,
			tabTarget: 'general',
		};
	},
	computed: {
		canSave: s => s.isReady && s.isChanged
			&& s.ldap.searchDn !== ''
			&& s.ldap.name !== ''
			&& s.ldap.host !== ''
			&& s.ldap.port !== '',
		tabs: s => {
			return {
				icons: ['images/settings.png', 'images/person.png', 'images/personMultiple.png', 'images/filter.png'],
				items: ['general', 'meta', 'roles', 'filter'],
				names: [s.capGen.properties, s.capGen.userDetails, s.capGen.roles, s.capGen.filters]
			};
		},

		// simple
		isChanged: s => !s.deepIsEqual(s.ldapOrg, s.ldap),
		isNew: s => s.ldap.id === 0,

		// stores
		capApp: s => s.$store.getters.captions.admin.ldaps,
		capGen: s => s.$store.getters.captions.generic,
		licenseValid: s => s.$store.getters.licenseValid,
	},
	mounted() {
		this.$store.commit('keyDownHandlerSleep');
		this.$store.commit('keyDownHandlerAdd', { fnc: this.set, key: 's', keyCtrl: true });
		this.$store.commit('keyDownHandlerAdd', { fnc: this.closeAsk, key: 'Escape' });
	},
	unmounted() {
		this.$store.commit('keyDownHandlerDel', this.set);
		this.$store.commit('keyDownHandlerDel', this.closeAsk);
		this.$store.commit('keyDownHandlerWake');
	},
	methods: {
		// external
		deepIsEqual,
		dialogCloseAsk,
		dialogDeleteAsk,

		// actions
		closeAsk() {
			this.dialogCloseAsk(this.close, this.isChanged);
		},
		close() {
			this.$emit('close');
		},
		filterDnAdd(isExclude) {
			if (isExclude) this.ldap.filterDnExclude.push('');
			else this.ldap.filterDnInclude.push('');
		},
		filterDnRemove(isExclude, index) {
			if (isExclude) this.ldap.filterDnExclude.splice(index, 1);
			else this.ldap.filterDnInclude.splice(index, 1);
		},
		reloadAndClose() {
			this.$emit('reload');
			this.reloadBackendCache();
			this.close();
		},
		reset() {
			this.ldap = JSON.parse(JSON.stringify(this.ldapOrg));
			this.isReady = true;
		},
		showHelp(msg) {
			this.$store.commit('dialog', { captionBody: msg, captionTop: this.capGen.information });
		},

		// backend calls
		runCheck() {
			ws.send('ldap', 'check', { id: this.ldap.id }, true).then(
				() => this.$store.commit('dialog', { captionBody: this.capApp.dialog.testDone }),
				this.$root.genericError
			);
		},
		reloadBackendCache() {
			ws.send('ldap', 'reload', {}, false).then(() => { }, this.$root.genericError);
		},
		del() {
			ws.send('ldap', 'del', { id: this.ldap.id }, true).then(
				this.reloadAndClose,
				this.$root.genericError
			);
		},
		set() {
			if (!this.canSave)
				return;

			ws.send('ldap', 'set', this.ldap, true).then(
				this.reloadAndClose,
				this.$root.genericError
			);
		}
	}
};
