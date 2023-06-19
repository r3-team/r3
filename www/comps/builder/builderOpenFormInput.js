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
							<option v-for="ta in targetAttributes" :value="ta.atrId">
								{{ ta.caption }}
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
		allowPopUpInline:{ type:Boolean, required:false, default:false },
		forcePopUp:      { type:Boolean, required:false, default:false },
		joinsIndexMap:   { type:Object,  required:false, default:function() { return {}; } },
		module:          { type:Object,  required:true },
		openForm:        { required:true },
		readonly:        { type:Boolean, required:false, default:false },
		relationIdSource:{ type:String,  required:false, default:null }
	},
	emits:['update:openForm'],
	computed:{
		// inputs
		popUpType:{
			get()  { return this.openForm.popUpType === null ? '' : this.openForm.popUpType; },
			set(v) { this.set('popUpType',v === '' ? null : v); }
		},
		
		// options
		targetAttributes:(s) => {
			if(!s.formIsSet) return [];
			
			// parse from which relation the record is applied, based on the chosen relation index
			let relationIdRecord = null;
			for(let k in s.joinsIndexMap) {
				if(s.joinsIndexMap[k].index === s.openForm.relationIndex) {
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
				for(let relId in s.relationIdMap) {
					let r = s.relationIdMap[relId];
					
					// only allow relations from own module or modules we declared as dependency
					if(r.moduleId !== s.module.id && !s.module.dependsOn.includes(r.moduleId))
						continue;
					
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
		formIsSet:(s) => s.openForm !== null && s.openForm.formIdOpen !== null,
		
		// stores
		modules:       (s) => s.$store.getters['schema/modules'],
		relationIdMap: (s) => s.$store.getters['schema/relationIdMap'],
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		formIdMap:     (s) => s.$store.getters['schema/formIdMap'],
		capApp:        (s) => s.$store.getters.captions.builder.openFormInput
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
					popUpType:this.forcePopUp ? 'float' : null,
					maxHeight:1000,
					maxWidth:1200
				};
			
			// set changed value
			if(['maxHeight','maxWidth'].includes(name))
				val = val !== '' && !isNaN(val) ? parseInt(val) : 0;
			
			if(name === 'relationIndex')
				val = val !== '' && !isNaN(val) ? parseInt(val) : -1;
			
			if(name === 'attributeIdApply' && val === '')
				val = null;
			
			if(name === 'formIdOpen')
				v.attributeIdApply = null;
			
			v[name] = val;
			this.$emit('update:openForm',v);
		}
	}
};