import MyBuilderCollectionInput from './builderCollectionInput.js';
import {getNilUuid}             from '../shared/generic.js';
import {
	MyFilterBrackets,
	MyFilterConnector,
	MyFilterOperator
} from './../filters.js';
import {
	getDataFieldMap,
	getFieldMap
} from '../shared/form.js';
export {MyBuilderFormStates as default};

let MyBuilderFormStateCondition = {
	name:'my-builder-form-state-condition',
	components:{
		MyBuilderCollectionInput,
		MyFilterBrackets,
		MyFilterConnector,
		MyFilterOperator
	},
	template:`<div class="builder-form-state-condition">
		
		<my-filter-connector
			@update:modelValue="update('connector',$event)"
			:disabled="isFirst"
			:modelValue="condition.connector"
		/>
		
		<my-filter-brackets
			@update:modelValue="update('brackets0',$event)"
			:left="true"
			:modelValue="condition.brackets0"
		/>
		
		<!-- mode selector -->
		<select
			@input="changeMode($event.target.value)"
			:value="mode"
		>
			<option value="field"        :disabled="!anyDataFields">{{ capApp.modeField }}</option>
			<option value="fieldChanged" :disabled="!anyDataFields">{{ capApp.modeFieldChanged }}</option>
			<option value="record">{{ capApp.modeRecord }}</option>
			<option value="role"  >{{ capApp.modeRole }}</option>
		</select>
		
		<!-- field selector -->
		<template v-if="mode === 'field' || mode === 'fieldChanged'">
			<select
				@input="update('fieldId0',$event.target.value)"
				:value="condition.fieldId0"
			>
				<option v-for="f in fieldIdMapData" :value="f.id">
					F{{ fieldIdMapRef[f.id] }}
				</option>
			</select>
		</template>
		
		<!-- field value condition -->
		<template v-if="mode === 'field'">
			
			<!-- field value option -->
			<my-filter-operator class="operator"
				@update:modelValue="update('operator',$event)"
				:builderMode="true"
				:modelValue="condition.operator"
				:onlyEquals="mode2Field === 'preset' || mode2Field === 'login'"
			/>
			
			<!-- field value comparissons -->
			<template v-if="!hasNullOperator">
				<select
					@input="changeMode2Field($event.target.value)"
					:value="mode2Field"
				>
					<option value="fixed">{{ capApp.modeField2Fixed }}</option>
					<option value="field"  :disabled="!anyDataFields">{{ capApp.modeField2Field }}</option>
					<option value="preset" :disabled="field0Presets.length === 0">{{ capApp.modeField2Preset }}</option>
					<option value="login">{{ capApp.modeField2Login }}</option>
					<option value="collection">{{ capApp.modeField2Collection }}</option>
				</select>
				
				<my-builder-collection-input
					v-if="mode2Field === 'collection'"
					@update:collectionId="update('collectionId1',$event)"
					@update:columnId="update('collectionColumnId1',$event)"
					:allowRemove="false"
					:caption="''"
					:collectionId="condition.collectionId1"
					:columnId="condition.collectionColumnId1"
					:module="module"
					:multiValue="false"
					:showMultiValue="false"
				/>
				
				<select
					v-if="mode2Field === 'field'"
					@input="update('fieldId1',$event.target.value)"
					:value="condition.fieldId1"
				>
					<option :value="null">-</option>
					<template v-for="f in fieldIdMapData">
						<option
							v-if="f.id !== condition.fieldId0"
							:value="f.id"
						>F{{ fieldIdMapRef[f.id] }}</option>
					</template>
				</select>
				
				<select
					v-if="mode2Field === 'preset'"
					@input="update('presetId1',$event.target.value)"
					:value="condition.presetId1"
				>
					<option :value="null">-</option>
					<option
						v-for="p in field0Presets"
						:value="p.id"
					>{{ p.name }}</option>
				</select>
				
				<input class="short"
					v-if="mode2Field === 'fixed'"
					@input="update('value1',$event.target.value)"
					:value="condition.value1"
				>
			</template>
		</template>
		
		<!-- role condition -->
		<template v-if="mode === 'role'">
			<my-filter-operator class="operator"
				@update:modelValue="update('operator',$event)"
				:builderMode="false"
				:modelValue="condition.operator"
				:onlyEquals="true"
			/>
			<select
				@input="update('roleId',$event.target.value)"
				:value="condition.roleId"
			>
				<option v-for="r in module.roles" :value="r.id">
					{{ r.name }}
				</option>
			</select>
		</template>
		
		<!-- new record condition -->
		<template v-if="mode === 'record'">
			<span>{{ capApp.newRecord }}</span>
			<my-bool
				@update:modelValue="update('newRecord',$event)"
				:modelValue="condition.newRecord"
			/>
		</template>
		
		<!-- field changed option -->
		<template v-if="mode === 'fieldChanged'">
			<span>{{ capApp.fieldChanged }}</span>
			<my-bool
				@update:modelValue="update('fieldChanged',$event)"
				:modelValue="condition.fieldChanged"
			/>
		</template>
		
		<my-filter-brackets
			@update:modelValue="update('brackets1',$event)"
			:left="false"
			:modelValue="condition.brackets1"
		/>
		
		<my-button image="cancel.png"
			@trigger="$emit('remove')"
			:naked="true"
		/>
	</div>`,
	props:{
		fieldIdMapData:{ type:Object,  required:true },
		fieldIdMapRef: { type:Object,  required:true },
		form:          { type:Object,  required:true },
		isFirst:       { type:Boolean, required:true },
		modelValue:    { type:Object,  required:true }
	},
	watch:{
		condition:{
			handler:function(c) {
				// set main mode
				if     (c.newRecord    !== null) this.mode = 'record';
				else if(c.roleId       !== null) this.mode = 'role';
				else if(c.fieldChanged !== null) this.mode = 'fieldChanged';
				else if(c.fieldId0     !== null) this.mode = 'field';
				
				// set field comparisson mode
				if     (c.collectionId1 !== null) this.mode2Field = 'collection';
				else if(c.login1        !== null) this.mode2Field = 'login';
				else if(c.presetId1     !== null) this.mode2Field = 'preset';
				else if(c.value1        !== null) this.mode2Field = 'fixed';
				else                              this.mode2Field = 'field';
			},
			immediate:true
		}
	},
	emits:['remove','update:modelValue'],
	data:function() {
		return {
			mode:'record',     // left side of comparison: record state, role, field value, field changed
			mode2Field:'fixed' // right side of comparison: login ID, preset ID, fixed value, other field value, collection value(s)
		};
	},
	computed:{
		anyDataFields:function() {
			for(let f in this.fieldIdMapData) {
				return true;
			}
			return false;
		},
		hasNullOperator:function() {
			return ['IS NULL','IS NOT NULL'].includes(this.condition.operator);
		},
		field0Presets:function() {
			if(this.condition.fieldId0 === null)
				return [];
			
			let f = this.fieldIdMapData[this.condition.fieldId0];
			let a = this.attributeIdMap[f.attributeId];
			
			if(a.relationshipId === null)
				return [];
			
			return this.relationIdMap[a.relationshipId].presets;
		},
		
		// simple
		condition:function() { return JSON.parse(JSON.stringify(this.modelValue)); },
		
		// stores
		module:        function() { return this.moduleIdMap[this.form.moduleId]; },
		moduleIdMap:   function() { return this.$store.getters['schema/moduleIdMap']; },
		relationIdMap: function() { return this.$store.getters['schema/relationIdMap']; },
		attributeIdMap:function() { return this.$store.getters['schema/attributeIdMap']; },
		capApp:        function() { return this.$store.getters.captions.builder.form.states; }
	},
	methods:{
		changeMode:function(value) {
			this.mode = value;
			
			switch(value) {
				case 'field':        this.update('fieldId0',this.fieldIdMapData[Object.keys(this.fieldIdMapData)[0]].id); break;
				case 'fieldChanged': this.update('fieldChanged',true); break;
				case 'record':       this.update('newRecord',true); break;
				case 'role':         this.update('roleId',this.module.roles[0].id); break;
			}
		},
		changeMode2Field:function(value) {
			this.mode2Field = value;
			
			switch(value) {
				case 'fixed':  this.update('value1',''); break;
				case 'login':  this.update('login1',true); break;
				case 'preset': this.update('presetId1',this.field0Presets[0].id); break;
			}
		},
		update:function(name,value) {
			let v = JSON.parse(JSON.stringify(this.condition));
			v[name] = value;
			
			// clean up invalid parameter values
			if(this.mode !== 'field' && this.mode !== 'fieldChanged') {
				v.fieldId0 = null;
			}
			if(this.mode !== 'field') {
				v.collectionId1       = null;
				v.collectionColumnId1 = null;
				v.fieldId1            = null;
				v.login1              = null;
				v.presetId1           = null;
				v.value1              = null;
			}
			else {
				if(this.mode2Field !== 'collection') {
					v.collectionId1       = null;
					v.collectionColumnId1 = null;
				}
				if(this.mode2Field !== 'field')  v.fieldId1  = null;
				if(this.mode2Field !== 'fixed')  v.value1    = null;
				if(this.mode2Field !== 'login')  v.login1    = null;
				if(this.mode2Field !== 'preset') v.presetId1 = null;
			}
			if(this.mode !== 'fieldChanged') v.fieldChanged = null;
			if(this.mode !== 'record')       v.newRecord    = null;
			if(this.mode !== 'role')         v.roleId       = null;
			
			this.$emit('update:modelValue',v);
		}
	}
};

