import MyInputOffset from '../inputOffset.js';
import { getUnixFormat } from '../shared/time.js';

export default {
	name: 'my-admin-db-sync-job-logs',
	components: { MyInputOffset },
	template: `<div class="content flex wrap grow column gap">
		<div class="row nowrap centered gap-large space-between">
			<my-label image="fileText.png" :caption="capGen.jobHistory" />
			<my-input-offset
				@input="offset = $event;get()"
				:caption="true"
				:limit="limit"
				:offset="offset"
				:total="total"
			/>
			<my-button image="refresh.png"
				@trigger="get"
				:caption="capGen.button.refresh"
			/>
		</div>
		<div class="admin-db-sync-job-logs">
			<table class="generic-table bright sticky-top">
				<thead>
					<tr class="title">
						<th>{{ capGen.job }}</th>
						<th>{{ capGen.date }}</th>
						<th>{{ capGen.recordCount }}</th>
					</tr>
				</thead>
				<tbody>
					<tr v-if="logs.length === 0">
						<td colspan="999">{{ capGen.nothingThere }}</td>
					</tr>

					<tr v-for="l in logs.filter(v => jobIdMap[v.jobId] !== undefined)">
						<td>{{ jobIdMap[l.jobId].name }}</td>
						<td>{{ displayDate(l.dateRan) }}</td>
						<td>{{ l.recordsCount }}</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>`,
	props: {
		hostId: { type: String, required: true },
		jobIdMap: { type: Object, required: true }
	},
	data() {
		return {
			// inputs
			limit: 10,
			offset: 0,
			total: 0,

			// data
			logs: []
		};
	},
	computed: {
		// stores
		settings: s => s.$store.getters.settings,
		capGen: s => s.$store.getters.captions.generic
	},
	mounted() {
		this.get();
	},
	methods: {
		// externals
		getUnixFormat,

		// presentation
		displayDate(date) {
			const format = [this.settings.dateFormat, 'H:i:S'];
			return this.getUnixFormat(date, format.join(' '));
		},

		// backend calls
		get() {
			ws.send('dbSync', 'getJobLogs', {
				byHostId: this.hostId,
				limit: this.limit,
				offset: this.offset
			}, true).then(
				res => {
					this.logs = res.payload.logs;
					this.total = res.payload.total;
				},
				this.$root.genericError
			);
		}
	}
};
