import MyBuilderFormInput from './builderFormInput.js';
import {copyValueDialog}  from '../shared/generic.js';
import {
	getAttributeContentUse,
	getAttributeContentsByUse
} from '../shared/attribute.js';
export {MyBuilderVariable as default};

let MyBuilderVariable = {
	name:'my-builder-variable',
	components:{
		MyBuilderFormInput
	},
	template:`<div class="app-sub-window under-header" @mousedown.self="$emit('close')">
		<div class="contentBox builder-variable float" v-if="values !== null">
			<div class="top">
				<div class="area nowrap">
					<img class="icon" src="images/variable.png" />
					<h1 class="title">{{ title }}</h1>
				</div>
				<div class="area">
					<my-button image="cancel.png"
						@trigger="$emit('close')"
						:cancel="true"
					/>
				</div>
			</div>
			<div class="top lower">
				<div class="area">
					<my-button image="save.png"
						@trigger="set"
						:active="canSave"
						:caption="capGen.button.save"
					/>
					<my-button image="refresh.png"
						@trigger="reset"
						:active="hasChanges"
						:caption="capGen.button.refresh"
					/>
					<my-button image="delete.png"
						@trigger="delAsk"
						:active="!readonly"
						:cancel="true"
						:caption="capGen.button.delete"
					/>
				</div>
			</div>
			
			<div class="content default-inputs">
				<table class="generic-table-vertical">
					<tbody>
						<tr>
							<td>{{ capGen.name }}</td>
							<td>
								<div class="row gap centered">
									<input v-focus v-model="values.name" :disabled="readonly" />
									<my-button image="visible1.png"
										@trigger="copyValueDialog(values.name,variableId,variableId)"
										:caption="capGen.id"
									/>
								</div>
								<p class="error" v-if="nameTaken">{{ capGen.error.nameTaken }}</p>
							</td>
							<td>{{ capGen.internalName }}</td>
						</tr>
						<tr v-if="values.formId !== null">
							<td>{{ capGen.form }}</td>
							<td>
								<my-builder-form-input
									v-model="values.formId"
									:module="module"
									:readonly="true"
									:showOpen="true"
								/>
							</td>
							<td>{{ capApp.formIdHint }}</td>
						</tr>
						<tr v-if="values.formId === null">
							<td colspan="3"><i>{{ capApp.global }}</i></td>
						</tr>
						<tr>
							<td>{{ capGen.comments }}</td>
							<td colspan="2">
								<textarea class="dynamic" v-model="values.comment" :disabled="readonly"></textarea>
							</td>
						</tr>
						<tr>
							<td class="grouping">{{ capApp.inputOptions }}</td>
						</tr>
						<tr>
							<td>{{ capAppAtr.usedFor }}</td>
							<td>
								<select v-model="usedFor" :disabled="readonly">
									<optgroup :label="capGen.standard">
										<option value="text"    >{{ capAppAtr.option.text }}</option>
										<option value="textarea">{{ capAppAtr.option.textarea }}</option>
										<option value="richtext">{{ capAppAtr.option.richtext }}</option>
										<option value="number"  >{{ capAppAtr.option.number }}</option>
										<option value="decimal" >{{ capAppAtr.option.decimal }}</option>
										<option value="color"   >{{ capAppAtr.option.color }}</option>
										<option value="iframe"  >{{ capAppAtr.option.iframe }}</option>
										<option value="drawing" >{{ capAppAtr.option.drawing }}</option>
										<option value="boolean" >{{ capAppAtr.option.boolean }}</option>
									</optgroup>
									<optgroup :label="capAppAtr.datetimes">
										<option value="datetime">{{ capAppAtr.option.datetime }}</option>
										<option value="date">{{ capAppAtr.option.date }}</option>
										<option value="time">{{ capAppAtr.option.time }}</option>
									</optgroup>
									<optgroup v-if="false" :label="capGen.relationships">
										<option value="relationshipN1">{{ capAppAtr.option.relationshipN1 }}</option>
										<option value="relationship11">{{ capAppAtr.option.relationship11 }}</option>
									</optgroup>
									<optgroup :label="capAppAtr.expert">
										<option value="float"    >{{ capAppAtr.option.float }}</option>
										<option value="uuid"     >{{ capAppAtr.option.uuid }}</option>
										<option value="regconfig">{{ capAppAtr.option.regconfig }}</option>
									</optgroup>
								</select>
							</td>
							<td></td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>`,
	props:{
		module:    { type:Object,  required:true },
		readonly:  { type:Boolean, required:true },
		variableId:{ required:true }
	},
	emits:['close'],
	data() {
		return {
			values:null,
			valuesOrg:null
		};
	},
	computed:{
		nameTaken:(s) => {
			for(let v of s.module.variables) {
				if(v.id !== s.variableId && v.name === s.values.name && v.formId === s.values.formId)
					return true;
			}
			return false;
		},
		usedFor:{
			get() { return this.getAttributeContentUse(this.values.content, this.values.contentUse); },
			set(v) {
				const p = this.getAttributeContentsByUse(v,0,true);
				this.values.content    = p.content;
				this.values.contentUse = p.contentUse;
			}
		},
		
		// simple
		canSave:   (s) => !s.readonly && s.hasChanges && !s.nameTaken,
		hasChanges:(s) => s.values.name !== '' && JSON.stringify(s.values) !== JSON.stringify(s.valuesOrg),
		title:     (s) => s.capApp.edit.replace('{NAME}',s.values.name),
		
		// stores
		formIdMap:    (s) => s.$store.getters['schema/formIdMap'],
		moduleIdMap:  (s) => s.$store.getters['schema/moduleIdMap'],
		variableIdMap:(s) => s.$store.getters['schema/variableIdMap'],
		capApp:       (s) => s.$store.getters.captions.builder.variable,
		capAppAtr:    (s) => s.$store.getters.captions.builder.attribute,
		capGen:       (s) => s.$store.getters.captions.generic
	},
	mounted() {
		this.reset();
		window.addEventListener('keydown',this.handleHotkeys);
	},
	unmounted() {
		window.removeEventListener('keydown',this.handleHotkeys);
	},
	methods:{
		// external
		copyValueDialog,
		getAttributeContentUse,
		getAttributeContentsByUse,
		
		// actions
		handleHotkeys(e) {
			if(e.ctrlKey && e.key === 's' && this.canSave) {
				this.set();
				e.preventDefault();
			}
			if(e.key === 'Escape') {
				this.$emit('close');
				e.preventDefault();
			}
		},
		reset() {
			this.values    = JSON.parse(JSON.stringify(this.variableIdMap[this.variableId]));
			this.valuesOrg = JSON.parse(JSON.stringify(this.values));
		},
		
		// backend calls
		delAsk() {
			this.$store.commit('dialog',{
				captionBody:this.capApp.dialog.delete,
				buttons:[{
					cancel:true,
					caption:this.capGen.button.delete,
					exec:this.del,
					image:'delete.png'
				},{
					caption:this.capGen.button.cancel,
					image:'cancel.png'
				}]
			});
		},
		del() {
			ws.send('variable','del',this.variableId,true).then(
				() => {
					this.$root.schemaReload(this.module.id);
					this.$emit('close');
				},
				this.$root.genericError
			);
		},
		set() {
			ws.sendMultiple([
				ws.prepare('variable','set',this.values),
				ws.prepare('schema','check',{ moduleId:this.module.id })
			],true).then(
				() => {
					this.$root.schemaReload(this.module.id);
					this.$emit('close');
				},
				this.$root.genericError
			);
		}
	}
};