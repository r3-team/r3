export default {
	name: 'my-admin-db-sync-job-load-preview',
	template: `<div class="app-sub-window under-header at-top with-margin" @mousedown.self="close">

		<div class="contentBox admin-db-sync-job-load-preview scroll float">
			<div class="top lower">
				<div class="area">
					<my-label image="databaseVisible1.png" :caption="capGen.preview" />
				</div>
				<div class="area">
					<span>{{ capGen.results.replace('{CNT}',rows.length) }}</span>
				</div>
				<div class="area">
					<my-button image="cancel.png"
						@trigger="close"
						:cancel="true"
					/>
				</div>
			</div>

			<div class="content no-padding">
				<table>
					<thead>
						<tr>
							<th></th>
							<th v-for="i in expressionCount">{{ capGen.expression }} {{ i }}</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="(r,i) in rows">
							<td>L{{ i+1 }}</td>
							<td v-for="v in r">{{ v }}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>`,
	emits: ['close'],
	props: {
		expressionCount: { type: Number, required: true },
		rows: { type: Array, required: true },
	},
	computed: {
		// stores
		capGen: s => s.$store.getters.captions.generic
	},
	mounted() {
		this.$store.commit('keyDownHandlerSleep');
		this.$store.commit('keyDownHandlerAdd', { fnc: this.close, key: 'Escape', });
	},
	unmounted() {
		this.$store.commit('keyDownHandlerDel', this.close);
		this.$store.commit('keyDownHandlerWake');
	},
	methods: {
		close() {
			this.$emit('close');
		}
	}
};
