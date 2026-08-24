import MyInputDecimal from '../inputDecimal.js';
import { dialogCloseAsk, dialogDeleteAsk } from '../shared/dialog.js';
import { deepIsEqual } from '../shared/generic.js';

export default {
	name: 'my-admin-geo-field-assign',
	components: { MyInputDecimal },
	template: `<div class="app-sub-window under-header at-top with-margin" v-if="isReady" @mousedown.self="closeAsk">

		<div class="contentBox admin-geo-field-assign scroll float">
			<div class="top">
				<div class="area nowrap">
					<img class="icon" src="images/map.png" />
					<h1 class="title">{{ capApp.title }}</h1>
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
						:caption="capGen.button.save"
					/>
					<my-button image="refresh.png"
						@trigger="get"
						:active="isChanged"
						:caption="capGen.button.refresh"
					/>
				</div>
			</div>
			<div class="content no-padding default-inputs">
				<table class="generic-table-vertical">
					<tbody>
						<tr>
							<td>{{ capApp.srid }}*</td>
							<td><my-input-decimal v-model="fieldAssign.srid" :min="0" :allowNull="false" :lengthFract="0" :readonly /></td>
							<td>{{ capApp.sridHint }}</td>
						</tr>
						<tr>
							<td>{{ capApp.coordinates }}*</td>
							<td colspan="2">
								<my-input-decimal class="short" v-model="fieldAssign.coordLat" :min="0" :allowNull="false" :lengthFract="5" :readonly />
								<my-input-decimal class="short" v-model="fieldAssign.coordLon" :min="0" :allowNull="false" :lengthFract="5" :readonly />
							</td>
						</tr>
						<tr>
							<td>{{ capApp.zoom }}*</td>
							<td colspan="2"><my-input-decimal class="short" v-model="fieldAssign.zoom" :min="0" :allowNull="false" :lengthFract="1" :readonly /></td>
						</tr>
						<tr>
							<td>{{ capApp.layerBaseIds }}</td>
							<td colspan="2">
								<div class="column gap">
									<div class="row gap centered" v-for="id in fieldAssign.layerBaseIds.filter(v => layerBaseIdMap[v] !== undefined)">
										<span>{{ layerBaseIdMap[id].name }}</span>
										<my-button
											@trigger="layerToggleHide(id)"
											:image="fieldAssign.layerBaseIdsHidden.includes(id) ? 'visible0.png' : 'visible1.png'"
											:naked="true"
										/>
										<my-button image="cancel.png"
											@trigger="layerDelete(id)"
											:naked="true"
										/>
									</div>
									<select @input="layerAdd($event.target.value)" :value="layerBase">
										<option value="">- {{ capGen.button.add }} -</option>
										<option v-for="l in layersBaseUnused" :value="l.id">{{ l.name }}</option>
									</select>
								</div>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>`,
	props: {
		fieldIdOpen: { type: String, required: true },
		layersBase: { type: Array, required: true },
		readonly: { type: Boolean, required: true }
	},
	emits: ['close'],
	data() {
		return {
			// inputs
			fieldAssign: {},
			fieldAssignOrg: {},
			layerBase: '',

			// states
			isReady: false,
		};
	},
	computed: {
		layerBaseIdMap: s => {
			const out = {};
			s.layersBase.forEach(v => { out[v.id] = v });
			return out;
		},

		// simple
		canSave: s => s.isReady && !s.readonly && s.isChanged && s.fieldAssign.srid !== 0,
		isChanged: s => !s.deepIsEqual(s.fieldAssign, s.fieldAssignOrg),
		layersBaseUnused: s => s.layersBase.filter(v => !s.fieldAssign.layerBaseIds.includes(v.id)),

		// stores
		capApp: s => s.$store.getters.captions.admin.geoFieldAssign,
		capGen: s => s.$store.getters.captions.generic
	},
	mounted() {
		this.$store.commit('keyDownHandlerSleep');
		this.$store.commit('keyDownHandlerAdd', { fnc: this.set, key: 's', keyCtrl: true });
		this.$store.commit('keyDownHandlerAdd', { fnc: this.closeAsk, key: 'Escape' });

		this.get();
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
		layerAdd(id) {
			if (id === '')
				return;

			if (!this.fieldAssign.layerBaseIds.includes(id))
				this.fieldAssign.layerBaseIds.push(id);

			this.layerBase = '';
		},
		layerDelete(id) {
			const pos = this.fieldAssign.layerBaseIds.indexOf(id);
			if (pos !== -1)
				this.fieldAssign.layerBaseIds.splice(pos, 1);
		},
		layerToggleHide(id) {
			const pos = this.fieldAssign.layerBaseIdsHidden.indexOf(id);
			if (pos === -1) this.fieldAssign.layerBaseIdsHidden.push(id);
			else this.fieldAssign.layerBaseIdsHidden.splice(pos, 1);
		},

		// backend calls
		get() {
			ws.send('geoFieldAssign', 'get', this.fieldIdOpen, true).then(
				res => {
					this.fieldAssign = JSON.parse(JSON.stringify(res.payload));
					this.fieldAssignOrg = JSON.parse(JSON.stringify(res.payload));
					this.isReady = true;
				},
				this.$root.genericError
			);
		},
		set() {
			ws.send('geoFieldAssign', 'set', {
				fieldId: this.fieldIdOpen,
				fieldAssign: this.fieldAssign,
			}, true).then(
				this.close,
				this.$root.genericError
			);
		}
	}
};
