import {isAttributeRelationship} from '../shared/attribute.js';
import {getTemplateOpenForm}     from '../shared/builderTemplate.js';
import {
	getDependentModules,
	getDependentRelations,
	getItemTitleRelation
} from '../shared/builder.js';

export default {
	name:'my-builder-open-form',
	template:`<table v-if="openForm !== false">
		<tbody>
			<tr>
				<td colspan="2">
					<select v-model="form" :disabled="readonly">
						<option value="">-</option>

						<!-- local forms -->
						<option v-if="allowAllForms" v-for="f in module.forms" :value="f.id">{{ f.name }}</option>
						<template v-if="!allowAllForms" v-for="j in joinsIndexMapField">
							<option
								v-for="f in module.forms.filter(v => v.query !== null && v.query.relationId === j.relationId)"
								:value="j.index + '_' + f.id"
							>{{ getItemTitleRelation(j.relationId,j.index) + ': ' + f.name }}</option>
						</template>

						<!-- forms from dependent modules -->
						<optgroup
							v-for="mod in getDependentModules(module).filter(v => v.id !== module.id && v.forms.length !== 0)"
							:label="mod.name"
						>
							<option v-if="allowAllForms" v-for="f in module.forms" :value="f.id">{{ f.name }}</option>
							<template v-if="!allowAllForms" v-for="j in joinsIndexMapField">
								<option
									v-for="f in mod.forms.filter(v => v.query !== null && v.query.relationId === j.relationId)"
									:value="j.index + '_' + f.id"
								>{{ getItemTitleRelation(j.relationId,j.index) + ': ' + f.name }}</option>
							</template>
						</optgroup>
					</select>
				</td>
			</tr>
			
			<template v-if="formIsSet">
				<tr>
					<td colspan="2">
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
					<td colspan="2">
						<div class="row gap centered">
							<span>{{ capGen.sizeX }}</span>
							<input class="short" v-model.number="openForm.maxWidth" :disabled="readonly" />
							<template v-if="popUpType === 'float'">
								<span>{{ capGen.sizeY }}</span>
								<input class="short" v-model.number="openForm.maxHeight" :disabled="readonly" />
							</template>
						</div>
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
							<select v-model="openForm.relationIndexApply" :disabled="readonly">
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
								@input="openForm.attributeIdApply = $event.target.value !== '' ? $event.target.value : null"
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
		allowAllForms:     { type:Boolean,       required:false, default:false },
		allowNewRecords:   { type:Boolean,       required:false, default:false },
		allowPopUpInline:  { type:Boolean,       required:false, default:false },
		forcePopUp:        { type:Boolean,       required:false, default:false },
		joinsIndexMap:     { type:Object,        required:false, default:function() { return {}; } },
		joinsIndexMapField:{ type:Object,        required:false, default:function() { return {}; } },
		modelValue:        { type:[Object,null], required:true },
		module:            { type:Object,        required:true },
		readonly:          { type:Boolean,       required:true }
	},
	emits:['update:modelValue'],
	data() {
		return {
			openForm:false
		};
	},
	watch:{
		modelValue:{
			handler(v) {
				this.openForm = v === null ? this.getTemplateOpenForm(this.forcePopUp) : { ...v };
			},
			deep:true,
			immediate:true
		},
		openForm:{
			handler(v) {
				if(!this.formIsSet) {
					if(this.modelValue !== null)
						this.$emit('update:modelValue', null);

					return;
				}

				if(JSON.stringify(v) !== JSON.stringify(this.modelValue))
					this.$emit('update:modelValue', { ...v });
			},
			deep:true
		}
	},
	computed:{
		// inputs
		form:{
			get()  {
				if(this.openForm.formIdOpen === null)
					return '';

				if(this.allowAllForms)
					return this.openForm.formIdOpen;

				return `${this.openForm.relationIndexOpen}_${this.openForm.formIdOpen}`;
			},
			set(v) {
				let o = JSON.parse(JSON.stringify(this.openForm));

				// reset attribute on any form change
				o.attributeIdApply = null;

				if(v === '') {
					o.relationIndexOpen = -1;
					o.formIdOpen        = null;
				}
				else if(this.allowAllForms) {
					o.relationIndexOpen = -1;
					o.formIdOpen        = v;
				}
				const p = v.split('_');
				if(p.length === 2) {
					o.relationIndexOpen = parseInt(p[0]);
					o.formIdOpen        = p[1];
				}
				this.openForm = o;
			}
		},
		popUpType:{
			get()  { return this.openForm.popUpType === null ? '' : this.openForm.popUpType; },
			set(v) { this.openForm.popUpType = v === '' ? null : v; }
		},
		
		// options
		targetAttributes:s => {
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
			
			const form = s.formIdMap[s.openForm.formIdOpen];
			if(form.query === null)
				return [];

			let out = [];
			const atrAdd = (join,atrId,atrIdNm) => {
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
		formIsData:s => s.joinsIndexMap['0'] !== undefined,
		formIsSet: s => s.openForm.formIdOpen !== null,
		
		// stores
		relationIdMap: s => s.$store.getters['schema/relationIdMap'],
		attributeIdMap:s => s.$store.getters['schema/attributeIdMap'],
		formIdMap:     s => s.$store.getters['schema/formIdMap'],
		capApp:        s => s.$store.getters.captions.builder.openFormInput,
		capGen:        s => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getDependentModules,
		getDependentRelations,
		getItemTitleRelation,
		getTemplateOpenForm,
		isAttributeRelationship
	}
};