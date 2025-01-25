import MyBuilderOpenFormInput          from './builderOpenFormInput.js';
import {getCollectionConsumerTemplate} from '../shared/collection.js';
import {
	getDependentModules,
	getItemTitleColumn
} from '../shared/builder.js';
export {MyBuilderCollectionInput as default};

let MyBuilderCollectionInput = {
	name:'my-builder-collection-input',
	components:{MyBuilderOpenFormInput},
	template:`<table class="builder-collection-input">
		<tbody>
			<tr>
				<!-- collection input -->
				<td>{{ capApp.collection }}</td>
				<td>
					<select v-model="collectionIdInput" :disabled="fixedCollection || readonly">
						<option value="">-</option>
						<option v-for="c in module.collections" :value="c.id">
							{{ c.name }}
						</option>
						<optgroup
							v-for="m in getDependentModules(module).filter(v => v.id !== module.id && v.collections.length !== 0)"
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
					<select v-model="columnIdInput" :disabled="readonly">
						<option :value="null" disabled="disabled">-</option>
						<option v-if="collectionSet" v-for="c in collection.columns" :value="c.id">
							{{ getItemTitleColumn(c,true) }}
						</option>
					</select>
				</td>
			</tr>
			<tr v-if="collectionSet && allowFormOpen">
				<!-- form open input -->
				<td>{{ capApp.formIdOpen }}</td>
				<td>
					<my-builder-open-form-input
						@update:openForm="openFormInput = $event"
						:allowAllForms="true"
						:module="module"
						:openForm="openFormInput"
						:readonly="readonly"
					/>
				</td>
			</tr>
			<tr v-if="collectionSet">
				<td>{{ capGen.options }}</td>
				<td>
					<div class="row gap wrap">
						<!-- allow multi-value input -->
						<my-button-check
							v-if="flagsEnable.includes('multiValue')"
							@update:modelValue="setFlag('multiValue',$event)"
							:caption="capApp.multiValue"
							:modelValue="consumer.flags.includes('multiValue')"
							:readonly="readonly"
						/>
						<!-- do not display if value is empty input -->
						<my-button-check
							v-if="flagsEnable.includes('noDisplayEmpty')"
							@update:modelValue="setFlag('noDisplayEmpty',$event)"
							:caption="capApp.noDisplayEmpty"
							:modelValue="consumer.flags.includes('noDisplayEmpty')"
							:readonly="readonly"
						/>
						<!-- show aggregated row count instead of value -->
						<my-button-check
							v-if="flagsEnable.includes('showRowCount')"
							@update:modelValue="setFlag('showRowCount',$event)"
							:caption="capApp.showRowCount"
							:modelValue="consumer.flags.includes('showRowCount')"
							:readonly="readonly"
						/>
					</div>
				</td>
			</tr>
			<tr v-if="collectionSet && showOnMobile">
				<!-- show on mobile input -->
				<td>{{ capApp.onMobile }}</td>
				<td><my-bool v-model="onMobileInput" :readonly="readonly" /></td>
			</tr>
			<tr>
				<td>
					<my-button image="delete.png"
						v-if="allowRemove"
						@trigger="$emit('remove')"
						:active="!readonly"
						:caption="capGen.button.delete"
						:naked="true"
					/>
				</td>
			</tr>
		</tbody>
	</table>`,
	props:{
		allowFormOpen:     { type:Boolean, required:true },
		allowRemove:       { type:Boolean, required:true },
		consumer:          { required:true },
		flagsEnable:       { type:Array,   required:true },
		fixedCollection:   { type:Boolean, required:true },
		module:            { type:Object,  required:true },
		readonly:          { type:Boolean, required:true },
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
		onMobileInput:{
			get()  { return this.consumerInput.onMobile },
			set(v) { this.set('onMobile',v) }
		},
		openFormInput:{
			get()  { return this.consumerInput.openForm },
			set(v) { this.set('openForm',v) }
		},
		
		// simple
		collection:   (s) => !s.collectionSet ? false : s.collectionIdMap[s.collectionIdInput],
		collectionSet:(s) => s.consumerInput.collectionId !== null,
		
		// stores
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
				if(value === '') v = null;
				else             v.columnIdDisplay = null;
			}
			this.$emit('update:consumer',v);
		},
		setFlag(name,state) {
			let flags = JSON.parse(JSON.stringify(this.consumerInput.flags));
			const pos = flags.indexOf(name);
			if(state  && pos === -1) flags.push(name);
			if(!state && pos !== -1) flags.splice(pos,1);
			this.set('flags',flags);
		}
	}
};