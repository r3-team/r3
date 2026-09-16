import { getTemplateMailTemplate } from '../shared/templates.js';
import MyAdminMailTemplate from './adminMailTemplate.js';

export default {
	name: 'my-admin-mail-templates',
	components: { MyAdminMailTemplate },
	template: `<div class="admin-mail-templates contentBox grow">
		<div class="top">
			<div class="area">
				<img class="icon" src="images/mailPlus.png" />
				<h1>{{ menuTitle }}</h1>
			</div>
		</div>
		<div class="top lower">
			<div class="area">
				<my-button image="add.png"
					@trigger="open(null)"
					:caption="capGen.button.new"
				/>
				<my-button image="refresh.png"
					@trigger="get"
					:caption="capGen.button.refresh"
				/>
			</div>
		</div>

		<div class="content grow">
			<div class="generic-entry-list wide">
				<div class="entry clickable"
					v-for="t in mailTemplatesSorted"
					@click="open(t.id)"
					:key="t.id"
					:title="t.name"
				>
					<div class="lines">
						<span>{{ getTitle(t) }}</span>
					</div>
				</div>
			</div>
		</div>

		<my-admin-mail-template
			v-if="templateOpen !== null"
			@close="close"
			@makeNew="open(null)"
			@reload="get"
			:templateOrg="templateOpen"
		/>
	</div>`,
	props: {
		menuTitle: { type: String, required: true }
	},
	data() {
		return {
			// states
			templateOpen: null // contains template as object (null = no template open)
		};
	},
	computed: {
		// stores
		capGen: s => s.$store.getters.captions.generic,
		mailTemplateContent: s => s.$store.getters.constants.mailTemplateContent,
		mailTemplateIdMap: s => s.$store.getters.mailTemplateIdMap,
		mailTemplatesSorted: s => s.$store.getters.mailTemplatesSorted
	},
	mounted() {
		this.$store.commit('pageTitle', this.menuTitle);

		if (this.mailTemplatesSorted.length === 0)
			this.get();
	},
	methods: {
		// externals
		getTemplateMailTemplate,

		// presentation
		getTitle(template) {
			let prefix = '';
			switch (template.content) {
				case this.mailTemplateContent.loginInvitation: prefix = this.capGen.invitation; break;
				case this.mailTemplateContent.loginPwReset: prefix = this.capGen.passwordReset; break;
			}
			return `${prefix}: ${template.name}`;
		},

		// actions
		close() {
			this.templateOpen = null;
		},
		open(id) {
			this.templateOpen = id === null
				? this.getTemplateMailTemplate(this.mailTemplateContent.loginPwReset)
				: this.mailTemplateIdMap[id] ?? null;
		},

		// backend calls
		get() {
			ws.send('mailTemplate', 'get', {}, true).then(
				res => this.$store.commit('mailTemplateIdMap', res.payload),
				this.$root.genericError
			);
		}
	}
};
