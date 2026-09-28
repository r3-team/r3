import { routeParseParams } from '../shared/router.js';

import MyBuilderPreset from './builderPreset.js';

export default {
	name: 'my-builder-presets',
	components: { MyBuilderPreset },
	template: `<div class="generic-entry-list">
		<div class="entry"
			v-if="!readonly"
			@click="idEdit = null"
			:class="{ clickable:!readonly }"
		>
			<div class="row gap centered">
				<img class="icon" src="images/add.png" />
				<span>{{ capGen.button.new }}</span>
			</div>
		</div>

		<div class="entry clickable"
			@click="idEdit = p.id"
			v-for="p in relation.presets.filter(v => filter === '' || v.name.toLowerCase().includes(filter.toLowerCase()))"
		>
			<my-button
				:active="false"
				:image="p.protected ? 'lock.png' : 'lockOpen.png'"
				:naked="true"
			/>
			<div class="lines">
				<span>{{ p.name }}</span>
				<span class="subtitle">{{ getPreview(p) }}</span>
			</div>
		</div>

		<my-builder-preset
			v-if="idEdit !== false"
			@close="idEdit = false"
			@new="idEdit = null"
			:id="idEdit"
			:key="idEdit"
			:module
			:readonly="readonly"
			:relation="relation"
		/>
	</div>`,
	props: {
		filter: { type: String, required: false, default: '' },
		module: { type: Object, required: true },
		readonly: { type: Boolean, required: true },
		relation: { type: Object, required: true },
	},
	data() {
		return {
			idEdit: false
		};
	},
	computed: {
		capApp: s => s.$store.getters.captions.builder.preset,
		capGen: s => s.$store.getters.captions.generic
	},
	mounted() {
		const params = { presetIdShow: { parse: 'string', value: null } };
		this.routeParseParams(params);

		if (params.presetIdShow.value !== null)
			this.idEdit = params.presetIdShow.value;
	},
	methods: {
		// externals
		routeParseParams,

		// presentation
		getPreview(preset) {
			const items = [];
			for (const v of preset.values) {
				if (v.value !== null && v.value !== '')
					items.push(v.protected ? `[${v.value}]` : v.value);
			}
			const line = items.join(', ');
			return line.length < 50 ? line : `${line.substring(0, 50)}...`;
		}
	}
};
