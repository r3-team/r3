import {
	getDependentModules,
	getItemTitleColumn
} from '../shared/builder.js';
import {getCollectionConsumerTemplate} from '../shared/collection.js';
export {MyBuilderCollectionInput as default};

let MyBuilderCollectionInput = {
	name:'my-builder-collection-input',
	template:`<table class="builder-collection-input">
		<tr>
			<!-- collection input -->
			<td>{{ capApp.collection }}</td>
			<td>
				<select v-model="collectionIdInput" :disabled="fixedCollection">
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
			</td>
		</tr>
		<tr v-if="collectionSet">
			<!-- collection column input -->
			<td>{{ capApp.column }}</td>
			<td>
				<select v-model="columnIdInput">
					<option :value="null" disabled="disabled">-</option>
					<option v-if="collectionIdInput !== null" v-for="c in collectionIdMap[collectionIdInput].columns" :value="c.id">
						{{ getItemTitleColumn(c) }}
					</option>
				</select>
			</td>
		</tr>
		<tr v-if="collectionSet && allowFormOpen">
			<!-- form open input -->
			<td>{{ capApp.formIdOpen }}</td>
			<td>
				<select v-model="formIdOpenInput">
					<option :value="null" disabled="disabled">-</option>
					<optgroup
						v-for="mod in getDependentModules(module,modules)"
						:label="mod.name"
					>
						<option v-for="f in mod.forms" :value="f.id">
							{{ f.name }}
						</option>
					</optgroup>
				</select>
			</td>
		</tr>
		<tr v-if="collectionSet && showMultiValue">
			<!-- allow multi-value input -->
			<td>{{ capApp.multiValue }}</td>
			<td><my-bool v-model="multiValueInput" /></td>
		</tr>
		<tr v-if="collectionSet && showNoDisplayEmpty">
			<!-- do not display if value is empty input -->
			<td>{{ capApp.noDisplayEmpty }}</td>
			<td><my-bool v-model="noDisplayEmptyInput" /></td>
		</tr>
		<tr v-if="collectionSet && showOnMobile">
			<!-- show on mobile input -->
			<td>{{ capApp.onMobile }}</td>
			<td><my-bool v-model="onMobileInput" /></td>
		</tr>
		<tr>
			<td>
				<my-button image="cancel.png"
					v-if="allowRemove"
					@trigger="$emit('remove')"
					:caption="capGen.button.delete"
					:naked="true"
				/>
			</td>
		</tr>
	</table>`,
	props:{
		allowFormOpen:     { type:Boolean, required:true },
		allowRemove:       { type:Boolean, required:true },
		consumer:          { required:true },
		fixedCollection:   { type:Boolean, required:true },
		module:            { type:Object,  required:true },
		showMultiValue:    { type:Boolean, required:true },
		showNoDisplayEmpty:{ type:Boolean, required:true },
		showOnMobile:      { type:Boolean, required:true }
	},
	emits:['remove','update:consumer'],
	computed:{
		consumerInput:{
			get() {
				return this.consumer !== null
					? JSON.parse(JSON.stringify(this.consumer))
					: this.getCollectionConsumerTemplate();
			}
		},
		
		collectionIdInput:{
			get()  { return this.consumerInput.collectionId },
			set(v) { this.set('collectionId',v) }
		},
		columnIdInput:{
			get()  { return this.consumerInput.columnIdDisplay },
			set(v) { this.set('columnIdDisplay',v) }
		},
		formIdOpenInput:{
			get()  { return this.consumerInput.formIdOpen },
			set(v) { this.set('formIdOpen',v) }
		},
		multiValueInput:{
			get()  { return this.consumerInput.multiValue },
			set(v) { this.set('multiValue',v) }
		},
		noDisplayEmptyInput:{
			get()  { return this.consumerInput.noDisplayEmpty },
			set(v) { this.set('noDisplayEmpty',v) }
		},
		onMobileInput:{
			get()  { return this.consumerInput.onMobile },
			set(v) { this.set('onMobile',v) }
		},
		
		// simple
		collectionSet:(s) => s.collectionIdInput !== null,
		
		// stores
		modules:        (s) => s.$store.getters['schema/modules'],
		collectionIdMap:(s) => s.$store.getters['schema/collectionIdMap'],
		capApp:         (s) => s.$store.getters.captions.builder.collectionInput,
		capGen:         (s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getCollectionConsumerTemplate,
		getDependentModules,
		getItemTitleColumn,
		
		// actions
		set(name,value) {
			let v = JSON.parse(JSON.stringify(this.consumerInput));
			v[name] = value;
			
			if(name === 'collectionId') {
				if(value === 'null') v = null;
				else                 v.columnIdDisplay = null;
			}
			this.$emit('update:consumer',v);
		}
	}
};