let MyBuilderFormStateEffect = {
	name:'my-builder-form-state-effect',
	template:`<div class="builder-form-state-effect">
		
		<!-- affected field -->
		<select @input="update('fieldId',$event.target.value)" :value="effect.fieldId">
			<option value="">-</option>
			<option
				v-for="(ref,fieldId) in fieldIdMapRef"
				:value="fieldId"
			>F{{ ref }}</option>
		</select>
		
		<!-- new state -->
		<select @input="update('newState',$event.target.value)" :value="effect.newState">
			<option value="hidden">{{ capApp.stateHidden }}</option>
			<option value="default">{{ capApp.stateDefault }}</option>
			<option v-if="isData" value="optional">{{ capApp.stateOptional }}</option>
			<option v-if="isData" value="required">{{ capApp.stateRequired }}</option>
			<option v-if="isData || isButton" value="readonly">{{ capApp.stateReadonly }}</option>
		</select>
		
		<my-button image="cancel.png"
			@trigger="$emit('remove')"
			:naked="true"
		/>
	</div>`,
	props:{
		fieldIdMap:   { type:Object, required:true },
		fieldIdMapRef:{ type:Object, required:true },
		modelValue:   { type:Object, required:true }
	},
	emits:['remove','update:modelValue'],
	computed:{
		effect:  function() { return JSON.parse(JSON.stringify(this.modelValue)); },
		fieldSet:function() { return this.effect.fieldId !== null; },
		isButton:function() { return this.fieldSet && this.fieldIdMap[this.effect.fieldId].content === 'button'; },
		isData:  function() { return this.fieldSet && this.fieldIdMap[this.effect.fieldId].content === 'data'; },
		
		// store
		capApp:function() { return this.$store.getters.captions.builder.form; }
	},
	methods:{
		update:function(name,value) {
			let v = JSON.parse(JSON.stringify(this.effect));
			v[name] = value;
			this.$emit('update:modelValue',v);
		}
	}
};

