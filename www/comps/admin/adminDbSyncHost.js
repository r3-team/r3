import MyInputDecimal from '../inputDecimal.js';
import { dialogCloseAsk, dialogDeleteAsk } from '../shared/dialog.js';
import { deepIsEqual } from '../shared/generic.js';
import { getTemplateDbSyncJob } from '../shared/templates.js';
import MyAdminDbSyncJob from './adminDbSyncJob.js';
import MyAdminDbSyncJobLogs from './adminDbSyncJobLogs.js';

export default {
	name: 'my-admin-db-sync-host',
	components: { MyAdminDbSyncJob, MyAdminDbSyncJobLogs, MyInputDecimal },
	template: `<div class="app-sub-window under-header at-top with-margin" v-if="isReady" @mousedown.self="closeAsk">

		<div class="contentBox admin-db-sync-host scroll float">
			<div class="top">
				<div class="area nowrap">
					<img class="icon" src="images/databaseSync.png" />
					<h1 class="title">{{ isNew ? capApp.titleNew : capApp.title.replace('{NAME}',host.name) }}</h1>
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
						:active="!readonly"
						:caption="capGen.button.new"
					/>
				</div>
				<div class="area">
					<my-button image="delete.png"
						v-if="!isNew"
						@trigger="dialogDeleteAsk(del,capApp.dialog.delete)"
						:active="!readonly"
						:cancel="true"
						:caption="capGen.button.delete"
					/>
				</div>
			</div>

			<div class="row wrap">
				<!-- host details -->
				<div class="content no-padding default-inputs">
					<table class="generic-table-vertical">
						<tbody>
							<tr>
								<td>{{ capGen.name }}*</td>
								<td><input v-model="host.name" :disabled="readonly" v-focus /></td>
							</tr>
							<tr>
								<td>{{ capGen.active }}*</td>
								<td><my-bool v-model="host.active" :readonly /></td>
							</tr>
							<tr>
								<td>{{ capGen.comments }}</td>
								<td><textarea v-model="host.comment" :disabled="readonly" /></td>
							</tr>
							<tr>
								<td>{{ capApp.address }}*</td>
								<td>
									<div class="row gap">
										<input v-model="host.address" :disabled="readonly" />
										<my-input-decimal class="short"
											v-model="host.port"
											:min="0"
											:max="65535"
											:allowNull="false"
											:lengthFract="0"
											:readonly
										/>
									</div>
								</td>
							</tr>
							<tr>
								<td>{{ capGen.username }}*</td>
								<td><input v-model="host.username" :disabled="readonly" /></td>
							</tr>
							<tr>
								<td>{{ capGen.password }}*</td>
								<td><input type="password" v-model="host.password" :disabled="readonly" /></td>
							</tr>
							<tr>
								<td>{{ capApp.dbName }}*</td>
								<td><input v-model="host.dbName" :disabled="readonly" /></td>
							</tr>
							<tr>
								<td>{{ capApp.dbType }}*</td>
								<td>
									<select v-model="host.dbType" :disabled="readonly">
										<option value="pgsql">PostgreSQL</option>
										<option value="mysql">MySQL</option>
										<option value="mssql">MSSQL</option>
										<option value="firebird">Firebird</option>
										<option value="clickhouse">ClickHouse</option>
									</select>
								</td>
							</tr>
						</tbody>
					</table>
				</div>

				<!-- host jobs -->
				<div class="content flex grow column gap" v-if="!isNew">
					<div class="row gap centered space-between">
						<my-label image="cogMultiple.png" :caption="capGen.jobs" />
						<my-button image="add.png"
							v-if="!readonly"
							@trigger="jobOpenNew"
							:caption="capGen.button.create"
						/>
					</div>
					<table class="generic-table bright admin-db-sync-host-table">
						<thead>
							<tr>
								<th>{{ capGen.name }}</th>
								<th>{{ capGen.job }}</th>
								<th>{{ capGen.relationBase }}</th>
							</tr>
						</thead>
						<tbody>
							<tr v-if="jobs.length !== 0" v-for="j in jobs">
								<td>
									<div class="row gap centered">
										<my-button image="open.png" @trigger="jobOpen(j.id)" />
										<my-label image="remove.png" v-if="!j.active" />
										<span>{{ j.name }}</span>
									</div>
								</td>
								<td>{{ capApp.jobType[j.jobType] }}</td>
								<td v-if="j.joins.length !== 0">{{ relationIdMap[j.joins[0].relationId].name }}</td>
							</tr>
							<tr v-if="jobs.length === 0">
								<td colspan="999">{{ capGen.nothingThere }}</td>
							</tr>
						</tbody>
					</table>
				</div>

				<!-- host job logs -->
				<my-admin-db-sync-job-logs
					v-if="!isNew"
					:hostId
					:jobIdMap
				/>
			</div>
		</div>

		<my-admin-db-sync-job
			v-if="jobEdit !== false"
			@close="jobClose"
			@open="jobOpen($event)"
			@makeNew="jobOpenNew"
			@reload="$emit('reload')"
			:dbType="host.dbType"
			:hostName="host.name"
			:isNew="jobNew"
			:jobOrg="jobEdit"
			:readonly
		/>
	</div>`,
	props: {
		hostId: { type: [String, null], required: true },
		hostOrg: { type: Object, required: true },
		jobIdMap: { type: Object, required: true },
		readonly: { type: Boolean, required: true }
	},
	emits: ['close', 'makeNew', 'reload'],
	watch: {
		hostId: {
			handler() { this.reset(); },
			immediate: true
		},
	},
	data() {
		return {
			// inputs
			host: {},

			// states
			jobIdEdit: null, // ID of job to be edited (null = new job or closed)
			jobNew: false,
			isReady: false,
		};
	},
	computed: {
		canSave: s => s.isReady && !s.readonly && s.isChanged
			&& s.host.name !== ''
			&& s.host.address !== ''
			&& s.host.dbName !== ''
			&& s.host.username !== ''
			&& s.host.password !== '',
		jobs: s => {
			const out = [];
			for (const k in s.jobIdMap) {
				if (s.jobIdMap[k].hostId === s.hostId)
					out.push(s.jobIdMap[k]);
			}
			return out;
		},

		// simple
		isChanged: s => !s.deepIsEqual(s.hostOrg, s.host),
		isNew: s => s.hostId === null,
		jobEdit: s => {
			if (!s.jobNew && s.jobIdEdit === null) return false;
			if ((s.jobNew && s.jobIdEdit === null) || s.jobIdMap[s.jobIdEdit] === undefined) return s.getTemplateDbSyncJob(s.hostId);
			return s.jobIdMap[s.jobIdEdit];
		},

		// stores
		capApp: s => s.$store.getters.captions.admin.dbSync,
		capGen: s => s.$store.getters.captions.generic,
		relationIdMap: s => s.$store.getters['schema/relationIdMap']
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
		getTemplateDbSyncJob,

		// actions
		closeAsk() {
			this.dialogCloseAsk(this.close, this.isChanged);
		},
		close() {
			this.$emit('close');
		},
		jobClose() {
			this.jobIdEdit = null;
			this.jobNew = false;
		},
		jobOpen(id) {
			this.jobIdEdit = id;
			this.jobNew = false;
		},
		jobOpenNew() {
			this.jobIdEdit = null;
			this.jobNew = true;
		},
		reloadAndClose() {
			ws.send('dbSync', 'informChanged', {}, true).then(
				() => {
					this.$emit('reload');
					this.close();
				},
				this.$root.genericError
			);
		},
		reset() {
			this.host = JSON.parse(JSON.stringify(this.hostOrg));
			this.isReady = true;
		},

		// backend calls
		del() {
			ws.send('dbSync', 'delHost', this.hostId, true).then(
				this.reloadAndClose,
				this.$root.genericError
			);
		},
		set() {
			if (!this.canSave)
				return;

			ws.send('dbSync', 'setHost', this.host, true).then(
				this.reloadAndClose,
				this.$root.genericError
			);
		}
	}
};
