import {getNilUuid} from '../shared/generic.js';
import {
	getDataFields,
	getFieldMap
} from '../shared/form.js';
export {MyBuilderFormStates as default};

let MyBuilderFormStateEffect = {
	name:'my-builder-form-state-effect',
	template:`<div class="builder-form-state-effect">
		
		<!-- affected field -->
		<select @input="update('fieldId',$event.target.value)" :value="effect.fieldId">
			<option value="">-</option>
			<option
				v-for="(ref,fieldId) in entityIdMapRef.field"
				:value="fieldId"
			>F{{ ref }}</option>
		</select>
		
		<!-- new state -->
		<select @input="update('newState',$event.target.value)" :value="effect.newState">
			<option value="hidden">{{ capApp.stateHidden }}</option>
			<option value="default">{{ capApp.stateDefault }}</option>
			<option value="optional" :disabled="!isData">{{ capApp.stateOptional }}</option>
			<option value="required" :disabled="!isData">{{ capApp.stateRequired }}</option>
			<option value="readonly" :disabled="!isData && !isButton">{{ capApp.stateReadonly }}</option>
		</select>
		
		<my-button image="cancel.png"
			@trigger="$emit('remove')"
			:naked="true"
			:tight="true"
		/>
	</div>`,
	props:{
		entityIdMapRef:{ type:Object, required:true },
		fieldIdMap:    { type:Object, required:true },
		modelValue:    { type:Object, required:true }
	},
	emits:['remove','update:modelValue'],
	computed:{
		effect:  (s) => JSON.parse(JSON.stringify(s.modelValue)),
		fieldSet:(s) => s.effect.fieldId !== null,
		isButton:(s) => s.fieldSet && s.fieldIdMap[s.effect.fieldId].content === 'button',
		isData:  (s) => s.fieldSet && s.fieldIdMap[s.effect.fieldId].content === 'data',
		
		// store
		capApp:(s) => s.$store.getters.captions.builder.form
	},
	methods:{
		update(name,value) {
			let v = JSON.parse(JSON.stringify(this.effect));
			v[name] = value;
			this.$emit('update:modelValue',v);
		}
	}
};

let MyBuilderFormState = {
	name:'my-builder-form-state',
	components:{MyBuilderFormStateEffect},
	template:`<div class="builder-form-state">
		<div class="title">
			<my-button
				@trigger="detailsShow = !detailsShow"
				:captionTitle="capGen.button.show"
				:image="detailsShow ? 'triangleDown.png' : 'triangleRight.png'"
			/>
			
			<input class="description"
				@input="update('description',-1,$event.target.value)"
				:placeholder="capApp.descriptionHint"
				:value="state.description"
			/>
			
			<my-button image="cancel.png"
				@trigger="$emit('remove')"
				:cancel="true"
				:captionTitle="capGen.button.delete"
				:tight="true"
			/>
		</div>
		
		<div class="details" v-if="detailsShow">
			<my-button image="add.png"
				@trigger="addCondition"
				:caption="capApp.conditions"
				:naked="true"
			/>
			<my-filters
				v-model="conditions"
				:builderMode="true"
				:disableContent="['attribute','javascript','subQuery']"
				:entityIdMapRef="entityIdMapRef"
				:fieldIdMap="fieldIdMap"
				:filterAddCnt="filterAddCnt"
				:moduleId="form.moduleId"
				:showAdd="true"
				:showMove="true"
			/>
			
			<my-button image="add.png"
				@trigger="addEffect"
				:caption="capApp.effects"
				:naked="true"
			/>
			<div class="effects">
				<my-builder-form-state-effect
					v-for="(e,i) in state.effects"
					@update:modelValue="update('effects',i,$event)"
					@remove="remove('effects',i)"
					:entityIdMapRef="entityIdMapRef"
					:fieldIdMap="fieldIdMap"
					:key="'effect'+i"
					:modelValue="state.effects[i]"
				/>
			</div>
		</div>
	</div>`,
	props:{
		dataFields:    { type:Array,   required:true }, // all data fields
		entityIdMapRef:{ type:Object,  required:true },
		fieldIdMap:    { type:Object,  required:true }, // all fields by ID
		form:          { type:Object,  required:true },
		modelValue:    { type:Object,  required:true }
	},
	emits:['remove','update:modelValue'],
	data() {
		return {
			detailsShow:false,
			filterAddCnt:0 // ugly hack to add filter
		};
	},
	computed:{
		// inputs
		conditions:{
			get()  { return this.state.conditions; },
			set(v) {
				let s = JSON.parse(JSON.stringify(this.state));
				s.conditions = v;
				this.$emit('update:modelValue',s);
			}
		},
		
		// simple
		state:(s) => JSON.parse(JSON.stringify(s.modelValue)),
		
		// store
		capApp:(s) => s.$store.getters.captions.builder.form.states,
		capGen:(s) => s.$store.getters.captions.generic
	},
	methods:{
		addCondition() {
			let v = JSON.parse(JSON.stringify(this.state));
			v.conditions.push({
				connector:'AND',
				operator:'=',
				side0:{
					brackets:0,
					collectionId:null,
					columnId:null,
					content:'field',
					fieldId:null,
					presetId:null,
					roleId:null,
					value:''
				},
				side1:{
					brackets:0,
					collectionId:null,
					columnId:null,
					content:'value',
					fieldId:null,
					presetId:null,
					roleId:null,
					value:''
				}
			});
			this.$emit('update:modelValue',v);
		},
		addEffect() {
			let v = JSON.parse(JSON.stringify(this.state));
			v.effects.push({
				fieldId:null,
				newState:'default'
			});
			this.$emit('update:modelValue',v);
		},
		remove(name,i) {
			let v = JSON.parse(JSON.stringify(this.state));
			v[name].splice(i,1);
			this.$emit('update:modelValue',v);
		},
		update(name,i,value) {
			let v = JSON.parse(JSON.stringify(this.state));
			
			if(i !== -1) v[name][i] = value;
			else         v[name]    = value;
			
			this.$emit('update:modelValue',v);
		}
	}
};