let MyBuilderFormState = {
	name:'my-builder-form-state',
	components:{
		MyBuilderFormStateCondition,
		MyBuilderFormStateEffect
	},
	template:`<div class="builder-form-state" :class="{ 'show-details':detailsShow || showAlways }">
		<div class="details">
			<my-button
				@trigger="detailsShow = !detailsShow"
				:image="detailsShow || showAlways ? 'triangleDown.png' : 'triangleRight.png'"
				:naked="true"
			/>
			
			<input class="long description"
				@input="update('description',-1,$event.target.value)"
				:placeholder="capApp.descriptionHint"
				:value="state.description"
			/>
			
			<template v-if="detailsShow || showAlways">
				<my-button image="add.png"
					@trigger="addCondition()"
					:caption="capApp.button.addCondition"
				/>
				<my-button image="add.png"
					@trigger="addEffect()"
					:caption="capApp.button.addEffect"
				/>
			</template>
			
			<my-button image="cancel.png"
				@trigger="$emit('remove')"
				:naked="true"
			/>
		</div>
		
		<template v-if="detailsShow || showAlways">
			<span class="title" v-if="state.conditions.length !== 0">
				{{ capApp.conditions }}
			</span>
			<my-builder-form-state-condition
				v-for="(c,i) in state.conditions"
				@remove="remove('conditions',i)"
				@update:modelValue="update('conditions',i,$event)"
				:fieldIdMapData="fieldIdMapData"
				:fieldIdMapRef="fieldIdMapRef"
				:form="form"
				:isFirst="i === 0"
				:key="'cond'+i"
				:modelValue="state.conditions[i]"
			/>
			
			<span class="title" v-if="state.effects.length !== 0">
				{{ capApp.effects }}
			</span>
			<my-builder-form-state-effect
				v-for="(e,i) in state.effects"
				@update:modelValue="update('effects',i,$event)"
				@remove="remove('effects',i)"
				:fieldIdMap="fieldIdMap"
				:fieldIdMapRef="fieldIdMapRef"
				:key="'effect'+i"
				:modelValue="state.effects[i]"
			/>
		</template>
	</div>`,
	props:{
		fieldIdMap:    { type:Object,  required:true }, // all fields by ID
		fieldIdMapData:{ type:Object,  required:true }, // data fields by ID
		fieldIdMapRef: { type:Object,  required:true }, // field references by ID
		form:          { type:Object,  required:true },
		modelValue:    { type:Object,  required:true },
		showAlways:    { type:Boolean, required:true }
	},
	emits:['remove','update:modelValue'],
	data:function() {
		return {
			detailsShow:false
		};
	},
	computed:{
		state:function() { return JSON.parse(JSON.stringify(this.modelValue)); },
		
		// store
		capApp:function() { return this.$store.getters.captions.builder.form.states; },
		capGen:function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		addCondition:function() {
			let v = JSON.parse(JSON.stringify(this.state));
			v.conditions.push({
				fieldId0:null,
				fieldId1:null,
				fieldChanged:null,
				presetId1:null,
				roleId:null,
				newRecord:null,
				brackets0:0,
				brackets1:0,
				connector:'AND',
				login1:null,
				operator:'=',
				value1:''
			});
			this.$emit('update:modelValue',v);
		},
		addEffect:function() {
			let v = JSON.parse(JSON.stringify(this.state));
			v.effects.push({
				fieldId:null,
				newState:'default'
			});
			this.$emit('update:modelValue',v);
		},
		remove:function(name,i) {
			let v = JSON.parse(JSON.stringify(this.state));
			v[name].splice(i,1);
			this.$emit('update:modelValue',v);
		},
		update:function(name,i,value) {
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
	template:`<div class="builder-form-states contentBox" :class="{fullscreen:fullscreen}">
		
		<div class="top">
			<div class="area">
				<my-button
					:active="true"
					:caption="capApp.title"
					:darkBg="true"
					:naked="true"
				/>
				<my-button image="add.png"
					@trigger="add"
					:caption="capGen.button.add"
					:darkBg="true"
				/>
				<my-button
					@trigger="showAll = !showAll"
					:caption="capApp.button.showAll"
					:darkBg="true"
					:image="showAll ? 'triangleDown.png' : 'triangleRight.png'"
				/>
			</div>
			<div class="area default-inputs">
				
				<input
					v-model="filter"
					:placeholder="capGen.button.filter"
				/>
				
				<select v-model="filterFieldId">
					<option value="">{{ capApp.option.filterFieldIdHint }}</option>
					<template v-for="(ref,fieldId) in fieldIdMapRef">
						<option
							v-if="fieldIdsUsed.includes(fieldId)"
							:value="fieldId"
						>F{{ ref }}</option>
					</template>
				</select>
				
				<my-button image="expand.png"
					@trigger="$emit('set-fullscreen')"
					:darkBg="true"
				/>
				<my-button image="cancel.png"
					@trigger="$emit('close')"
					:cancel="true"
					:darkBg="true"
				/>
			</div>
		</div>
		
		<div class="content default-inputs">
			<my-builder-form-state
				v-for="(s,i) in states"
				v-show="stateShowIndex.includes(i)"
				@remove="remove(i)"
				@update:modelValue="update(i,$event)"
				:fieldIdMap="fieldIdMap"
				:fieldIdMapData="fieldIdMapData"
				:fieldIdMapRef="fieldIdMapRef"
				:form="form"
				:key="s.id"
				:modelValue="states[i]"
				:showAlways="showAll"
			/>
		</div>
	</div>`,
	props:{
		fieldIdMapRef:{ type:Object, required:false, default:() => {return {}} }, // field reference map (unique field counter for each ID)
		form:         { type:Object, required:true },
		fullscreen:   { type:Boolean,required:true },
		modelValue:   { type:Array,  required:true }
	},
	emits:['close','set-fullscreen','update:modelValue'],
	data:function() {
		return {
			filter:'',
			filterFieldId:'',
			showAll:false
		};
	},
	computed:{
		fieldIdsUsed:function() {
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
		stateShowIndex:function() {
			let out = [];
			for(let i = 0, j = this.states.length; i < j; i++) {
				let s = this.states[i];
				
				// check text filter
				if(this.filter !== '' && !s.description.includes(this.filter))
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
		fieldIdMap:    function() { return this.getFieldMap(this.form.fields); },
		fieldIdMapData:function() { return this.getDataFieldMap(this.form.fields); },
		states:        function() { return JSON.parse(JSON.stringify(this.modelValue)); },
		
		// stores
		capApp:function() { return this.$store.getters.captions.builder.form.states; },
		capGen:function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		// externals
		getDataFieldMap,
		getFieldMap,
		getNilUuid,
		
		// actions
		add:function() {
			let v = JSON.parse(JSON.stringify(this.states));
			v.unshift({
				id:this.getNilUuid(),
				description:'',
				conditions:[],
				effects:[]
			});
			this.$emit('update:modelValue',v);
		},
		remove:function(i) {
			let v = JSON.parse(JSON.stringify(this.states));
			v.splice(i,1);
			this.$emit('update:modelValue',v);
		},
		update:function(i,value) {
			let v = JSON.parse(JSON.stringify(this.states));
			v[i] = value;
			this.$emit('update:modelValue',v);
		}
	}
};