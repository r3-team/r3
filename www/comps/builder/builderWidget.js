import MyBuilderCaption         from './builderCaption.js';
import MyBuilderCollectionInput from './builderCollectionInput.js';
import MyBuilderFormInput       from './builderFormInput.js';
import {copyValueDialog}        from '../shared/generic.js';
export {MyBuilderWidget as default};

let MyBuilderWidget = {
	name:'my-builder-widget',
	components:{
		MyBuilderCaption,
		MyBuilderCollectionInput,
		MyBuilderFormInput
	},
	template:`<div class="app-sub-window under-header" @mousedown.self="$emit('close')">
		<div class="contentBox builder-widget float" v-if="values !== null">
			<div class="top">
				<div class="area nowrap">
					<img class="icon" src="images/tiles.png" />
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
						@trigger="set(false)"
						:active="canSave"
						:caption="isNew ? capGen.button.create : capGen.button.save"
					/>
					<my-button image="save_new.png"
						@trigger="set(true)"
						:active="canSave"
						:caption="isNew ? capGen.button.createNew : capGen.button.saveNew"
					/>
					<my-button image="refresh.png"
						@trigger="reset"
						:active="hasChanges"
						:caption="capGen.button.refresh"
					/>
					<my-button image="delete.png"
						v-if="!isNew"
						@trigger="del"
						:active="!readonly"
						:cancel="true"
						:caption="capGen.button.delete"
					/>
				</div>
			</div>
			
			<div class="content default-inputs">
				<table class="generic-table-vertical">
					<tr>
						<td>{{ capGen.name }}</td>
						<td>
							<div class="row gap centered">
								<input v-focus v-model="values.name" :disabled="readonly" />
								<my-button image="visible1.png"
									@trigger="copyValueDialog(values.name,widgetId,widgetId)"
									:active="!isNew"
									:caption="capGen.id"
								/>
							</div>
							<p class="error" v-if="nameTaken">{{ capGen.error.nameTaken }}</p>
						</td>
						<td>{{ capApp.nameHint }}</td>
					</tr>
					<tr>
						<td>{{ capGen.title }}</td>
						<td>
							<div class="row gap centered">
								<my-builder-caption
									v-model="values.captions.widgetTitle"
									:dynamicSize="true"
									:language="builderLanguage"
									:readonly="readonly"
								/>
								<my-button image="languages.png"
									@trigger="$emit('next-language')"
									:active="module.languages.length > 1"
								/>
							</div>
						</td>
						<td>{{ capApp.titleHint }}</td>
					</tr>
					<tr>
						<td>{{ capGen.size }}</td>
						<td>
							<div class="row gap centered">
								<input type="range" min="1" max="2"
									v-model.number="values.size"
									:disabled="readonly"
								/>
								<span>{{ values.size }}</span>
							</div>
						</td>
						<td>{{ capApp.sizeHint }}</td>
					</tr>
					<tr v-if="values.collection === null">
						<td>{{ capGen.form }}</td>
						<td>
							<my-builder-form-input
								v-model="values.formId"
								:module="module"
								:readonly="readonly"
								:showOpen="true"
							/>
						</td>
						<td>{{ capApp.formHint }}</td>
					</tr>
					<tr v-if="values.formId === null">
						<td>{{ capGen.collection }}</td>
						<td>
							<my-builder-collection-input
								@update:consumer="values.collection = $event"
								:allowFormOpen="true"
								:allowRemove="false"
								:consumer="values.collection"
								:fixedCollection="false"
								:module="module"
								:readonly="readonly"
								:showMultiValue="false"
								:showNoDisplayEmpty="true"
								:showOnMobile="true"
							/>
						</td>
						<td>{{ capApp.collectionHint }}</td>
					</tr>
				</table>
			</div>
		</div>
	</div>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		module:         { type:Object,  required:true },
		readonly:       { type:Boolean, required:true },
		widgetId:       { required:true }
	},
	emits:['close','next-language','new-record'],
	data() {
		return {
			// widget values
			values:null,
			valuesOrg:null
		};
	},
	computed:{
		nameTaken:(s) => {
			for(let w of s.module.widgets) {
				if(w.id !== s.widgetId && w.name === s.values.name)
					return true;
			}
			return false;
		},
		
		// simple
		canSave:       (s) => !s.readonly && s.hasChanges && !s.nameTaken,
		hasChanges:    (s) => s.values.name !== '' && JSON.stringify(s.values) !== JSON.stringify(s.valuesOrg),
		isNew:         (s) => s.widgetId === null,
		title:         (s) => s.isNew ? s.capApp.new : s.capApp.edit.replace('{NAME}',s.values.name),
		
		// stores
		collectionIdMap:(s) => s.$store.getters['schema/collectionIdMap'],
		formIdMap:      (s) => s.$store.getters['schema/formIdMap'],
		moduleIdMap:    (s) => s.$store.getters['schema/moduleIdMap'],
		widgetIdMap:    (s) => s.$store.getters['schema/widgetIdMap'],
		capApp:         (s) => s.$store.getters.captions.builder.widget,
		capGen:         (s) => s.$store.getters.captions.generic
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
			this.values = this.widgetId !== null
				? JSON.parse(JSON.stringify(this.widgetIdMap[this.widgetId]))
				: {
					id:null,
					moduleId:this.module.id,
					formId:null,
					name:'',
					size:1,
					captions:{
						widgetTitle:{}
					}
				};
			
			this.resetOrg();
		},
		resetOrg() {
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
			ws.send('widget','del',{id:this.widgetId},true).then(
				() => {
					this.$root.schemaReload(this.module.id);
					this.$emit('close');
				},
				this.$root.genericError
			);
		},
		set(saveAndNew) {
			ws.sendMultiple([
				ws.prepare('widget','set',this.values),
				ws.prepare('schema','check',{ moduleId:this.module.id })
			],true).then(
				() => {
					this.$root.schemaReload(this.module.id);
					
					if(saveAndNew) {
						this.$emit('new-record');
						this.values.id     = null;
						this.values.name   = '';
						this.values.formId = null;
						this.resetOrg();
						return;
					}
					this.$emit('close');
				},
				this.$root.genericError
			);
		}
	}
};