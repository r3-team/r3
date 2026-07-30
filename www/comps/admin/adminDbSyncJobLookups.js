import { getPgIndexTitle } from '../shared/schema.js';

const MyAdminDbSyncJobLookupItem = {
	name: "my-admin-db-sync-job-lookup-item",
	template: `<div class="lookup-item">
		<span>{{ join.index + ') ' + relation.name }}</span>
		<select v-model="value" :disabled="readonly">
			<option value="">-</option>
			<option v-for="ind in pgIndexes" :value="ind.id">{{ getPgIndexTitle(ind.id) }}</option>
		</select>
	</div>`,
	props: {
		join: { type: Object, required: true },
		modelValue: { type: [String, null], required: true },
		readonly: { type: Boolean, required: true },
	},
	emits: ["update:modelValue"],
	computed: {
		value: {
			get() { return this.modelValue === null ? '' : this.modelValue; },
			set(v) { this.$emit("update:modelValue", v === '' ? null : v); },
		},
		pgIndexes: s => s.relation.indexes.filter((v) => v.noDuplicates),
		relation: s => s.relationIdMap[s.join.relationId],

		// stores
		relationIdMap: s => s.$store.getters["schema/relationIdMap"]
	},
	methods: {
		getPgIndexTitle,
	},
};

export default {
	name: 'my-admin-db-sync-job-lookups',
	components: { MyAdminDbSyncJobLookupItem },
	template: `<div class="admin-db-sync-job-lookups column nowrap">
		<my-admin-db-sync-job-lookup-item
			@update:modelValue="setValueForJoin(j,$event)"
			v-for="j in joins"
			:join="j"
			:key="j.index"
			:modelValue="getValueForJoin(j)"
			:readonly
		/>
	</div>`,
	props: {
		joins: { type: Array, required: true },
		modelValue: { type: Array, required: true }, // [{pgIndexId:123,index:0},{...}]
		readonly: { type: Boolean, required: true }
	},
	emits: ['update:modelValue'],
	methods: {
		getValueForJoin(join) {
			for (const lookup of this.modelValue) {
				if (lookup.index === join.index)
					return lookup.pgIndexId;
			}
			return null;
		},
		setValueForJoin(join, pgIndexId) {
			const lookups = JSON.parse(JSON.stringify(this.modelValue));
			for (let i = 0, j = lookups.length; i < j; i++) {
				if (lookups[i].index === join.index) {
					lookups.splice(i, 1);
					break;
				}
			}

			if (pgIndexId !== null)
				lookups.push({
					pgIndexId: pgIndexId,
					index: join.index
				});

			this.$emit('update:modelValue', lookups);
		}
	}
};
