import {isAttributeRelationship} from '../shared/attribute.js';
import {getFieldTitle}           from '../shared/field.js';
import {getTemplateFormState}    from '../shared/builderTemplate.js';

const MyBuilderFormStateEffect = {
	name:'my-builder-form-state-effect',
	template:`<div class="builder-form-state-effect row gap" :style="'order:'+order">
		
		<!-- target -->
		<select class="long" v-model="target" :disabled="readonly">
			<option value="">{{ capGen.form }}</option>
			<optgroup :label="capGen.action">
				<option
					v-for="(ref,id) in entityIdMapRef.formAction"
					:value="'A'+id"
				>A{{ ref }}</option>
			</optgroup>
			<optgroup :label="capGen.tab">
				<option
					v-for="(ref,id) in entityIdMapRef.tab"
					:value="'T'+id"
				>T{{ ref }}</option>
			</optgroup>
			<optgroup :label="capGen.field">
				<option
					v-for="(ref,fieldId) in entityIdMapRef.field"
					:value="'F'+fieldId"
				>{{ getTitleEffect('F', ref, fieldId) }}</option>
			</optgroup>
		</select>
		
		<!-- new state -->
		<select class="short" v-model="newState" v-if="!isForm" :disabled="readonly">
			<option value="hidden">{{ capGen.hidden }}</option>
			<option value="default">{{ capGen.default }}</option>
			<option value="readonly" :disabled="!isData && !isVariable && !isButton && !isAction">{{ capGen.readonly }}</option>
			<option value="optional" :disabled="!isData && !isVariable">{{ capGen.optional }}</option>
			<option value="required" :disabled="!isData && !isVariable">{{ capGen.required }}</option>
		</select>
		
		<!-- new data -->
		<select class="dynamic" v-model.number="newData" v-if="isCalendar || isForm || isList || isKanban || isRelationship" :disabled="readonly">
			<option value="0">{{ capApp.effectData.d0 }}</option>
			<optgroup :label="capApp.option.dataOptions">
				<option value="7">{{ capApp.effectData.d7 }}</option>
				<option value="6">{{ capApp.effectData.d6 }}</option>
				<option value="5">{{ capApp.effectData.d5 }}</option>
				<option value="4">{{ capApp.effectData.d4 }}</option>
				<option value="3">{{ capApp.effectData.d3 }}</option>
				<option value="2">{{ capApp.effectData.d2 }}</option>
				<option value="1">{{ capApp.effectData.d1 }}</option>
				<option value="-1">{{ capApp.effectData['d-1'] }}</option>
			</optgroup>
		</select>
		
		<my-button image="delete.png"
			@trigger="$emit('remove')"
			:active="!readonly"
			:cancel="true"
		/>
	</div>`,
	props:{
		entityIdMapRef:{ type:Object,  required:true },
		fieldIdMap:    { type:Object,  required:true },
		modelValue:    { type:Object,  required:true },
		order:         { type:Number,  required:true },
		readonly:      { type:Boolean, required:true }
	},
	emits:['remove','update:modelValue'],
	computed:{
		newData:{
			get()  { return this.effect.newData },
			set(v) { this.set('newData',v); }
		},
		newState:{
			get()  { return this.effect.newState },
			set(v) { this.set('newState',v); }
		},
		target:{
			get() {
				if(this.effect.fieldId      !== null) return `F${this.effect.fieldId}`;
				if(this.effect.formActionId !== null) return `A${this.effect.formActionId}`;
				if(this.effect.tabId        !== null) return `T${this.effect.tabId}`;
				return '';
			},
			set(v) {
				this.$emit('update:modelValue',{
					fieldId:     (v !== '' && v.charAt(0) === 'F') ? v.substring(1) : null,
					formActionId:(v !== '' && v.charAt(0) === 'A') ? v.substring(1) : null,
					tabId:       (v !== '' && v.charAt(0) === 'T') ? v.substring(1) : null,
					newData:     0,
					newState:    'default',
				});
			}
		},

		// simple
		effect:        s => JSON.parse(JSON.stringify(s.modelValue)),
		fieldSet:      s => s.effect.fieldId      !== null && s.fieldIdMap[s.effect.fieldId] !== undefined,
		isAction:      s => s.effect.formActionId !== null,
		isButton:      s => s.fieldSet && s.fieldIdMap[s.effect.fieldId].content === 'button',
		isCalendar:    s => s.fieldSet && s.fieldIdMap[s.effect.fieldId].content === 'calendar',
		isKanban:      s => s.fieldSet && s.fieldIdMap[s.effect.fieldId].content === 'kanban',
		isData:        s => s.fieldSet && s.fieldIdMap[s.effect.fieldId].content === 'data',
		isForm:        s => s.effect.fieldId === null && s.effect.formActionId === null && s.effect.tabId === null,
		isList:        s => s.fieldSet && s.fieldIdMap[s.effect.fieldId].content === 'list',
		isRelationship:s => s.isData && s.isAttributeRelationship(s.attributeIdMap[s.fieldIdMap[s.effect.fieldId].attributeId].content),
		isVariable:    s => s.fieldSet && s.fieldIdMap[s.effect.fieldId].content === 'variable',
		
		// store
		attributeIdMap:s => s.$store.getters['schema/attributeIdMap'],
		capApp:        s => s.$store.getters.captions.builder.form,
		capGen:        s => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getFieldTitle,
		isAttributeRelationship,

		// presentation
		getTitleEffect(type,ref,id) {
			return `${type}${ref} - ${type === 'F' ? this.getFieldTitle(this.fieldIdMap[id]) : ''}`;
		},

		// set
		set(name,value) {
			let vOld = JSON.parse(JSON.stringify(this.effect));
			vOld[name] = value;
			this.$emit('update:modelValue',vOld);
		}
	}
};

