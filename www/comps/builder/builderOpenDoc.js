import {isAttributeFiles}   from '../shared/attribute.js';
import {getTemplateOpenDoc} from '../shared/builderTemplate.js';
import {
	getDependentDocs,
	getItemTitle,
	getItemTitleRelation
} from '../shared/builder.js';

export default {
	name:'my-builder-open-doc',
	template:`<div class="column gap">
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
		<div class="row gap centered">
			<span>{{ capGen.button.addToField }}</span>
			<select class="auto" v-if="active" v-model="fieldIdAddTo">
				<option value="">-</option>
				<option
					v-for="f in dataFields.filter(v => isAttributeFiles(attributeIdMap[v.attributeId].content))"
					:value="f.id"
				>{{ getItemTitle(f.attributeId,f.index) }}</option>
			</select>
		</div>
	</div>`,
	props:{
		dataFields:   { type:Array,         required:true },
		joinsIndexMap:{ type:Object,        required:true },
		modelValue:   { type:[Object,null], required:true },
		module:       { type:Object,        required:true },
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
		fieldIdAddTo:{
			get()  { return this.modelValue.fieldIdAddTo !== null ? this.modelValue.fieldIdAddTo : ''; },
			set(v) {
				let o = JSON.parse(JSON.stringify(this.modelValue));
				o.fieldIdAddTo = v === '' ? null : v;
				return this.$emit('update:modelValue',o);
			}
		},

		// simple
		active:          s => s.modelValue !== null,
		docsAvail:       s => s.getDependentDocs(s.module),
		docsAvailNoQuery:s => s.docsAvail.filter(v => v.query === null),

		// stores
		attributeIdMap:s => s.$store.getters['schema/attributeIdMap'],
		capGen:        s => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getDependentDocs,
		getItemTitle,
		getItemTitleRelation,
		getTemplateOpenDoc,
		isAttributeFiles
	}
};