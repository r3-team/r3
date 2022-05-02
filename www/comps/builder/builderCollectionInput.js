import {
	getDependentModules,
	getItemTitleColumn
} from '../shared/builder.js';
export {MyBuilderCollectionInput as default};

let MyBuilderCollectionInput = {
	name:'my-builder-collection-input',
	template:`
		<tr>
			<td>{{ caption }}</td>
			<td>
				<select v-model="collectionIdInput">
					<option :value="null">-</option>
					<optgroup
						v-for="m in getDependentModules(module,modules).filter(v => v.collections.length !== 0)"
						:label="m.name"
					>
						<option v-for="c in m.collections" :value="c.id">
							{{ c.name }}
						</option>
					</optgroup>
				</select>
				<select v-model="columnIdInput" :disabled="collectionId === null">
					<option :value="null" disabled="disabled">{{ capApp.collectionColumn }}</option>
					<option v-if="collectionId !== null" v-for="c in collectionIdMap[collectionId].columns" :value="c.id">
						{{ getItemTitleColumn(c) }}
					</option>
				</select>
				
				<div class="collections-option" v-if="showMultiValue">
					<span>{{ capApp.collectionMultiValue }}</span>
					<my-bool v-model="multiValueInput" />
				</div>
			</td>
			<td>
				<my-button image="cancel.png"
					v-if="allowRemove"
					@trigger="$emit('remove')"
					:naked="true"
				/>
			</td>
		</tr>
	`,
	props:{
		allowRemove:   { type:Boolean, required:true },
		caption:       { type:String,  required:true },
		collectionId:  { required:true },
		columnId:      { required:true },
		module:        { type:Object,  required:true },
		multiValue:    { required:true },
		showMultiValue:{ type:Boolean, required:true }
	},
	emits:['remove','update:collectionId','update:columnId','update:multiValue'],
	computed:{
		collectionIdInput:{
			get()  { return this.collectionId },
			set(v) { this.$emit('update:collectionId',v) }
		},
		columnIdInput:{
			get()  { return this.columnId },
			set(v) { this.$emit('update:columnId',v) }
		},
		multiValueInput:{
			get()  { return this.multiValue },
			set(v) { this.$emit('update:multiValue',v) }
		},
		
		// stores
		modules:        (s) => s.$store.getters['schema/modules'],
		collectionIdMap:(s) => s.$store.getters['schema/collectionIdMap'],
		capApp:         (s) => s.$store.getters.captions.builder.form
	},
	methods:{
		// externals
		getDependentModules,
		getItemTitleColumn
	}
};