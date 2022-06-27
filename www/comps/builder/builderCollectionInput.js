import {
	getDependentModules,
	getItemTitleColumn
} from '../shared/builder.js';
import {getCollectionConsumerTemplate} from '../shared/collection.js';
export {MyBuilderCollectionInput as default};

let MyBuilderCollectionInput = {
	name:'my-builder-collection-input',
	template:`
		<tr>
			<td v-if="caption !== ''">{{ caption }}</td>
			<td>
				<div class="builder-collection-input">
					<!-- collection input -->
					<select v-if="!fixedCollection" v-model="collectionIdInput">
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
					
					<!-- collection column input -->
					<select v-model="columnIdInput" v-if="collectionIdInput !== null">
						<option :value="null" disabled="disabled">{{ capApp.collectionColumn }}</option>
						<option v-if="collectionIdInput !== null" v-for="c in collectionIdMap[collectionIdInput].columns" :value="c.id">
							{{ getItemTitleColumn(c) }}
						</option>
					</select>
					
					<!-- form open input -->
					<select v-model="formIdOpenInput" v-if="allowFormOpen">
						<option :value="null" disabled="disabled">{{ capApp.formIdOpen }}</option>
						<optgroup
							v-for="mod in getDependentModules(module,modules)"
							:label="mod.name"
						>
							<option v-for="f in mod.forms" :value="f.id">
								{{ f.name }}
							</option>
						</optgroup>
					</select>
					
					<!-- allow multi-value input -->
					<div class="collections-option" v-if="showMultiValue">
						<span>{{ capApp.multiValue }}</span>
						<my-bool v-model="multiValueInput" />
					</div>
					
					<!-- do not display if value is empty input -->
					<div class="collections-option" v-if="showNoDisplayEmpty">
						<span>{{ capApp.noDisplayEmpty }}</span>
						<my-bool v-model="noDisplayEmptyInput" />
					</div>
					
					<!-- show on mobile input -->
					<div class="collections-option" v-if="showOnMobile">
						<span>{{ capApp.onMobile }}</span>
						<my-bool v-model="onMobileInput" />
					</div>
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
		allowFormOpen:     { type:Boolean, required:true },
		allowRemove:       { type:Boolean, required:true },
		caption:           { type:String,  required:true },
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
		
		// stores
		modules:        (s) => s.$store.getters['schema/modules'],
		collectionIdMap:(s) => s.$store.getters['schema/collectionIdMap'],
		capApp:         (s) => s.$store.getters.captions.builder.collectionInput
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