const MyBuilderFormState = {
	name:'my-builder-form-state',
	components:{MyBuilderFormStateEffect},
	template:`<div class="builder-form-state">
		<div class="title row gap">
			<my-button
				@trigger="$emit('open')"
				:captionTitle="capGen.button.show"
				:image="open ? 'triangleDown.png' : 'triangleRight.png'"
				:naked="true"
			/>
			<input class="description"
				@input="update('description',-1,$event.target.value)"
				:disabled="readonly"
				:placeholder="capGen.description"
				:value="state.description"
			/>
			<my-button image="delete.png"
				@trigger="$emit('remove')"
				:active="!readonly"
				:cancel="true"
				:captionTitle="capGen.button.delete"
			/>
		</div>
		
		<div class="details" v-if="open">
			<my-button image="add.png"
				@trigger="addCondition"
				:active="!readonly"
				:caption="capGen.conditions"
				:naked="true"
			/>
			<my-filters
				v-model="conditions"
				:builderMode="true"
				:disableContent="['attribute','getter','globalSearch','javascript','nowDate','nowDatetime','nowTime','subQuery']"
				:entityIdMapRef
				:fieldIdMap
				:formId="form.id"
				:moduleId="form.moduleId"
				:readonly
			/>
			
			<my-button image="add.png"
				@trigger="addEffect"
				:active="!readonly"
				:caption="capGen.effects"
				:naked="true"
			/>
			<div class="effects">
				<my-builder-form-state-effect
					v-for="(e,i) in state.effects"
					@update:modelValue="update('effects',i,$event)"
					@remove="remove('effects',i)"
					:entityIdMapRef
					:fieldIdMap
					:key="getEffectRef(state.effects[i])"
					:modelValue="state.effects[i]"
					:order="effectIndexesOrdered.indexOf(i)"
					:readonly
				/>
			</div>
		</div>
	</div>`,
	props:{
		dataFields:    { type:Array,   required:true }, // all data fields
		entityIdMapRef:{ type:Object,  required:true },
		fieldIdMap:    { type:Object,  required:true }, // all fields by ID
		form:          { type:Object,  required:true },
		modelValue:    { type:Object,  required:true },
		open:          { type:Boolean, required:true },
		readonly:      { type:Boolean, required:true }
	},
	emits:['open','remove','update:modelValue'],
	computed:{
		effectIndexesOrdered:s => {
			let effects = JSON.parse(JSON.stringify(s.state.effects));
			let out     = new Array(effects.length);

			for(let i = 0; i < effects.length; i++)
				out[i] = i;
			
			out.sort((a,b) => s.getEffectRef(effects[a]) > s.getEffectRef(effects[b]) ? 1 : -1);
			return out;
		},

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
		state:s => JSON.parse(JSON.stringify(s.modelValue)),
		
		// store
		capApp:s => s.$store.getters.captions.builder.form.states,
		capGen:s => s.$store.getters.captions.generic
	},
	methods:{
		addCondition() {
			let v = JSON.parse(JSON.stringify(this.state));
			v.conditions.push({
				connector:'AND',
				position:0,
				operator:'=',
				side0:{
					brackets:0,
					content:'field',
					collectionId:null,
					columnId:null,
					fieldId:null,
					formStateId:null,
					presetId:null,
					roleId:null,
					variableId:null,
					value:''
				},
				side1:{
					brackets:0,
					content:'value',
					collectionId:null,
					columnId:null,
					fieldId:null,
					formStateId:null,
					presetId:null,
					roleId:null,
					variableId:null,
					value:''
				}
			});
			this.$emit('update:modelValue',v);
		},
		addEffect() {
			let v = JSON.parse(JSON.stringify(this.state));
			v.effects.push({
				fieldId:null,
				formActionId:null,
				tabId:null,
				newData:0,
				newState:'default'
			});
			this.$emit('update:modelValue',v);
		},
		getEffectRef(effect) {
			if(effect.fieldId      !== null) return 'F'+String(this.entityIdMapRef.field[effect.fieldId]).padStart(5,'0');
			if(effect.formActionId !== null) return 'A'+String(this.entityIdMapRef.formAction[effect.formActionId]).padStart(5,'0');
			if(effect.tabId        !== null) return 'T'+String(this.entityIdMapRef.tab[effect.tabId]).padStart(5,'0');
			return '';
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

export default {
	name:'my-builder-form-states',
	components:{ MyBuilderFormState },
	template:`<div class="builder-form-states">
		<div class="builder-form-states-actions">
			<my-button image="add.png"
				@trigger="add"
				:active="!readonly"
				:caption="capGen.button.add"
			/>
			
			<div class="row centered gap default-inputs" v-if="states.length !== 0">
				<input class="short"
					v-model="filter"
					:placeholder="capGen.button.filter"
				/>
				<select v-model="filterFieldId">
					<option value="">{{ capGen.field }}</option>
					<template v-for="(ref,fieldId) in entityIdMapRef.field">
						<option
							v-if="fieldIdsUsed.includes(fieldId)"
							:value="fieldId"
						>F{{ ref }}</option>
					</template>
				</select>
				<select v-model="filterFormActionId">
					<option value="">{{ capGen.action }}</option>
					<template v-for="(ref,formActionId) in entityIdMapRef.formAction">
						<option
							v-if="formActionIdsUsed.includes(formActionId)"
							:value="formActionId"
						>A{{ ref }}</option>
					</template>
				</select>
				<select v-model="filterTabId">
					<option value="">{{ capGen.tab }}</option>
					<template v-for="(ref,tabId) in entityIdMapRef.tab">
						<option
							v-if="tabIdsUsed.includes(tabId)"
							:value="tabId"
						>T{{ ref }}</option>
					</template>
				</select>
			</div>
		</div>
		
		<div class="content no-padding default-inputs">
			<my-builder-form-state
				v-for="(s,i) in states"
				v-show="stateIndexesShow.includes(i)"
				@open="open(s.id)"
				@remove="remove(i)"
				@update:modelValue="update(i,$event)"
				:dataFields
				:entityIdMapRef
				:fieldIdMap
				:form
				:key="s.id"
				:modelValue="states[i]"
				:open="stateIdsOpen.includes(s.id)"
				:readonly
			/>
		</div>
	</div>`,
	props:{
		dataFields:    { type:Array,   required:true },
		entityIdMapRef:{ type:Object,  required:false, default:() => {return {}} },
		fieldIdMap:    { type:Object,  required:true },
		form:          { type:Object,  required:true },
		modelValue:    { type:Array,   required:true },
		readonly:      { type:Boolean, required:true }
	},
	emits:['update:modelValue'],
	data() {
		return {
			filter:'',
			filterFieldId:'',
			filterFormActionId:'',
			filterTabId:'',
			stateIdsOpen:[]
		};
	},
	computed:{
		fieldIdsUsed() {
			let out = [];
			for(const s of this.states) {
				for(let c of s.conditions) {
					if(c.side0.fieldId !== null && !out.includes(c.side0.fieldId))
						out.push(c.side0.fieldId);
					
					if(c.side1.fieldId !== null && !out.includes(c.side1.fieldId))
						out.push(c.side1.fieldId);
				}
				for(let e of s.effects) {
					if(e.fieldId !== null && !out.includes(e.fieldId))
						out.push(e.fieldId);
				}
			}
			return out;
		},
		formActionIdsUsed() {
			let out = [];
			for(let s of this.states) {
				for(let e of s.effects) {
					if(e.formActionId !== null && !out.includes(e.formActionId))
						out.push(e.formActionId);
				}
			}
			return out;
		},
		tabIdsUsed() {
			let out = [];
			for(let s of this.states) {
				for(let e of s.effects) {
					if(e.tabId !== null && !out.includes(e.tabId))
						out.push(e.tabId);
				}
			}
			return out;
		},
		stateIndexesShow() {
			let out = [];
			for(let i = 0, j = this.states.length; i < j; i++) {
				let s = this.states[i];
				
				// always keep open states visible
				if(this.stateIdsOpen.includes(s.id)) {
					out.push(i);
					continue;
				}
				
				// check text filter
				if(this.filter !== '' && !s.description.toLowerCase().includes(this.filter.toLowerCase()))
					continue;
				
				// check field filter
				if(this.filterFieldId !== '') {
					let show = false;
					for(let c of s.conditions) {
						if(c.side0.fieldId === this.filterFieldId || c.side1.fieldId === this.filterFieldId) {
							show = true;
							break;
						}
					}
					if(!show) {
						for(let e of s.effects) {
							if(e.fieldId === this.filterFieldId) {
								show = true;
								break;
							}
						}
					}
					if(!show) continue;
				}
				
				// check form action filter
				if(this.filterFormActionId !== '') {
					let show = false;
					for(let e of s.effects) {
						if(e.formActionId === this.filterFormActionId) {
							show = true;
							break;
						}
					}
					if(!show) continue;
				}
				
				// check tab filter
				if(this.filterTabId !== '') {
					let show = false;
					for(let e of s.effects) {
						if(e.tabId === this.filterTabId) {
							show = true;
							break;
						}
					}
					if(!show) continue;
				}
				out.push(i);
			}
			return out;
		},
		
		// simple
		states:s => JSON.parse(JSON.stringify(s.modelValue)),
		
		// stores
		capApp:s => s.$store.getters.captions.builder.form.states,
		capGen:s => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getTemplateFormState,
		
		// actions
		add() {
			let v = JSON.parse(JSON.stringify(this.states));
			v.unshift(this.getTemplateFormState());
			this.$emit('update:modelValue',v);
		},
		open(id) {
			const pos = this.stateIdsOpen.indexOf(id);
			if(pos === -1) this.stateIdsOpen.push(id);
			else           this.stateIdsOpen.splice(pos,1);
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