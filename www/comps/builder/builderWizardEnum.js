import MyBuilderCaption   from './builderCaption.js';
import MyBuilderIconInput from './builderIconInput.js';
import {
	getTemplateAttribute,
	getTemplatePgIndex,
	getTemplatePgIndexAttribute,
	getTemplatePreset,
	getTemplatePresetValue,
	getTemplateRelation
} from '../shared/builderTemplate.js';

export default {
	name:'my-builder-wizard-enum',
	components:{ MyBuilderCaption, MyBuilderIconInput },
	template:`<div class="app-sub-window under-header" @mousedown.self="close">
		<div class="contentBox builder-wizard-enum float">
			<div class="top">
				<div class="area nowrap">
					<img class="icon" src="images/dropdown.png" />
					<h1 class="title">{{ capAppRel.wizardEnum.title }}</h1>
				</div>
				<div class="area">
					<my-button image="cancel.png"
						@trigger="close"
						:cancel="true"
					/>
				</div>
			</div>
			<div class="top lower">
				<div class="area">
					<my-button image="save.png"
						@trigger="set"
						:active="isSaveAllowed"
						:caption="capGen.button.save"
					/>
				</div>
			</div>

			<div class="content default-inputs no-padding">
				<table class="generic-table-vertical">
					<tbody>
						<tr><td colspan="3" v-html="capAppRel.wizardEnum.intro"></td></tr>
						<tr>
							<td>{{ capGen.attribute }}</td>
							<td>
								<input v-focus v-model="atrName" />
								<p class="textError" v-if="isNameTakenAtr">{{ capGen.error.nameTaken }}</p>
							</td>
							<td>{{ capAppRel.wizardEnum.nameAttributeHint.replace('{NAME}',relation.name) }}</td>
						</tr>
						<tr>
							<td>{{ capGen.title }}</td>
							<td>
								<div class="row gap centered">
									<my-builder-caption
										v-model="atrCaptions"
										:language="builderLanguage"
									/>
									<my-button image="languages.png"
										@trigger="nextLanguage"
										:active="module.languages.length > 1"
									/>
								</div>
							</td>
							<td>{{ capApp.titleHint }}</td>
						</tr>
						<tr>
							<td>{{ capGen.icon }}</td>
							<td><my-builder-icon-input v-model="atrIconId" :module /></td>
							<td>{{ capApp.iconHint }}</td>
						</tr>

						<!-- nullable -->
						<tr>
							<td>{{ capApp.nullable }}</td>
							<td><my-bool v-model="atrNullable" :reversed="true" /></td>
							<td>{{ capApp.nullableHint }}</td>
						</tr>

						<!-- relation -->
						<tr>
							<td>{{ capGen.relation }}</td>
							<td>
								<div class="column gap">
									<div class="row gap">
										<input v-model="relName" :disabled="!relNameOverwritten" />
										<my-button image="edit.png" v-if="!relNameOverwritten" @trigger="relNameOverwritten = true" />
									</div>
									<p class="textError" v-if="isNameTakenRel">{{ capGen.error.nameTaken }}</p>
								</div>
							</td>
							<td>{{ capAppRel.wizardEnum.nameRelationHint }}</td>
						</tr>
						<tr>
							<td>{{ capGen.valuesSelectable }}</td>
							<td>
								<div class="column gap">
									<div class="row gap">
										<input v-model="relPresetName" @keyup.enter="presetAdd" />
										<my-button image="add.png"
											@trigger="presetAdd"
											:active="relPresetName !== ''"
											:caption="capGen.button.add"
										/>
									</div>
									<div class="row gap wrap">
										<my-button image="cancel.png"
											v-for="(p,i) in relPresetNames"
											@trigger="presetDel(i)"
											:caption="p"
											:naked="true"
										/>
									</div>
								</div>
							</td>
							<td>{{ capAppRel.wizardEnum.valuesHint }}</td>
						</tr>

						<!-- protection -->
						<tr>
							<td>{{ capAppRel.wizardEnum.protected }}</td>
							<td><my-bool v-model="relPresetsProtected" /></td>
							<td>{{ capAppRel.wizardEnum.protectedHint }}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		relation:       { type:Object,  required:true }
	},
	emits:['close','nextLanguage'],
	data() {
		return {
			// attribute inputs
			atrCaptions: {},
			atrIconId: null,
			atrName: '',
			atrNullable: true,

			// relation inputs
			relName: '',
			relPresetsProtected: true,
			relPresetName: '',
			relPresetNames: [],

			// states
			relNameOverwritten:false
		};
	},
	watch: {
		atrName(v) {
			if (this.relNameOverwritten)
				return;

			const name = `${this.relation.name}_${v}`;
			if (this.relName !== name)
				this.relName = name;
		}
	},
	computed:{
		isAllInputs:   s => s.atrName !== '' && s.relName !== '' && s.relPresetNames.length !== 0,
		isNameTakenAtr:s => s.relation.attributes.some(v => v.name === s.atrName),
		isNameTakenRel:s => s.module.relations.some(v => v.name === s.relName),
		isSaveAllowed: s => s.isAllInputs && !s.isNameTakenAtr && !s.isNameTakenRel,

		// stores
		moduleIdMap:   s => s.$store.getters['schema/moduleIdMap'],
		attributeIdMap:s => s.$store.getters['schema/attributeIdMap'],
		capApp:        s => s.$store.getters.captions.builder.attribute,
		capAppRel:     s => s.$store.getters.captions.builder.relation,
		capGen:        s => s.$store.getters.captions.generic,
		module:        s => s.moduleIdMap[s.relation.moduleId]
	},
	mounted() {
		this.$store.commit('keyDownHandlerSleep');
		this.$store.commit('keyDownHandlerAdd',{fnc:this.set,key:'s',keyCtrl:true});
		this.$store.commit('keyDownHandlerAdd',{fnc:this.nextLanguage,key:'q',keyCtrl:true});
		this.$store.commit('keyDownHandlerAdd',{fnc:this.close,key:'Escape'});
	},
	unmounted() {
		this.$store.commit('keyDownHandlerDel',this.set);
		this.$store.commit('keyDownHandlerDel',this.nextLanguage);
		this.$store.commit('keyDownHandlerDel',this.close);
		this.$store.commit('keyDownHandlerWake');
	},
	methods:{
		// external
		getTemplateAttribute,
		getTemplatePgIndex,
		getTemplatePgIndexAttribute,
		getTemplatePreset,
		getTemplatePresetValue,
		getTemplateRelation,

		// actions
		presetAdd() {
			if (this.relPresetName === '')
				return;

			this.relPresetNames.push(this.relPresetName);
			this.relPresetName = '';
		},
		presetDel(i) {
			this.relPresetNames.splice(i, 1);
		},
		nextLanguage() {
			this.$emit('nextLanguage');
		},
		close() {
			this.$emit('close');
		},

		// backend calls
		set() {
			if(!this.isSaveAllowed)
				return;

			let requests = [];

			// create relation with name-attribute for relationship target
		 	let targetRel     = this.getTemplateRelation(this.module.id, this.relName, [], false);
			let targetAtrName = this.getTemplateAttribute(this.module.id, targetRel.id, 'name');
			targetAtrName.captions.attributeTitle = this.atrCaptions;
			targetAtrName.nullable = false;

			requests.push(ws.prepare('relation','set',targetRel));
			requests.push(ws.prepare('attribute', 'set', targetAtrName));

			// create unique PG index
			let ind = this.getTemplatePgIndex(targetRel.id);
			ind.noDuplicates = true;
			ind.attributes.push(this.getTemplatePgIndexAttribute(targetAtrName.id, true));
			requests.push(ws.prepare('pgIndex','set',ind));

			// create presets for every text value
			for (const n of this.relPresetNames) {
				let preset = this.getTemplatePreset(targetRel.id, n);
				preset.protected = this.relPresetsProtected;
				preset.values = [this.getTemplatePresetValue(targetAtrName.id,null,this.relPresetsProtected,n)];
				requests.push(ws.prepare('preset','set',preset));
			}

			// create n:1 relationship attribute on this relation
			let localAtr = this.getTemplateAttribute(this.module.id, this.relation.id, this.atrName);
			localAtr.captions.attributeTitle = this.atrCaptions;
			localAtr.content = 'n:1';
			localAtr.iconId = this.atrIconId;
			localAtr.nullable = this.atrNullable;
			localAtr.relationshipId = targetRel.id;

			requests.push(ws.prepare('attribute', 'set', localAtr));

			// send requests with final schema check
			requests.push(ws.prepare('schema','check',{ moduleId:this.module.id }));

			ws.sendMultiple(requests,true).then(
				() => {
					this.$root.schemaReload(this.module.id);
					this.close();
				},
				this.$root.genericError
			);
		}
	}
};