let MyBuilderFormStates = {
	name:'my-builder-form-states',
	components:{ MyBuilderFormState },
	template:`<div class="builder-form-states">
		
		<div class="actions">
			<my-button image="add.png"
				@trigger="add"
				:caption="capGen.button.add"
			/>
			
			<div class="row centered default-inputs" v-if="states.length !== 0">
				<input class="short"
					v-model="filter"
					:placeholder="capGen.button.filter"
				/>
				<select v-model="filterFieldId">
					<option value="">{{ capApp.option.filterFieldIdHint }}</option>
					<template v-for="(ref,fieldId) in entityIdMapRef.field">
						<option
							v-if="fieldIdsUsed.includes(fieldId)"
							:value="fieldId"
						>F{{ ref }}</option>
					</template>
				</select>
			</div>
		</div>
		
		<div class="content no-padding default-inputs">
			<my-builder-form-state
				v-for="(s,i) in states"
				v-show="stateShowIndex.includes(i)"
				@remove="remove(i)"
				@update:modelValue="update(i,$event)"
				:dataFields="dataFields"
				:entityIdMapRef="entityIdMapRef"
				:fieldIdMap="fieldIdMap"
				:form="form"
				:key="s.id"
				:modelValue="states[i]"
			/>
		</div>
	</div>`,
	props:{
		entityIdMapRef:{ type:Object, required:false, default:() => {return {}} },
		form:          { type:Object, required:true },
		modelValue:    { type:Array,  required:true }
	},
	emits:['update:modelValue'],
	data:function() {
		return {
			filter:'',
			filterFieldId:''
		};
	},
	computed:{
		fieldIdsUsed() {
			let out = [];
			
			for(let i = 0, j = this.states.length; i < j; i++) {
				let s = this.states[i];
				
				for(let x = 0, y = s.conditions.length; x < y; x++) {
					
					if(s.conditions[x].fieldId0 !== null && !out.includes(s.conditions[x].fieldId0))
						out.push(s.conditions[x].fieldId0);
					
					if(s.conditions[x].fieldId1 !== null && !out.includes(s.conditions[x].fieldId1))
						out.push(s.conditions[x].fieldId1);
				}
				
				for(let x = 0, y = s.effects.length; x < y; x++) {
					
					if(s.effects[x].fieldId !== null && !out.includes(s.effects[x].fieldId))
						out.push(s.effects[x].fieldId);
				}
			}
			return out;
		},
		stateShowIndex() {
			let out = [];
			for(let i = 0, j = this.states.length; i < j; i++) {
				let s = this.states[i];
				
				// check text filter
				if(this.filter !== '' && !s.description.toLowerCase().includes(this.filter.toLowerCase()))
					continue;
				
				// check field filter
				if(this.filterFieldId !== '') {
					let show = false;
					
					// check conditions for field ID
					for(let i = 0, j = s.conditions.length; i < j; i++) {
						
						if(s.conditions[i].fieldId0 === this.filterFieldId
							|| s.conditions[i].fieldId1 === this.filterFieldId) {
							
							show = true;
							break;
						}
					}
					
					// check actions for field ID
					if(!show) {
						for(let i = 0, j = s.effects.length; i < j; i++) {
							if(s.effects[i].fieldId === this.filterFieldId) {
								show = true;
								break;
							}
						}
					}
					if(!show) continue;
				}
				out.push(i);
			}
			return out;
		},
		
		// simple
		dataFields:(s) => s.getDataFields(s.form.fields),
		fieldIdMap:(s) => s.getFieldMap(s.form.fields),
		states:    (s) => JSON.parse(JSON.stringify(s.modelValue)),
		
		// stores
		capApp:(s) => s.$store.getters.captions.builder.form.states,
		capGen:(s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getDataFields,
		getFieldMap,
		getNilUuid,
		
		// actions
		add() {
			let v = JSON.parse(JSON.stringify(this.states));
			v.unshift({
				id:this.getNilUuid(),
				description:'',
				conditions:[],
				effects:[]
			});
			this.$emit('update:modelValue',v);
		},
		remove(i) {
			let v = JSON.parse(JSON.stringify(this.states));
			v.splice(i,1);
			this.$emit('update:modelValue',v);
		},
		update(i,value) {
			let v = JSON.parse(JSON.stringify(this.states));
			v[i] = value;
			this.$emit('update:modelValue',v);
		}
	}
};