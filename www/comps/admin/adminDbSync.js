import { getTemplateDbSyncHost } from '../shared/templates.js';
import MyAdminDbSyncHost from './adminDbSyncHost.js';

export default {
	name: 'my-admin-db-sync',
	components: { MyAdminDbSyncHost },
	template: `<div class="admin-db-sync contentBox grow">
		<div class="top">
			<div class="area">
				<img class="icon" src="images/databaseSync.png" />
				<h1>{{ menuTitle }}</h1>
			</div>
		</div>
		<div class="top lower">
			<div class="area">
				<my-button image="add.png"
					@trigger="openHost(null)"
					:active="licenseValid"
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
					v-for="(h,k) in hostIdMap"
					@click="openHost(h.id)"
					:key="h.id"
					:title="h.name"
				>
					<div class="lines">
						<span>{{ h.name }}</span>
						<span class="subtitle">{{ h.dbType }} - {{ h.address }}:{{ h.port }}/{{ h.dbName }}</span>
					</div>
					<my-button image="remove.png"
						v-if="!h.active"
						:active="false"
						:captionTitle="capGen.disabled"
						:naked="true"
					/>
				</div>
			</div>
		</div>

		<my-admin-db-sync-host
			v-if="hostOpen !== null"
			@close="closeHost"
			@makeNew="openHost(null)"
			@reload="get"
			:hostId="hostIdOpen"
			:hostOrg="hostOpen"
			:jobIdMap
			:readonly="!licenseValid"
		/>
	</div>`,
	props: {
		menuTitle: { type: String, required: true }
	},
	data() {
		return {
			// data
			hostIdMap: {},
			jobIdMap: {},

			// states
			hostIdOpen: null, // ID of host to be edited (null = new host)
			hostOpen: null    // contains host as object (null = no host open)
		};
	},
	computed: {
		// stores
		capApp: s => s.$store.getters.captions.admin.dbSync,
		capGen: s => s.$store.getters.captions.generic,
		licenseValid: s => s.$store.getters.licenseValid
	},
	mounted() {
		this.get();
		this.$store.commit('pageTitle', this.menuTitle);
	},
	methods: {
		// externals
		getTemplateDbSyncHost,

		// actions
		closeHost() {
			this.hostOpen = null;
		},
		openHost(id) {
			if (id === null) {
				this.hostIdOpen = null;
				this.hostOpen = this.getTemplateDbSyncHost();
			} else if (this.hostIdMap[id] !== undefined) {
				this.hostIdOpen = id;
				this.hostOpen = this.hostIdMap[id];
			}
		},

		// backend calls
		get() {
			ws.sendMultiple([
				ws.prepare('dbSync', 'getHosts', null),
				ws.prepare('dbSync', 'getJobs', null)
			], true).then(
				res => {
					this.hostIdMap = res[0].payload;
					this.jobIdMap = res[1].payload;
				},
				this.$root.genericError
			);
		}
	}
};
