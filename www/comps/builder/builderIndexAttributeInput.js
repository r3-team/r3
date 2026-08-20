import { getDetailsFromIndexAttributeId, getIndexAttributeId } from '../shared/attribute.js';

export default {
	name: 'my-builder-index-attribute-input',
	components: {},
	template: `<select
		@input="setIndexAttribute($event.target.value)"
		:disabled="readonly"
		:value="attributeId === null ? '' : getIndexAttributeId(relationIndex,attributeId,false,null)"
	>
		<option value="">-</option>
		<optgroup v-for="j in joins" :label="j.index+' '+relationIdMap[j.relationId].name">
			<option
				v-for="a in relationIdMap[j.relationId].attributes.filter(v => attributeContentWhitelist === null || attributeContentWhitelist.includes(v.content))"
				:value="getIndexAttributeId(j.index,a.id,false,null)"
			>
				{{ a.name }}
			</option>
		</optgroup>
	</select>`,
	props: {
		attributeId: { type: [String, null], required: true },
		attributeContentWhitelist: { type: [Array, null], required: false, default: null },
		joins: { type: Array, required: true },
		readonly: { type: Boolean, required: false, default: false },
		relationIndex: { type: [Number, null], required: true },
	},
	emits: ['update:attributeId', 'update:relationIndex'],
	computed: {
		// stores
		relationIdMap: s => s.$store.getters['schema/relationIdMap'],
	},
	methods: {
		// externals
		getDetailsFromIndexAttributeId,
		getIndexAttributeId,

		// actions
		setIndexAttribute(indexAttributeId) {
			if (indexAttributeId === '') {
				this.$emit('update:attributeId', null);
				this.$emit('update:relationIndex', 0);
				return;
			}
			const v = this.getDetailsFromIndexAttributeId(indexAttributeId);
			this.$emit('update:attributeId', v.attributeId);
			this.$emit('update:relationIndex', v.index);
		}
	}
};
