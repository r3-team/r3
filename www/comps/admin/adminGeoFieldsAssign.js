import { getCaption } from '../shared/language.js';
import MyAdminGeoFieldAssign from './adminGeoFieldAssign.js';

export default {
	name: 'my-admin-geo-fields-asign',
	components: { MyAdminGeoFieldAssign },
	template: `<div class="admin-geo-fields-assign contentBox grow">
		<div class="top">
			<div class="area">
				<img class="icon" src="images/map.png" />
				<h1>{{ menuTitle }}</h1>
			</div>
		</div>
		<div class="top lower">
			<div class="area">
				<my-button image="refresh.png"
					@trigger="get"
					:caption="capGen.button.refresh"
				/>
			</div>
		</div>

		<div class="content grow">
			<div class="generic-entry-list wide">
				<template v-for="(fields,formId) in formIdMapFields">
					<div class="entry clickable"
						v-for="f in fields"
						@click="open(formId,f.id)"
						:key="f.id"
						:title="getFieldTitle(formId,f)"
					>
						<div class="lines">
							<span>{{ getFieldTitle(formId,f) }}</span>
						</div>
					</div>
				</template>
			</div>
		</div>

		<my-admin-geo-field-assign
			v-if="fieldIdOpen !== null"
			@close="close"
			:fieldIdOpen
			:layersBase
		/>
	</div>`,
	props: {
		menuTitle: { type: String, required: true }
	},
	data() {
		return {
			fieldIdOpen: null,
			formIdOpen: null,
			layersBase: [],
		};
	},
	computed: {
		formIdMapFields: s => {
			const out = {};
			const parseFields = (formId, fields) => {
				for (const f of fields) {
					switch (f.content) {
						case "container":
							parseFields(formId, f.fields);
							continue;
						case "tabs":
							for (const t of f.tabs) {
								parseFields(formId, t.fields);
							}
							continue;
						case "map":
							if (out[formId] === undefined)
								out[formId] = [];

							out[formId].push(f);
					}
				}
			};
			for (const modId in s.moduleIdMap) {
				for (const form of s.moduleIdMap[modId].forms) {
					parseFields(form.id, form.fields);
				}
			}
			return out;
		},

		// stores
		attributeIdMap: s => s.$store.getters['schema/attributeIdMap'],
		capGen: s => s.$store.getters.captions.generic,
		formIdMap: s => s.$store.getters['schema/formIdMap'],
		moduleIdMap: s => s.$store.getters['schema/moduleIdMap'],
	},
	mounted() {
		this.get();
		this.$store.commit('pageTitle', this.menuTitle);
	},
	methods: {
		// externals
		getCaption,

		// presentation
		getFieldTitle(formId, field) {
			const form = this.formIdMap[formId];
			const formTitle = this.getCaption('formTitle', form.moduleId, form.id, form.captions);
			let fieldTitle = this.getCaption('fieldTitle', form.moduleId, field.id, field.captions);

			if (fieldTitle === '' && field.content === 'data') {
				const atr = this.attributeIdMap[field.attributeId];
				fieldTitle = this.getCaption('attributeTitle', form.moduleId, field.attributeId, atr.captions, atr.name);
			}
			return `${formTitle} - ${fieldTitle}`;
		},

		// actions
		close() {
			this.fieldIdOpen = null;
		},
		open(formId, fieldId) {
			this.formIdOpen = formId;
			this.fieldIdOpen = fieldId;
		},

		// backend calls
		get() {
			ws.send('geoLayerBase', 'get', null, true).then(
				res => { this.layersBase = res.payload; },
				this.$root.genericError
			);
		}
	}
};
