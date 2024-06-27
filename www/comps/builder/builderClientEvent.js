import MyBuilderCaption  from './builderCaption.js';
import MyInputHotkey     from '../inputHotkey.js';
import {copyValueDialog} from '../shared/generic.js';
export {MyBuilderClientEvent as default};

let MyBuilderClientEvent = {
	name:'my-builder-client-event',
	components:{ MyBuilderCaption, MyInputHotkey },
	template:`<div class="app-sub-window under-header" @mousedown.self="$emit('close')">
		<div class="contentBox builder-client-event float" v-if="values !== null">
			<div class="top">
				<div class="area nowrap">
					<img class="icon" src="images/screen.png" />
					<h1 class="title">{{ isNew ? capApp.titleNew : capApp.title }}</h1>
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
						:caption="isNew ? capGen.button.create : capGen.button.save"
					/>
					<my-button image="refresh.png"
						@trigger="reset"
						:active="hasChanges"
						:caption="capGen.button.refresh"
					/>
					<my-button image="visible1.png"
						@trigger="copyValueDialog(values.name,id,id)"
						:active="!isNew"
						:caption="capGen.id"
					/>
					<my-button image="delete.png"
						v-if="!isNew"
						@trigger="delAsk"
						:active="!readonly"
						:cancel="true"
						:caption="capGen.button.delete"
					/>
				</div>
			</div>
			
			<div class="content default-inputs">
				<table class="generic-table-vertical">
					<tr>
						<td>{{ capGen.title }}</td>
						<td>
							<div class="row gap centered">
								<my-builder-caption class="dynamic"
									v-model="values.captions.clientEventTitle"
									:language="builderLanguage"
									:readonly="readonly"
								/>
								<my-button image="languages.png"
									@trigger="$emit('nextLanguage')"
									:active="module.languages.length > 1"
								/>
							</div>
						</td>
						<td>{{ capApp.titleHint }}</td>
					</tr>
					<tr>
						<td>{{ capGen.event }}</td>
						<td colspan="2">
							<select v-model="values.event" :disabled="readonly">
								<option v-for="v in eventValues" :value="v">
									{{ capApp.event[v] }}
								</option>
							</select>
						</td>
					</tr>
					<tr v-if="values.event === 'onHotkey'">
						<td>{{ capGen.hotkey }}*</td>
						<td>
							<my-input-hotkey
								v-model:char="values.hotkeyChar"
								v-model:modifier1="values.hotkeyModifier1"
								v-model:modifier2="values.hotkeyModifier2"
								:readonly="readonly"
								:twoLines="true"
							/>
						</td>
						<td>{{ capApp.hotkeyHint }}</td>
					</tr>
					<tr>
						<td>{{ capGen.action }}</td>
						<td colspan="2">
							<select v-model="values.action" :disabled="readonly">
								<option v-for="v in actionValues" :value="v">
									{{ capApp.action[v] }}
								</option>
							</select>
						</td>
					</tr>
					<tr v-if="values.action === 'callJsFunction'">
						<td>{{ capGen.jsFunction }}*</td>
						<td colspan="2">
							<select v-model="jsFunctionId" :disabled="readonly">
								<option value="">[{{ capGen.nothingSelected }}]</option>
								<option
									v-for="fnc in module.jsFunctions.filter(v => v.formId === null)"
									:value="fnc.id"
								>{{ fnc.name }}()</option>
							</select>
						</td>
					</tr>
					<tr v-if="values.action === 'callPgFunction'">
						<td>{{ capGen.pgFunction }}*</td>
						<td colspan="2">
							<select v-model="pgFunctionId" :disabled="readonly">
								<option value="">[{{ capGen.nothingSelected }}]</option>
								<option
									v-for="fnc in module.pgFunctions.filter(v => !v.isTrigger)"
									:value="fnc.id"
								>{{ fnc.name }}()</option>
							</select>
						</td>
					</tr>
					<tr>
						<td>{{ capGen.arguments }}</td>
						<td>
							<div class="column gap">
								<div class="row gap centered">
									<select v-model="argInput" :disabled="readonly">
										<option
											v-for="v in argValues"
											:disabled="values.arguments.includes(v)"
											:value="v"
										>
											{{ capApp.arguments[v] }}
										</option>
									</select>
									<my-button image="add.png"
										@trigger="values.arguments.push(argInput)"
										:active="values.arguments.length < argValues.length && !readonly"
									/>
								</div>
								<div class="column">
									<my-button image="cancel.png"
										v-for="(v,i) in values.arguments"
										@trigger="values.arguments.splice(i,1)"
										:active="!readonly"
										:caption="'Arg' + (i+1) + ': ' + capApp.arguments[v]"
										:naked="true"
									/>
								</div>
							</div>
						</td>
						<td>{{ capApp.argumentsHint }}</td>
					</tr>
				</table>
			</div>
		</div>
	</div>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		id:             { required:true },
		module:         { type:Object,  required:true },
		readonly:       { type:Boolean, required:true }
	},
	emits:['close','newRecord','nextLanguage'],
	data() {
		return {
			values:null,
			valuesOrg:null,

			// inputs
			actionValues:['callJsFunction','callPgFunction'],
			argInput:'clipboard',
			argValues:['clipboard','hostname','username','windowTitle'],
			eventValues:['onHotkey','onConnect','onDisconnect']
		};
	},
	computed:{
		// inputs
		jsFunctionId:{
			get()  { return this.values.jsFunctionId !== null ? this.values.jsFunctionId : ''; },
			set(v) { this.values.jsFunctionId = v !== '' ? v : null; }
		},
		pgFunctionId:{
			get()  { return this.values.pgFunctionId !== null ? this.values.pgFunctionId : ''; },
			set(v) { this.values.pgFunctionId = v !== '' ? v : null; }
		},

		// simple
		canSave:(s) => (s.values.action !== 'callJsFunction' || s.values.jsFunctionId !== null)
			&& (s.values.action !== 'callPgFunction' || s.values.pgFunctionId !== null)
			&& (s.values.event !== 'onHotkey' || s.values.hotkeyChar !== null),
		hasChanges:(s) => JSON.stringify(s.values) !== JSON.stringify(s.valuesOrg),
		isNew:     (s) => s.id === null,
		
		// stores
		moduleIdMap:     (s) => s.$store.getters['schema/moduleIdMap'],
		clientEventIdMap:(s) => s.$store.getters['schema/clientEventIdMap'],
		capApp:          (s) => s.$store.getters.captions.builder.clientEvent,
		capGen:          (s) => s.$store.getters.captions.generic
	},
	mounted() {
		this.reset();
		window.addEventListener('keydown',this.handleHotkeys);
	},
	unmounted() {
		window.removeEventListener('keydown',this.handleHotkeys);
	},
	methods:{
		// externals
		copyValueDialog,
		
		// actions
		closeReload() {
			this.$root.schemaReload(this.module.id);
			this.$emit('close');
		},
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
			this.values = this.id !== null
				? JSON.parse(JSON.stringify(this.clientEventIdMap[this.id]))
				: {
					id:null,
					moduleId:this.module.id,
					action:'callJsFunction',
					arguments:[],
					event:'onHotkey',
					hotkeyModifier1:'CTRL',
					hotkeyModifier2:null,
					hotkeyChar:null,
					jsFunctionId:null,
					pgFunctionId:null,
					captions:{
						clientEventTitle:{}
					}
				};
			
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
			ws.send('clientEvent','del',{id:this.id},true).then(
				this.closeReload,
				this.$root.genericError
			);
		},
		set() {
			ws.send('clientEvent','set',this.values,true).then(
				this.closeReload,
				this.$root.genericError
			);
		}
	}
};