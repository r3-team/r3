import { getItemTitle, getValueFromJson, setValueInJson } from '../shared/builder.js';

export default {
	name: 'my-builder-field-options-chart-serie',
	template: `<tr>
		<td colspan="999">
			<div class="line">
				<select v-model="type">
					<option value="bar"    >{{ capApp.serieTypeBar }}</option>
					<option value="line"   >{{ capApp.serieTypeLine }}</option>
					<option value="pie"    >{{ capApp.serieTypePie }}</option>
					<option value="scatter">{{ capApp.serieTypeScatter }}</option>
				</select>
				<select v-model="columnX">
					<option disabled :value="-1">{{ capApp.serieColumnX }}</option>
					<option v-for="(c,i) in columns" :value="i" >
						{{ getItemTitle(c.attributeId,c.index,false,null) }}
					</option>
				</select>
				<select v-model="columnY">
					<option disabled :value="-1">{{ capApp.serieColumnY }}</option>
					<option v-for="(c,i) in columns" :value="i" >
						{{ getItemTitle(c.attributeId,c.index,false,null) }}
					</option>
				</select>
				<select v-model="tooltip">
					<option disabled :value="-1">{{ capApp.serieColumnTooltip }}</option>
					<option v-for="(c,i) in columns" :value="i" >
						{{ getItemTitle(c.attributeId,c.index,false,null) }}
					</option>
				</select>
				<my-button image="cancel.png"
					@trigger="$emit('remove')"
					:cancel="true"
					:naked="true"
				/>
			</div>
		</td>
	</tr>`,
	props: {
		columns: { type: Array, required: true },
		modelValue: { type: Object, required: true }
	},
	emits: ['remove', 'update:modelValue'],
	computed: {
		columnX: {
			get() { return this.get(['encode', this.type === 'pie' ? 'itemName' : 'x'], 0); },
			set(v) { this.set(['encode', this.type === 'pie' ? 'itemName' : 'x'], v); }
		},
		columnY: {
			get() { return this.get(['encode', this.type === 'pie' ? 'value' : 'y'], 0); },
			set(v) { this.set(['encode', this.type === 'pie' ? 'value' : 'y'], v); }
		},
		serie: {
			get() { return this.modelValue; },
			set(v) { this.$emit('update:modelValue', v); }
		},
		tooltip: {
			get() { return this.get(['encode', 'tooltip'], 0); },
			set(v) { this.set(['encode', 'tooltip'], v); }
		},
		type: {
			get() { return this.get(['type'], 'bar'); },
			set(v) { this.set(['type'], v); }
		},

		// stores
		relationIdMap: s => s.$store.getters['schema/relationIdMap'],
		attributeIdMap: s => s.$store.getters['schema/attributeIdMap'],
		capApp: s => s.$store.getters.captions.builder.form.chart
	},
	methods: {
		// externals
		getItemTitle,
		getValueFromJson,
		setValueInJson,

		get(nameChain, valueFallback) {
			return this.getValueFromJson(
				JSON.stringify(this.serie), nameChain, valueFallback
			);
		},
		set(nameChain, value) {
			const s = JSON.parse(JSON.stringify(this.serie));

			// apply encoding fix (differences between serie types)
			if (nameChain.length === 1 && nameChain[0] === 'type') {
				if (value === 'pie')
					s.encode = { itemName: -1, tooltip: -1, value: -1 };
				else
					s.encode = { tooltip: -1, x: -1, y: -1 };
			}

			this.$emit('update:modelValue', JSON.parse(
				this.setValueInJson(JSON.stringify(s), nameChain, value)
			));
		}
	}
};
