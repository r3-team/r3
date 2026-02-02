import {
	getTemplateDocState,
	getTemplateDocStateCondition,
	getTemplateDocStateEffect
} from '../shared/builderTemplate.js';

const filtersDisable = [
	'collection','field','fieldChanged','fieldValid','formChanged','formState','getter','globalSearch',
	'javascript','languageCode','login','nowDate','nowDatetime','nowTime','role','recordMayCreate',
	'recordMayDelete','recordMayUpdate','subQuery','variable'
];

const MyBuilderDocStateEffect = {
	name:'my-builder-doc-state-effect',
	template:`<div class="builder-doc-state-effect row gap" :style="'order:'+order">
		
		<select class="long" v-model="target" :disabled="readonly">
			<optgroup :label="capGen.page">
				<option v-for="(ref,id) in entityIdMapRef.page" :value="'P'+id">{{ capGen.page + ' ' + (ref+1) }}</option>
			</optgroup>
			<optgroup :label="capGen.field">
				<option v-for="(ref,id) in entityIdMapRef.field" :value="'F'+id">F{{ ref }}</option>
			</optgroup>
		</select>

		<my-button-check v-model="effect.newState" :caption="capGen.visible" :readonly />
		
		<my-button image="delete.png"
			@trigger="$emit('remove')"
			:active="!readonly"
			:cancel="true"
		/>
	</div>`,
	props:{
		entityIdMapRef:{ type:Object,  required:true },
		modelValue:    { type:Object,  required:true },
		order:         { type:Number,  required:true },
		readonly:      { type:Boolean, required:true }
	},
	emits:['remove','update:modelValue'],
	computed:{
		// inputs
		effect:{ // this method updates obj directly
			get()  { return this.modelValue; },
			set(v) { this.$emit('update:modelValue',v); }
		},
		target:{
			get() {
				if(this.effect.docFieldId !== null) return `F${this.effect.docFieldId}`;
				if(this.effect.docPageId  !== null) return `P${this.effect.docPageId}`;
				return '';
			},
			set(v) {
				this.effect = {
					docFieldId:(v !== '' && v.charAt(0) === 'F') ? v.substring(1) : null,
					docPageId:(v !== '' && v.charAt(0) === 'P') ? v.substring(1) : null,
					newState:true
				};
			}
		},
		
		// store
		capGen:s => s.$store.getters.captions.generic
	}
};

const MyBuilderDocState = {
	name:'my-builder-doc-state',
	components:{MyBuilderDocStateEffect},
	template:`<div class="builder-doc-state">
		<div class="title row gap">
			<my-button
				@trigger="$emit('open')"
				:captionTitle="capGen.button.show"
				:image="open ? 'triangleDown.png' : 'triangleRight.png'"
				:naked="true"
			/>
			<input class="description"
				v-model="state.description"
				:disabled="readonly"
				:placeholder="capGen.description"
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
				@trigger="conditionAdd"
				:active="!readonly"
				:caption="capGen.conditions"
				:naked="true"
			/>
			<my-filters
				v-model="state.conditions"
				:builderMode="true"
				:disableContent="filtersDisable"
				:entityIdMapRef
				:joins
				:moduleId
			/>
			
			<my-button image="add.png"
				@trigger="effectAdd"
				:active="!readonly"
				:caption="capGen.effects"
				:naked="true"
			/>
			<div class="effects">
				<my-builder-doc-state-effect
					v-for="(e,i) in state.effects"
					@remove="effectDel(i)"
					@update:modelValue="effectSet(i,$event)"
					:entityIdMapRef="entityIdMapRef"
					:key="getEffectRef(state.effects[i])"
					:modelValue="e"
					:order="effectIndexesOrdered.indexOf(i)"
					:readonly
				/>
			</div>
		</div>
	</div>`,
	props:{
		entityIdMapRef:{ type:Object,  required:true },
		joins:         { type:Array,  required:true },
		modelValue:    { type:Object,  required:true },
		moduleId:      { type:String,  required:true },
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
		filtersDisable:s => filtersDisable,
		
		// inputs
		state:{ // this method updates obj directly
			get()  { return this.modelValue; },
			set(v) { this.$emit('update:modelValue',v); }
		},
		
		// store
		capGen:s => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getTemplateDocStateCondition,
		getTemplateDocStateEffect,

		// presentation
		getEffectRef(effect) {
			if(effect.docFieldId !== null) return 'F'+String(this.entityIdMapRef.field[effect.docFieldId]).padStart(5,'0');
			if(effect.docPageId  !== null) return 'A'+String(this.entityIdMapRef.page[effect.docPageId]).padStart(5,'0');
			return '';
		},

		// actions
		conditionAdd() {
			let v = JSON.parse(JSON.stringify(this.state));
			v.conditions.push(this.getTemplateDocStateCondition());
			this.$emit('update:modelValue',v);
		},
		effectAdd() {
			this.state.effects.push(this.getTemplateDocStateEffect());
		},
		effectDel(i) {
			this.state.effects.splice(i,1);
		},
		effectSet(i,v) {
			this.state.effects[i] = v;
		}
	}
};

