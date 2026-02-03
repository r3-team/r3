import {getTemplateOpenDoc} from '../shared/builderTemplate.js';
import {
	getDependentDocs,
	getItemTitleRelation
} from '../shared/builder.js';

export default {
	name:'my-builder-open-doc',
	template:`
		<select v-model="doc" :disabled="readonly">
			<option value="">-</option>
			<option v-for="d in docsAvailNoQuery" :value="'0_' + d.id">{{ d.name }}</option>
			<optgroup
				v-for="j in joinsIndexMap"
				:label="getItemTitleRelation(j.relationId,j.index)"
			>
				<option
					v-for="d in docsAvail.filter(v => v.query !== null && v.query.relationId === j.relationId)"
					:value="j.index + '_' + d.id"
				>{{ d.name }}</option>
			</optgroup>
		</select>
	`,
	props:{
		joinsIndexMap:{ type:Object,        required:true },
		module:       { type:Object,        required:true },
		modelValue:   { type:[Object,null], required:true },
		readonly:     { type:Boolean,       required:true }
	},
	emits:['update:modelValue'],
	computed:{
		// inputs
		doc:{
			get()  { return this.active ? `${this.modelValue.relationIndexOpen}_${this.modelValue.docIdOpen}` : ''; },
			set(v) {
				if(v === '')
					return this.$emit('update:modelValue',null);

				const parts = v.split('_');
				if(parts.length !== 2)
					return;

				let o = this.active ? JSON.parse(JSON.stringify(this.modelValue)) : this.getTemplateOpenDoc();
				o.relationIndexOpen = parseInt(parts[0]);
				o.docIdOpen         = parts[1];
				this.$emit('update:modelValue',o);
			}
		},

		// simple
		active:          s => s.modelValue !== null,
		docsAvail:       s => s.getDependentDocs(s.module),
		docsAvailNoQuery:s => s.docsAvail.filter(v => v.query === null)
	},
	methods:{
		// externals
		getDependentDocs,
		getItemTitleRelation,
		getTemplateOpenDoc
	}
};