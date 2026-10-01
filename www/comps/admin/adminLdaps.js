import { getTemplateLdap } from '../shared/templates.js';
import MyAdminLdap from './adminLdap.js';

export default {
	name: 'my-admin-ldaps',
	components: { MyAdminLdap },
	template: `<div class="admin-ldaps contentBox grow">
		<div class="top">
			<div class="area">
				<img class="icon" src="images/hierarchy.png" />
				<h1>{{ menuTitle }}</h1>
			</div>
		</div>
		<div class="top lower">
			<div class="area">
				<my-button image="add.png"
					@trigger="open(null)"
					:active="licenseValid"
					:caption="capGen.button.new"
				/>
				<my-button image="refresh.png"
					@trigger="get"
					:caption="capGen.button.refresh"
				/>
			</div>
			<div class="area">
				<my-button image="download.png"
					@trigger="runImports"
					:active="licenseValid"
					:caption="capApp.button.import"
				/>
			</div>
			<div class="area">
				<my-button image="question.png"
					v-if="isAnyLdaps"
					@trigger="showHelp(capApp.description)"
					:caption="capGen.information"
				/>
			</div>
		</div>

		<div class="content grow">
			<div class="contentPart long" v-if="!isAnyLdaps">
				<div class="column gap">
					<span v-html="capApp.description"></span>
				</div>
			</div>

			<div class="generic-entry-list wide">
				<div class="entry clickable"
					v-for="l in ldaps"
					@click="open(l.id)"
					:key="l.id"
					:title="l.name"
				>
					<div class="lines">
						<span>{{ l.name }}</span>
						<span class="subtitle">{{ l.host + ':' + l.port }}</span>
					</div>
				</div>
			</div>
		</div>

		<my-admin-ldap
			v-if="ldapOpen !== null"
			@close="close"
			@makeNew="open(null)"
			@reload="get"
			:ldapOrg="ldapOpen"
			:templates
		/>
	</div>`,
	props: {
		menuTitle: { type: String, required: true }
	},
	data() {
		return {
			ldaps: [],
			templates: [],

			// states
			ldapOpen: null // contains LDAP as object (null = no LDAP open)
		};
	},
	computed: {
		isAnyLdaps: s => s.ldaps.length !== 0,
		licenseValid: s => s.$store.getters.licenseValid,

		// stores
		capApp: s => s.$store.getters.captions.admin.ldaps,
		capGen: s => s.$store.getters.captions.generic,
	},
	mounted() {
		this.$store.commit('pageTitle', this.menuTitle);
		this.get();
	},
	methods: {
		// externals
		getTemplateLdap,

		// actions
		close() {
			this.ldapOpen = null;
		},
		open(id) {
			const ldap = id === null
				? this.getTemplateLdap()
				: this.ldaps.find(v => v.id === id) ?? null;

			// apply global template if empty
			if (ldap.loginTemplateId === null && this.templates.length > 0)
				ldap.loginTemplateId = this.templates[0].id;

			this.ldapOpen = ldap;
		},
		runImports() {
			ws.send('task', 'run', { clusterMasterOnly: true, taskName: 'importLdapLogins' }, true).then(
				() => this.$store.commit('dialog', { captionBody: this.capApp.dialog.importPlanned }),
				this.$root.genericError
			);
		},
		showHelp(msg) {
			this.$store.commit('dialog', { captionBody: msg, captionTop: this.capGen.information });
		},

		// backend calls
		get() {
			ws.sendMultiple([
				ws.prepare('ldap', 'get', {}),
				ws.prepare('loginTemplate', 'get', { byId: 0 })
			], true).then(
				res => {
					this.ldaps = res[0].payload;
					this.templates = res[1].payload;
				},
				this.$root.genericError
			);
		}
	}
};
