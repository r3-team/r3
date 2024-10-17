import {isAttributeRelationship} from '../shared/attribute.js';
import {
	getDependentModules,
	getDependentRelations,
	getItemTitleRelation
} from '../shared/builder.js';
export {MyBuilderOpenFormInput as default};

let MyBuilderOpenFormInput = {
	name:'my-builder-open-form-input',
	template:`<table>
		<tbody>
			<tr v-if="!allowAllForms">
				<td>{{ capApp.relationIndexOpen }}</td>
				<td>
					<select
						@input="set('relationIndexOpen',$event.target.value)"
						:disabled="readonly"
						:value="isActive ? openForm.relationIndexOpen : -1"
					>
						<option :value="-1">-</option>
						<option
							v-for="j in joinsIndexMapField"
							:value="j.index"
						>{{ getItemTitleRelation(j.relationId,j.index) }}</option>
					</select>
				</td>
			</tr>
			<tr v-if="allowAllForms || (isActive && openForm.relationIndexOpen !== -1)">
				<td>{{ capApp.formIdOpen }}</td>
				<td>
					<select
						@input="set('formIdOpen',$event.target.value)"
						:disabled="readonly"
						:value="isActive ? openForm.formIdOpen : null"
					>
						<option value="">-</option>
						<option
							v-for="f in module.forms.filter(v => allowAllForms || v.query.relationId === relationIdSource)" 
							:value="f.id"
						>{{ f.name }}</option>
						<optgroup
							v-for="mod in getDependentModules(module).filter(v => v.id !== module.id && v.forms.length !== 0)"
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
					<td>{{ capApp.popUpType }}</td>
					<td>
						<select v-model="popUpType" :disabled="readonly">
							<option value="" :disabled="forcePopUp">
								{{ capApp.option.none }}
							</option>
							<option value="float">
								{{ capApp.option.float }}
							</option>
							<option value="inline" :disabled="!allowPopUpInline">
								{{ capApp.option.inline }}
							</option>
						</select>
					</td>
				</tr>
				<tr v-if="popUpType !== ''">
					<td>{{ capApp.maxWidth }}</td>
					<td>
						<input
							@input="set('maxWidth',$event.target.value)"
							:disabled="readonly"
							:value="openForm.maxWidth"
						/>
					</td>
				</tr>
				<tr v-if="popUpType === 'float'">
					<td>{{ capApp.maxHeight }}</td>
					<td>
						<input
							@input="set('maxHeight',$event.target.value)"
							:disabled="readonly"
							:value="openForm.maxHeight"
						/>
					</td>
				</tr>
				<template v-if="allowNewRecords && formIsData">
					<tr>
						<td colspan="2">
							<div class="row gap centered space-between">
								<b>{{ capApp.newRecord }}</b>
								<my-button image="question.png"
									@trigger="$store.commit('dialog',{captionBody:capApp.newRecordHelp})"
								/>
							</div>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.relationIndexApply }}</td>
						<td>
							<select
								@input="set('relationIndexApply',$event.target.value)"
								:disabled="readonly"
								:value="openForm.relationIndexApply"
							>
								<option :value="-1">-</option>
								<option
									v-for="j in joinsIndexMap"
									:value="j.index"
								>{{ getItemTitleRelation(j.relationId,j.index) }}</option>
							</select>
						</td>
					</tr>
					<tr v-if="openForm.relationIndexApply !== -1">
						<td>{{ capApp.attributeApply }}</td>
						<td>
							<select
								@input="set('attributeIdApply',$event.target.value)"
								:disabled="readonly"
								:value="openForm.attributeIdApply !== null ? openForm.attributeIdApply : ''"
							>
								<option value="">-</option>
								<option v-for="ta in targetAttributes" :value="ta.atrId">
									{{ ta.caption }}
								</option>
							</select>
						</td>
					</tr>
				</template>
			</template>
		</tbody>
	</table>`,
	props:{
		allowAllForms:     { type:Boolean, required:false, default:false },
		allowNewRecords:   { type:Boolean, required:false, default:false },
		allowPopUpInline:  { type:Boolean, required:false, default:false },
		forcePopUp:        { type:Boolean, required:false, default:false },
		joinsIndexMap:     { type:Object,  required:false, default:function() { return {}; } },
		joinsIndexMapField:{ type:Object,  required:false, default:function() { return {}; } },
		module:            { type:Object,  required:true },
		openForm:          { required:true },
		readonly:          { type:Boolean, required:false, default:false }
	},
	emits:['update:openForm'],
	computed:{
		// inputs
		popUpType:{
			get()  { return this.openForm.popUpType === null ? '' : this.openForm.popUpType; },
			set(v) { this.set('popUpType',v === '' ? null : v); }
		},
		
		// options
		relationIdSource:(s) => {
			if(!s.isActive) return null;
			
			return typeof s.joinsIndexMapField[s.openForm.relationIndexOpen] !== 'undefined'
				? s.joinsIndexMapField[s.openForm.relationIndexOpen].relationId : null;
		},
		targetAttributes:(s) => {
			if(!s.formIsSet) return [];
			
			// parse from which relation the record is applied, based on the chosen relation index
			let relationIdRecord = null;
			for(let k in s.joinsIndexMap) {
				if(s.joinsIndexMap[k].index === s.openForm.relationIndexApply) {
					relationIdRecord = s.joinsIndexMap[k].relationId;
					break;
				}
			}
			if(relationIdRecord === null)
				return [];
			
			let form   = s.formIdMap[s.openForm.formIdOpen];
			let out    = [];
			let atrAdd = (join,atrId,atrIdNm) => {
				let atr = s.attributeIdMap[atrId];
				let cap = atrIdNm === null
					? `${join} ${s.relationIdMap[atr.relationId].name}.${atr.name}`
					: `${join} ${s.relationIdMap[atr.relationId].name}.${s.attributeIdMap[atrIdNm].name} -> ${atr.name}`;
				
				out.push({atrId:atrId,caption:cap});
			};
			
			// collect fitting attributes
			for(let join of form.query.joins) {
				let rel = s.relationIdMap[join.relationId];
				
				// attributes on relation from target form, in relationship with record relation
				for(let atr of rel.attributes) {
					if(s.isAttributeRelationship(atr.content) && atr.relationshipId === relationIdRecord)
						atrAdd(join.index,atr.id,null)
				}
				
				// attributes on record relation, in relationship with relation from target form
				for(let atr of s.relationIdMap[relationIdRecord].attributes) {
					if(s.isAttributeRelationship(atr.content) && atr.relationshipId === rel.id)
						atrAdd(join.index,atr.id,null)
				}
				
				// attributes on n:m relations
				for(const r of s.getDependentRelations(s.module)) {
					
					// skip if record relation itself is n:m candidate
					if(r.id === relationIdRecord)
						continue;
					
					let atrToSource = null; // attribute pointing to relation of record to be applied
					let atrToTarget = null; // attribute pointing to form join relation
					
					for(let atr of r.attributes) {
						if(!s.isAttributeRelationship(atr.content))
							continue;
						
						if(atr.relationshipId === relationIdRecord)
							atrToSource = atr;
						
						if(atr.relationshipId === rel.id)
							atrToTarget = atr;
					}
					
					if(atrToSource !== null && atrToTarget !== null)
						atrAdd(join.index,atrToSource.id,atrToTarget.id)
				}
			}
			return out;
		},
		
		// simple
		formIsData:(s) => typeof s.joinsIndexMap['0'] !== 'undefined',
		formIsSet: (s) => s.isActive && s.openForm.formIdOpen !== null,
		isActive:  (s) => s.openForm !== null,
		
		// stores
		relationIdMap: (s) => s.$store.getters['schema/relationIdMap'],
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		formIdMap:     (s) => s.$store.getters['schema/formIdMap'],
		capApp:        (s) => s.$store.getters.captions.builder.openFormInput
	},
	methods:{
		// externals
		getDependentModules,
		getDependentRelations,
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
					relationIndexOpen:-1,
					formIdOpen:null,
					relationIndexApply:-1,
					attributeIdApply:null,
					popUpType:this.forcePopUp ? 'float' : null,
					maxHeight:1000,
					maxWidth:1200
				};
			
			// set changed value
			if(['maxHeight','maxWidth'].includes(name))
				val = val !== '' && !isNaN(val) ? parseInt(val) : 0;
			
			if(name === 'relationIndexOpen')
				val = val !== '' && !isNaN(val) ? parseInt(val) : 0;
			
			if(name === 'relationIndexApply')
				val = val !== '' && !isNaN(val) ? parseInt(val) : -1;
			
			if(name === 'attributeIdApply' && val === '')
				val = null;
			
			if(name === 'relationIndexOpen') {
				v.formIdOpen       = null;
				v.attributeIdApply = null;
			}
			
			if(name === 'formIdOpen')
				v.attributeIdApply = null;
			
			v[name] = val;
			this.$emit('update:openForm',v);
		}
	}
};