import MyCodeEditor from '../codeEditor.js';
import { getValueFromJson, setValueInJson } from '../shared/builder.js';
import MyBuilderFieldOptionsChartSerie from './builderFieldOptionsChartSerie.js';

export default {
	name: 'my-builder-field-options-chart',
	components: {
		MyBuilderFieldOptionsChartSerie,
		MyCodeEditor
	},
	template: `
		<tr>
			<td>{{ capApp.axisType }} X</td>
			<td>
				<select v-model="axisTypeX">
					<option value="category">{{ capApp.axisTypeCategory }}</option>
					<option value="log">{{ capApp.axisTypeLog }}</option>
					<option value="time">{{ capApp.axisTypeTime }}</option>
					<option value="value">{{ capApp.axisTypeValue }}</option>
				</select>
			</td>
		</tr>
		<tr>
			<td>{{ capApp.axisType }} Y</td>
			<td>
				<select v-model="axisTypeY">
					<option value="category">{{ capApp.axisTypeCategory }}</option>
					<option value="log">{{ capApp.axisTypeLog }}</option>
					<option value="time">{{ capApp.axisTypeTime }}</option>
					<option value="value">{{ capApp.axisTypeValue }}</option>
				</select>
			</td>
		</tr>

		<!-- chart series -->
		<tr>
			<td>{{ capApp.series }}</td>
			<td class="minimum">
				<my-button image="add.png"
					@trigger="serieAdd"
					:caption="capGen.button.add"
				/>
			</td>
		</tr>
		<my-builder-field-options-chart-serie class="chart-option-serie"
			v-for="(s,i) in series"
			:columns="columns"
			:modelValue="s"
			@remove="serieSet(i,null)"
			@update:modelValue="serieSet(i,$event)"
		/>

		<!-- option input -->
		<tr>
			<td colspan="999">
				<p v-html="capApp.help"></p>
				<div class="chart-option" :class="{error:jsonBad}">
					<my-code-editor mode="json"
						@update:modelValue="optionInput($event)"
						:modelValue="jsonInput"
					/>
				</div>
			</td>
		</tr>
	`,
	props: {
		columns: { type: Array, required: true },
		modelValue: { type: String, required: true }
	},
	emits: ['update:modelValue'],
	data() {
		return {
			jsonBad: false,      // JSON validity check failed
			jsonFirstLoad: true, // prettify JSON input on first load
			jsonInput: ''        // separated to execute JSON validity checking
		};
	},
	computed: {
		axisTypeX: {
			get() { return this.getValueFromJson(this.option, ['xAxis', 'type'], 'category'); },
			set(v) { this.option = this.setValueInJson(this.option, ['xAxis', 'type'], v); }
		},
		axisTypeY: {
			get() { return this.getValueFromJson(this.option, ['yAxis', 'type'], 'value'); },
			set(v) { this.option = this.setValueInJson(this.option, ['yAxis', 'type'], v); }
		},
		series: {
			get() { return this.getValueFromJson(this.option, ['series'], []); },
			set(v) { }
		},
		option: {
			get() { return this.modelValue; },
			set(v) { this.$emit('update:modelValue', v); }
		},

		// stores
		capApp: s => s.$store.getters.captions.builder.form.chart,
		capGen: s => s.$store.getters.captions.generic
	},
	watch: {
		option: {
			handler(v) {
				if (this.jsonFirstLoad) {
					this.jsonInput = JSON.stringify(JSON.parse(v), null, 2);
					this.jsonFirstLoad = false;
					return;
				}
				this.jsonInput = v;
			},
			immediate: true
		}
	},
	methods: {
		// externals
		getValueFromJson,
		setValueInJson,

		// actions
		optionInput(v) {
			try {
				let o = JSON.parse(v);

				this.option = v;
				this.jsonBad = false;
			}
			catch (e) {
				this.jsonBad = true;
			}
		},
		serieAdd() {
			const series = this.getValueFromJson(this.option, ['series'], []);
			series.push({
				type: 'bar',
				encode: { tooltip: -1, x: -1, y: -1 }
			});
			this.option = this.setValueInJson(this.option, ['series'], series);
		},
		serieSet(i, value) {
			const series = this.getValueFromJson(this.option, ['series'], []);

			if (value === null) series.splice(i, 1);
			else series[i] = value;

			this.option = this.setValueInJson(this.option, ['series'], series);
		}
	}
};