export default {
	name:'my-builder-doc-states',
	components:{ MyBuilderDocState },
	template:`<div class="builder-doc-states">
		<div class="builder-doc-states-actions">
			<my-button image="add.png"
				@trigger="add"
				:active="!readonly"
				:caption="capGen.button.add"
			/>
			
			<div class="row centered gap default-inputs" v-if="states.length !== 0">
				<input class="short" v-model="filter" :placeholder="capGen.button.filter" />
				<select v-model="filterPageId">
					<option value="">{{ capGen.field }}</option>
					<template v-for="(ref,pageId) in entityIdMapRef.page">
						<option v-if="pageIdsUsed.includes(pageId)" :value="pageId">P{{ ref }}</option>
					</template>
				</select>
				<select v-model="filterFieldId">
					<option value="">{{ capGen.page }}</option>
					<template v-for="(ref,fieldId) in entityIdMapRef.field">
						<option v-if="fieldIdsUsed.includes(fieldId)" :value="fieldId">F{{ ref }}</option>
					</template>
				</select>
			</div>
		</div>
		
		<div class="content no-padding default-inputs">
			<my-builder-doc-state
				v-for="(s,i) in states"
				v-show="stateIndexesShow.includes(i)"
				v-model="states[i]"
				@open="open(s.id)"
				@remove="remove(i)"
				:entityIdMapRef
				:joins
				:key="s.id"
				:moduleId
				:open="stateIdsOpen.includes(s.id)"
				:readonly
			/>
		</div>
	</div>`,
	props:{
		entityIdMapRef:{ type:Object,  required:false, default:() => {return {}} },
		joins:         { type:Array,   required:true },
		modelValue:    { type:Array,   required:true },
		moduleId:      { type:String,  required:true },
		readonly:      { type:Boolean, required:true }
	},
	emits:['update:modelValue'],
	data() {
		return {
			filter:'',
			filterFieldId:'',
			filterPageId:'',
			stateIdsOpen:[]
		};
	},
	computed:{
		fieldIdsUsed:s => {
			let out = [];
			for(const st of s.states) {
				for(let e of st.effects) {
					if(e.docFieldId !== null && !out.includes(e.docFieldId))
						out.push(e.docFieldId);
				}
			}
			return out;
		},
		pageIdsUsed:s => {
			let out = [];
			for(const st of s.states) {
				for(let e of st.effects) {
					if(e.docPageId !== null && !out.includes(e.docPageId))
						out.push(e.docPageId);
				}
			}
			return out;
		},
		stateIndexesShow:s => {
			let out = [];
			for(let i = 0, j = s.states.length; i < j; i++) {
				let t = s.states[i];
				
				// always keep open states visible
				if(s.stateIdsOpen.includes(t.id)) {
					out.push(i);
					continue;
				}
				
				// check text filter
				if(s.filter !== '' && !t.description.toLowerCase().includes(s.filter.toLowerCase()))
					continue;
				
				// check field filter
				if(s.filterFieldId !== '') {
					let show = false;
					for(let e of t.effects) {
						if(e.docFieldId === s.filterFieldId) {
							show = true;
							break;
						}
					}
					if(!show) continue;
				}
				
				// check page filter
				if(s.filterPageId !== '') {
					let show = false;
					for(let e of t.effects) {
						if(e.docPageId === s.filterPageId) {
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

		// inputs
		states:{ // this method updates obj directly
			get()  { return this.modelValue; },
			set(v) { this.$emit('update:modelValue',v); }
		},
		
		// stores
		capGen:s => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getTemplateDocState,
		
		// actions
		add() {
			this.states.unshift(this.getTemplateDocState());
		},
		open(id) {
			const pos = this.stateIdsOpen.indexOf(id);
			if(pos === -1) this.stateIdsOpen.push(id);
			else           this.stateIdsOpen.splice(pos,1);
		},
		remove(i) {
			this.states.splice(i,1);
		}
	}
};