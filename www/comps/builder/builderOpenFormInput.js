import {isAttributeRelationship} from '../shared/attribute.js';
import {
	getDependentModules,
	getItemTitleRelation
} from '../shared/builder.js';
export {MyBuilderOpenFormInput as default};

let MyBuilderOpenFormInput = {
	name:'my-builder-open-form-input',
	template:`<table>
		<tr>
			<td>{{ capApp.formIdOpen }}</td>
			<td>
				<select
					@input="set('formIdOpen',$event.target.value)"
					:disabled="readonly"
					:value="openForm !== null ? openForm.formIdOpen : null"
				>
					<option value="">-</option>
					<optgroup
						v-for="mod in getDependentModules(module,modules)"
						:label="mod.name"
					>
						<option
							v-for="f in mod.forms.filter(v => allowAllForms || v.query.relationId === relationIdSource)" 
							:value="f.id"
						>{{ f.name }}</option>
					</optgroup>
				</select>
			</td>
		</tr>
		
		<template v-if="formIsSet">
			<tr>
				<td>{{ capApp.popUp }}</td>
				<td>
					<my-bool
						@update:modelValue="set('popUp',$event)"
						:modelValue="openForm.popUp"
						:readonly="readonly || forcePopUp"
					/>
				</td>
			</tr>
			<tr v-if="openForm.popUp">
				<td>{{ capApp.maxHeight }}</td>
				<td>
					<input
						@input="set('maxHeight',$event.target.value)"
						:disabled="readonly"
						:value="openForm.maxHeight"
					/>
				</td>
			</tr>
			<tr v-if="openForm.popUp">
				<td>{{ capApp.maxWidth }}</td>
				<td>
					<input
						@input="set('maxWidth',$event.target.value)"
						:disabled="readonly"
						:value="openForm.maxWidth"
					/>
				</td>
			</tr>
			<template v-if="allowNewRecords">
				<tr>
					<td colspan="2"><b>{{ capApp.newRecord }}</b></td>
				</tr>
				<tr>
					<td>{{ capApp.relationIndex }}</td>
					<td>
						<select
							@input="set('relationIndex',$event.target.value)"
							:disabled="readonly"
							:value="openForm.relationIndex"
						>
							<option :value="-1">-</option>
							<option
								v-for="j in joinsIndexMap"
								:value="j.index"
							>{{ getItemTitleRelation(j.relationId,j.index) }}</option>
						</select>
					</td>
				</tr>
				<tr v-if="openForm.relationIndex !== -1">
					<td>{{ capApp.attributeApply }}</td>
					<td>
						<select
							@input="set('attributeIdApply',$event.target.value)"
							:disabled="readonly"
							:value="openForm.attributeIdApply !== null ? openForm.attributeIdApply : ''"
						>
							<option value="">-</option>
							<option
								v-for="a in targetAttributes"
								:value="a.id"
							>
								{{ relationIdMap[a.relationId].name + '.' + a.name }}
							</option>
						</select>
					</td>
				</tr>
			</template>
		</template>
	</table>`,
	props:{
		allowAllForms:   { type:Boolean, required:false, default:false },
		allowNewRecords: { type:Boolean, required:false, default:false },
		forcePopUp:      { type:Boolean, required:false, default:false },
		joinsIndexMap:   { type:Object,  required:false, default:function() { return {}; } },
		module:          { type:Object,  required:true },
		openForm:        { required:true },
		readonly:        { type:Boolean, required:false, default:false },
		relationIdSource:{ type:String,  required:false, default:null }
	},
	emits:['update:openForm'],
	computed:{
		// simple
		formIsSet:(s) => s.openForm !== null && s.openForm.formIdOpen !== null,
		
		// options
		targetAttributes:(s) => {
			if(!s.formIsSet) return [];
			
			// parse from which relation the record is applied, based on the chosen relation index
			let recordRelationId = null;
			for(let k in s.joinsIndexMap) {
				if(s.joinsIndexMap[k].index === s.openForm.relationIndex) {
					recordRelationId = s.joinsIndexMap[k].relationId;
					break;
				}
			}
			if(recordRelationId === null)
				return [];
			
			let form = s.formIdMap[s.openForm.formIdOpen];
			let out  = [];
			
			// collect fitting attributes
			for(let join of form.query.joins) {
				let rel = s.relationIdMap[join.relationId];
				
				// attributes on relation from target form, in relationship with record relation
				for(let atr of rel.attributes) {
					if(s.isAttributeRelationship(atr.content) && atr.relationshipId === recordRelationId)
						out.push(atr);
				}
				
				// attributes on record relation, in relationship with relation from target form
				for(let atr of s.relationIdMap[recordRelationId].attributes) {
					if(s.isAttributeRelationship(atr.content) && atr.relationshipId === rel.id)
						out.push(atr);
				}
			}
			return out;
		},
		
		// stores
		modules:      (s) => s.$store.getters['schema/modules'],
		relationIdMap:(s) => s.$store.getters['schema/relationIdMap'],
		formIdMap:    (s) => s.$store.getters['schema/formIdMap'],
		capApp:       (s) => s.$store.getters.captions.builder.openFormInput
	},
	methods:{
		// externals
		getDependentModules,
		getItemTitleRelation,
		isAttributeRelationship,
		
		set(name,val) {
			// clear if no form is opened
			if(name === 'formIdOpen' && val === '')
				return this.$emit('update:openForm',null);
			
			let v = JSON.parse(JSON.stringify(this.openForm));
			
			// set initial value if empty
			if(v === null)
				v = {
					formIdOpen:null,
					attributeIdApply:null,
					relationIndex:-1,
					popUp:this.forcePopUp ? true : false,
					maxHeight:0,
					maxWidth:0
				};
			
			// set changed value
			if(['relationIndex','maxHeight','maxWidth'].includes(name))
				val = val !== '' ? parseInt(val) : -1;
			
			if(name === 'attributeIdApply' && val === '')
				val = null;
			
			if(name === 'formIdOpen')
				v.attributeIdApply = null;
			
			v[name] = val;
			this.$emit('update:openForm',v);
		}
	}
};