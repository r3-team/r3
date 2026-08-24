import MyInputDecimal from '../inputDecimal.js';
import { dialogCloseAsk, dialogDeleteAsk } from '../shared/dialog.js';
import { deepIsEqual } from '../shared/generic.js';

export default {
	name: 'my-admin-geo-layer-base',
	components: { MyInputDecimal },
	template: `<div class="app-sub-window under-header at-top with-margin" v-if="isReady" @mousedown.self="closeAsk">

		<div class="contentBox admin-geo-layer-base scroll float">
			<div class="top">
				<div class="area nowrap">
					<img class="icon" src="images/map.png" />
					<h1 class="title">{{ isNew ? capApp.titleNew : capApp.title.replace('{NAME}',layerBase.name) }}</h1>
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
			<div class="content no-padding default-inputs">
				<table class="generic-table-vertical">
					<tbody>
						<tr>
							<td>{{ capGen.name }}*</td>
							<td colspan="2"><input v-model="layerBase.name" :disabled="readonly" v-focus /></td>
						</tr>
						<tr>
							<td>{{ capGen.url }}*</td>
							<td colspan="2"><input class="long" v-model="layerBase.url" :disabled="readonly" /></td>
						</tr>
						<tr>
							<td>{{ capApp.srid }}*</td>
							<td><my-input-decimal v-model="layerBase.srid" :min="0" :allowNull="false" :lengthFract="0" :readonly /></td>
							<td>{{ capApp.sridHint }}</td>
						</tr>
						<tr>
							<td>{{ capGen.parameters }}*</td>
							<td colspan="2">
								<div class="column gap">
									<table>
										<tbody>
											<tr v-for="(v,p) in layerBase.parameters">
												<td><b>{{ p }}</b></td>
												<td><input v-model="layerBase.parameters[p]" :disabled="readonly" /></td>
												<td>
													<my-button image="delete.png"
														@trigger="parameterDelete(p)"
														:active="!readonly"
														:cancel="true"
													/>
												</td>
											</tr>
										</tbody>
									</table>
									<div class="row gap centered">
										<input v-model="parameterNameNew" :disabled="readonly" :placeholder="capGen.parameterNew" />
										<my-button image="add.png"
											@trigger="parameterAdd"
											:active="parameterNameNew !== '' && !readonly"
											:caption="capGen.button.add"
										/>
									</div>
								</div>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>`,
	props: {
		isNew: { type: Boolean, required: true },
		modelValue: { type: Object, required: true },
		readonly: { type: Boolean, required: true }
	},
	emits: ['close', 'makeNew', 'reload'],
	watch: {
		modelValue: {
			handler() { this.reset(); },
			immediate: true
		},
	},
	data() {
		return {
			// inputs
			layerBase: {},
			parameterNameNew: '',

			// states
			isReady: false,
		};
	},
	computed: {
		canSave: s => s.isReady && !s.readonly && s.isChanged
			&& s.layerBase.name !== ''
			&& s.layerBase.srid !== 0
			&& s.layerBase.url !== '',

		// simple
		isChanged: s => !s.deepIsEqual(s.modelValue, s.layerBase),

		// stores
		capApp: s => s.$store.getters.captions.admin.geoLayerBase,
		capGen: s => s.$store.getters.captions.generic
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
		parameterAdd() {
			this.layerBase.parameters[this.parameterNameNew] = '';
			this.parameterNameNew = '';
		},
		parameterDelete(name) {
			delete this.layerBase.parameters[name];
		},
		reloadAndClose() {
			this.$emit('reload');
			this.close();
		},
		reset() {
			this.layerBase = JSON.parse(JSON.stringify(this.modelValue));
			this.isReady = true;
		},

		// backend calls
		del() {
			ws.send('geoLayerBase', 'del', this.layerBase.id, true).then(
				this.reloadAndClose,
				this.$root.genericError
			);
		},
		set() {
			ws.send('geoLayerBase', 'set', this.layerBase, true).then(
				this.reloadAndClose,
				this.$root.genericError
			);
		}
	}
};
