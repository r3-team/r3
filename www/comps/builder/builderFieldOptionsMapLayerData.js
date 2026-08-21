import MyInputColorWrap from '../inputColorWrap.js';
import { getJoinsIndexMap } from '../shared/query.js';

import MyBuilderCaption from './builderCaption.js';
import MyBuilderIndexAttributeInput from './builderIndexAttributeInput.js';
import MyBuilderOpenForm from './builderOpenForm.js';
import MyBuilderQuery from './builderQuery.js';

export default {
	name: 'my-builder-field-options-map-layer-data',
	components: {
		MyInputColorWrap, MyBuilderCaption, MyBuilderIndexAttributeInput,
		MyBuilderOpenForm, MyBuilderQuery
	},
	template: `<table>
		<tbody>
			<tr>
				<td colspan="2">
					<my-builder-query
						v-model="layer.query"
						:allowChoices="false"
						:allowFixedLimit="false"
						:builderLanguage
						:entityIdMapRef
						:fieldIdMap
						:filtersDisable="['formState','getter','globalSearch']"
						:formId
						:moduleId
						:readonly
					/>
				</td>
			</tr>
			<template v-if="layer.query !== null && layer.query.relationId !== null">
				<tr>
					<td>{{ capGen.title }}</td>
					<td>
						<my-builder-caption
							v-model="layer.captions.fieldMapLayerDataTitle"
							:language="builderLanguage"
							:readonly
						/>
					</td>
				</tr>
				<tr>
					<td>{{ capGen.colorFill }}</td>
					<td>
						<my-input-color-wrap
							v-model="layer.colorFill"
							@dropdown-show="dropdownColor = $event"
							:allowNull="false"
							:readonly
						/>
					</td>
				</tr>
				<tr>
					<td>{{ capGen.attributeGeo }}*</td>
					<td>
						<my-builder-index-attribute-input
							v-model:attributeId="layer.attributeIdData"
							v-model:relationIndex="layer.indexData"
							:attributeContentWhitelist="['geometry']"
							:joins="layer.query.joins"
							:readonly
						/>
					</td>
				</tr>
				<tr>
					<td>{{ capGen.colorFill }}</td>
					<td>
						<my-builder-index-attribute-input
							v-model:attributeId="layer.attributeIdDataColor"
							v-model:relationIndex="layer.indexDataColor"
							:attributeContentWhitelist="['varchar','text']"
							:joins="layer.query.joins"
							:readonly
						/>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.openForm }}</td>
					<td>
						<my-builder-open-form
							v-model="layer.openForm"
							:allowNewRecords="true"
							:joinsIndexMap
							:joinsIndexMapField
							:module
							:readonly
						/>
					</td>
				</tr>
			</template>
			<tr>
				<td colspan="2">
					<my-button image="delete.png"
						@trigger="$emit('remove')"
						:cancel="true"
						:caption="capGen.button.delete"
					/>
				</td>
			</tr>
		</tbody>
	</table>`,
	props: {
		builderLanguage: { type: String, required: true },
		entityIdMapRef: { type: Object, required: true },
		fieldIdMap: { type: Object, required: true },
		formId: { type: String, required: true },
		joinsIndexMap: { type: Object, required: true },
		modelValue: { type: Object, required: true },
		moduleId: { type: String, required: true },
		readonly: { type: Boolean, required: true },
	},
	emits: ['remove', 'update:modelValue'],
	computed: {
		// inputs
		layer: { // this method updates obj directly
			get() { return this.modelValue; },
			set(v) { this.$emit('update:modelValue', v); }
		},

		// simple
		joinsIndexMapField: s => s.layer.query !== null ? s.getJoinsIndexMap(s.layer.query.joins) : {},
		module: s => s.moduleIdMap[s.moduleId],

		// stores
		capApp: s => s.$store.getters.captions.builder.form,
		capGen: s => s.$store.getters.captions.generic,
		moduleIdMap: s => s.$store.getters['schema/moduleIdMap'],
	},
	methods: {
		// externals
		getJoinsIndexMap
	}
};
