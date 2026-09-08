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
					v-for="(t,k) in templateIdMap"
					@click="open(t.id)"
					:key="t.id"
					:title="t.name"
				>
					<div class="lines">
						<span>{{ t.name }}</span>
					</div>
				</div>
			</div>
		</div>

		<my-admin-mail-template
			v-if="templateOpen !== null"
			@close="close"
			@makeNew="open(null)"
			@reload="get"
			:templateId="templateIdOpen"
			:templateOrg="templateOpen"
		/>
	</div>`,
	props: {
		menuTitle: { type: String, required: true }
	},
	data() {
		return {
			// data
			templateIdMap: {},

			// states
			templateIdOpen: null, // ID of template to be edited (null = new template)
			templateOpen: null    // contains template as object (null = no template open)
		};
	},
	computed: {
		// stores
		capGen: s => s.$store.getters.captions.generic
	},
	mounted() {
		this.get();
		this.$store.commit('pageTitle', this.menuTitle);
	},
	methods: {
		// externals
		getTemplateMailTemplate,

		// actions
		close() {
			this.templateOpen = null;
		},
		open(id) {
			if (id === null) {
				this.templateIdOpen = null;
				this.templateOpen = this.getTemplateMailTemplate();
			} else if (this.templateIdMap[id] !== undefined) {
				this.templateIdOpen = id;
				this.templateOpen = this.templateIdMap[id];
			}
		},

		// backend calls
		get() {
			ws.send('mailTemplate', 'get', {}, true).then(
				res => this.templateIdMap = res.payload,
				this.$root.genericError
			);
		}
	}
};
