import MyBuilderCaption        from './builderCaption.js';
import MyBuilderClientEvent    from './builderClientEvent.js';
import MyBuilderIconInput      from './builderIconInput.js';
import MyBuilderSelectForm     from './builderSelectForm.js';
import srcBase64Icon           from '../shared/image.js';
import {getDependentModules}   from '../shared/builder.js';
import {getTemplatePgFunction} from '../shared/builderTemplate.js';
import {deepIsEqual}           from '../shared/generic.js';
import {getUnixFormat}         from '../shared/time.js';
import {MyModuleSelect}        from '../input.js';
import MyInputColorWrap        from '../inputColorWrap.js';
import {
	copyValueDialog,
	getRandomInt
} from '../shared/generic.js';

const MyBuilderModuleStartForm = {
	name:'my-builder-module-start-form',
	components:{ MyBuilderSelectForm },
	template:`<div class="row gap centered">
		<img v-if="!readonly" class="dragAnchor" src="images/drag.png" />
		<select v-model="roleId" :disabled="readonly">
			<option :value="null">[{{ capGen.role }}]</option>
			<option v-for="r in module.roles" :value="r.id">
				{{ r.name }}
			</option>
		</select>
		<my-builder-select-form
			v-model="formId"
			:allowAllForms="true"
			:captionEmpty="'[' + capApp.startFormDefault + ']'"
			:module
			:readonly
		/>
		<my-button image="delete.png"
			@trigger="$emit('remove')"
			:active="!readonly"
			:cancel="true"
		/>
	</div>`,
	props:{
		modelValue:{ type:Object,  required:true },
		module:    { type:Object,  required:true },
		readonly:  { type:Boolean, required:true }
	},
	emits:['remove','update:modelValue'],
	computed:{
		formId:{
			get()  { return this.modelValue.formId; },
			set(v) { this.update('formId',v); }
		},
		roleId:{
			get()  { return this.modelValue.roleId; },
			set(v) { this.update('roleId',v); }
		},
		
		// stores
		capApp:s => s.$store.getters.captions.builder.module,
		capGen:s => s.$store.getters.captions.generic
	},
	methods:{
		update(name,value) {
			let v = JSON.parse(JSON.stringify(this.modelValue));
			v[name] = value;
			
			this.$emit('update:modelValue',v);
		}
	}
};

export default {
	name:'my-builder-module',
	components:{
		MyBuilderCaption,
		MyBuilderClientEvent,
		MyBuilderIconInput,
		MyBuilderModuleStartForm,
		MyBuilderSelectForm,
		MyInputColorWrap,
		MyModuleSelect
	},
	template:`<div class="builder-module contentBox grow" v-if="isReady">
		<div class="top">
			<div class="area nowrap">
				<img class="icon" src="images/module.png" />
				<h1 class="title">{{ capApp.title.replace('{NAME}',inputs.name) }}</h1>
			</div>
		</div>
		<div class="top lower">
			<div class="area nowrap">
				<my-button image="save.png"
					@trigger="set"
					:active="isChanged && !readonly"
					:caption="capGen.button.save"
				/>
				<my-button image="refresh.png"
					@trigger="reset(true)"
					:active="isChanged"
					:caption="capGen.button.refresh"
				/>
			</div>
			<div class="area nowrap">
				<my-button image="visible1.png"
					@trigger="copyValueDialog(inputs.name,id,id)"
					:caption="capGen.id"
				/>
			</div>
		</div>
		
		<div class="content default-inputs no-padding">
			<table class="generic-table-vertical w1200">
				<tbody>
					<tr>
						<td>{{ capGen.name }}</td>
						<td><input v-model="inputs.name" :disabled="readonly" :placeholder="capApp.nameHolder" /></td>
						<td>{{ capApp.nameHint }}</td>
					</tr>
					<tr>
						<td>{{ capGen.title }}</td>
						<td>
							<my-builder-caption class="title"
								v-model="inputs.captions.moduleTitle"
								:contentName="capGen.title"
								:language="builderLanguage"
								:readonly
							/>
						</td>
						<td>{{ capApp.titleHint }}</td>
					</tr>
					<tr>
						<td>{{ capApp.dependsOn }}</td>
						<td>
							<div class="builder-module-depends-list">
								<my-button image="delete.png"
									v-for="m in modules.filter(v => v.id !== id && inputs.dependsOn.includes(v.id))"
									@trigger="toggleDependsOn(m.id,false)"
									:active="!readonly"
									:caption="m.name"
									:naked="true"
								/>
							</div>
							<my-module-select
								v-if="!readonly"
								@update:modelValue="toggleDependsOn($event,true)"
								:moduleIdsFilter="inputs.dependsOn.concat([id])"
								:modelValue="moduleIdDependsOnInput"
								:preSelectOne="false"
							/>
						</td>
						<td>{{ capApp.dependsOnHint }}</td>
					</tr>
					<tr>
						<td>{{ capGen.icon }}</td>
						<td>
							<my-builder-icon-input
								@input="inputs.iconId = $event"
								:icon-id-selected="inputs.iconId"
								:module="moduleSchema"
								:readonly
							/>
						</td>
						<td>{{ capApp.iconHint }}</td>
					</tr>
					<tr>
						<td>{{ capApp.color }}</td>
						<td><my-input-color-wrap v-model="inputs.color1" :allowNull="true" :readonly /></td>
						<td>{{ capApp.colorHint }}</td>
					</tr>
					<tr>
						<td>{{ capApp.parent }}</td>
						<td>
							<select v-model="inputs.parentId" :disabled="readonly">
								<option :value="null">-</option>
								<option
									v-for="mod in getDependentModules(moduleSchema).filter(v => v.id !== id && v.parentId === null)"
									:value="mod.id"
								>
									{{ mod.name }}
								</option>
							</select>
						</td>
						<td>{{ capApp.parentHint }}</td>
					</tr>
					<tr>
						<td>{{ capApp.position }}</td>
						<td><input class="short" v-model.number="inputs.position" :disabled="readonly" /></td>
						<td>{{ capApp.positionHint }}</td>
					</tr>
					<tr>
						<td>{{ capApp.startFormDefault }}</td>
						<td>
							<my-builder-select-form
								v-model="inputs.formId"
								:allowAllForms="true"
								:module="moduleSchema"
								:readonly
							/>
						</td>
						<td>{{ capApp.startFormDefaultHint }}</td>
					</tr>
					<tr>
						<td>{{ capApp.startFormByRole }}</td>
						<td>
							<div class="column gap">
								<draggable class="column gap" handle=".dragAnchor" group="start-forms" itemKey="id" animation="100"
									:fallbackOnBody="true"
									:list="inputs.startForms"
								>
									<template #item="{element,index}">
										<my-builder-module-start-form
											@remove="inputs.startForms.splice(index,1)"
											@update:modelValue="inputs.startForms[index] = $event"
											:modelValue="element"
											:module="moduleSchema"
											:readonly
										/>
									</template>
								</draggable>
								<div>
									<my-button image="add.png"
										@trigger="addStartForm"
										:active="!readonly"
										:caption="capGen.button.add"
									/>
								</div>
							</div>
						</td>
						<td>{{ capApp.startFormByRoleHint }}</td>
					</tr>
					<tr>
						<td>{{ capApp.languages }}</td>
						<td>
							<!-- language entry and header title -->
							<div class="column gap">
								<div class="row gap centered" v-for="(l,i) in inputs.languages">
									<input type="text"
										v-model="inputs.languages[i]"
										:disabled="readonly"
										:placeholder="capApp.languageCodeHint"
									/>
									<my-button image="delete.png"
										@trigger="inputs.languages.splice(i,1)"
										:active="!readonly"
										:cancel="true"
									/>
								</div>
								<div>
									<my-button image="add.png"
										@trigger="inputs.languages.push('')"
										:active="!readonly"
										:caption="capGen.button.add"
									/>
								</div>
							</div>
						</td>
						<td>{{ capApp.languagesHint }}</td>
					</tr>
					<tr>
						<td>{{ capApp.languageMain }}</td>
						<td>
							<select v-model="inputs.languageMain" :disabled="readonly">
								<option
									v-for="l in inputs.languages"
									:value="l"
								>{{ l }}</option>
							</select>
						</td>
						<td>{{ capApp.languageMainHint }}</td>
					</tr>
					
					<tr>
						<td colspan="2"><b>{{ capApp.pwa }}</b></td>
						<td>{{ capApp.pwaHint }}</td>
					</tr>
					<tr>
						<td>{{ capApp.namePwa }}</td>
						<td>
							<input maxlength="60"
								:disabled="readonly"
								:value="inputs.namePwa === null ? '' : inputs.namePwa"
								@input="applyNullString('namePwa',$event.target.value)"
							/>
						</td>
						<td>{{ capApp.namePwaHint }}</td>
					</tr>
					<tr>
						<td>{{ capApp.namePwaShort }}</td>
						<td>
							<input maxlength="12"
								:disabled="readonly"
								:value="inputs.namePwaShort === null ? '' : inputs.namePwaShort"
								@input="applyNullString('namePwaShort',$event.target.value)"
							/>
						</td>
						<td>{{ capApp.namePwaShortHint }}</td>
					</tr>
					<tr>
						<td>{{ capApp.iconPwa }}</td>
						<td>
							<div class="row gap centered">
								<span>192x192 px</span>
								<my-builder-icon-input
									@input="inputs.iconIdPwa1 = $event"
									:icon-id-selected="inputs.iconIdPwa1"
									:module="moduleSchema"
									:readonly
								/>
								<span></span>
								<span>512x512 px</span>
								<my-builder-icon-input
									@input="inputs.iconIdPwa2 = $event"
									:icon-id-selected="inputs.iconIdPwa2"
									:module="moduleSchema"
									:readonly
								/>
							</div>
						</td>
						<td>{{ capApp.iconPwaHint }}</td>
					</tr>
					
					<tr>
						<td colspan="3"><b>{{ capGen.functions }}</b></td>
					</tr>
					<tr>
						<td>{{ capApp.jsFunctionIdOnLogin }}</td>
						<td>
							<div class="row gap">
								<select
									@input="applyNullString('jsFunctionIdOnLogin',$event.target.value)"
									:disabled="readonly"
									:value="inputs.jsFunctionIdOnLogin === null ? '' : inputs.jsFunctionIdOnLogin"
								>
									<option value="">-</option>
									<option v-for="fnc in moduleSchema.jsFunctions.filter(v => v.formId === null)" :value="fnc.id">
										{{ fnc.name }}
									</option>
								</select>
								<my-button image="open.png"
									@trigger="$router.push('/builder/js-function/'+inputs.jsFunctionIdOnLogin)"
									:active="inputs.jsFunctionIdOnLogin !== null"
									:captionTitle="capGen.button.open"
								/>
							</div>
						</td>
						<td>{{ capApp.jsFunctionIdOnLoginHint }}</td>
					</tr>
					<tr>
						<td>{{ capApp.pgFunctionIdLoginSync }}</td>
						<td>
							<div class="column gap">
								<div class="row gap">
									<select
										@input="applyNullString('pgFunctionIdLoginSync',$event.target.value)"
										:disabled="readonly"
										:value="inputs.pgFunctionIdLoginSync === null ? '' : inputs.pgFunctionIdLoginSync"
									>
										<option value="">-</option>
										<option v-for="fnc in moduleSchema.pgFunctions.filter(v => v.isLoginSync)" :value="fnc.id">
											{{ fnc.name }}
										</option>
									</select>
									<my-button image="open.png"
										@trigger="$router.push('/builder/pg-function/'+inputs.pgFunctionIdLoginSync)"
										:active="inputs.pgFunctionIdLoginSync !== null"
										:captionTitle="capGen.button.open"
									/>
								</div>
								<div class="row">
									<my-button image="add.png"
										@trigger="setNewLoginSync"
										:active="!readonly"
										:caption="capApp.button.loginSyncCreate"
									/>
								</div>
							</div>
						</td>
						<td>{{ capApp.pgFunctionIdLoginSyncHint }}</td>
					</tr>
					
					<tr>
						<td colspan="2">
							<div class="column gap">
								<span><b>{{ capGen.clientEvents }}</b></span>

								<div class="generic-entry-list height-large">
									<div class="entry"
										v-if="!readonly"
										@click="clientEventIdEdit = null"
										:class="{ clickable:!readonly }"
									>
										<div class="row gap centered">
											<img class="icon" src="images/add.png" />
											<span>{{ capGen.button.new }}</span>
										</div>
									</div>
									
									<div class="entry clickable"
										@click="clientEventIdEdit = ce.id"
										v-for="ce in inputs.clientEvents"
									>
										<div class="row centered gap">
											<div class="lines">
												<span>{{ ce.captions.clientEventTitle[builderLanguage] }}</span>
												<span class="subtitle">[{{ clientEventSubtitle(ce) }}]</span>
											</div>
										</div>
									</div>
									<my-builder-client-event
										v-if="clientEventIdEdit !== false"
										@close="clientEventIdEdit = false"
										@nextLanguage="$emit('nextLanguage')"
										@newRecord="clientEventIdEdit = null"
										:builderLanguage="builderLanguage"
										:id="clientEventIdEdit"
										:module="moduleSchema"
										:readonly
									/>
								</div>
							</div>
						</td>
						<td>{{ capApp.clientEventsHint }}</td>
					</tr>
					
					<tr><td colspan="3"><b>{{ capApp.release }}</b></td></tr>
					<tr>
						<td>{{ capApp.releaseLogCategories }}</td>
						<td>
							<div class="column gap">
								<div class="row gap" v-for="(c,i) in inputs.releaseLogCategories">
									<input
										v-model="inputs.releaseLogCategories[i]"
										:disabled="readonly"
									/>
									<my-button image="cancel.png"
										v-if="i === inputs.releaseLogCategories.length - 1"
										@trigger="inputs.releaseLogCategories.pop()"
										:active="!readonly"
										:naked="true"
									/>
								</div>
								<div>
									<my-button image="add.png"
										@trigger="inputs.releaseLogCategories.push('')"
										:active="!readonly"
										:caption="capGen.button.add"
									/>
								</div>
							</div>
						</td>
						<td>{{ capApp.releaseLogCategoriesHint }}</td>
					</tr>
					<tr>
						<td>{{ capApp.releaseDate }}</td>
						<td colspan="2"><input :value="displayReleaseDate" disabled="disabled" /></td>
					</tr>
					<tr>
						<td>{{ capGen.versionApp }}</td>
						<td colspan="2"><input class="short" :value="moduleSchema.releaseBuild" disabled="disabled" /></td>
					</tr>
					<tr>
						<td>{{ capGen.versionPlatform }}</td>
						<td colspan="2"><input class="short" :value="moduleSchema.releaseBuildApp" disabled="disabled" /></td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		id:             { type:String,  required:true },
		readonly:       { type:Boolean, required:true }
	},
	mounted() {
		this.$store.commit('keyDownHandlerAdd',{fnc:this.set,key:'s',keyCtrl:true});
	},
	unmounted() {
		this.$store.commit('keyDownHandlerDel',this.set);
	},
	data() {
		return {
			inputs:{},
			inputsCopy:{}, // copy of inputs, to be compared against schema on change
			isReady:false,
			
			// states
			clientEventIdEdit:false,
			moduleIdDependsOnInput:null,
			showDependencies:false,
			showLanguages:false,
			showStartForms:false
		};
	},
	computed:{
		// simple
		displayReleaseDate:s => s.moduleSchema.releaseDate === 0 ? '-' : s.getUnixFormat(s.moduleSchema.releaseDate,'Y-m-d H:i'),
		isChanged:         s => !s.deepIsEqual(s.inputs,s.inputsCopy),
		moduleSchema:      s => s.moduleIdMap[s.id] === undefined ? false : s.moduleIdMap[s.id],
		
		// stores
		attributeIdMap:   s => s.$store.getters['schema/attributeIdMap'],
		jsFunctionIdMap:  s => s.$store.getters['schema/jsFunctionIdMap'],
		modules:          s => s.$store.getters['schema/modules'],
		moduleIdMap:      s => s.$store.getters['schema/moduleIdMap'],
		pgFunctionIdMap:  s => s.$store.getters['schema/pgFunctionIdMap'],
		relationIdMap:    s => s.$store.getters['schema/relationIdMap'],
		capApp:           s => s.$store.getters.captions.builder.module,
		capAppClientEvent:s => s.$store.getters.captions.builder.clientEvent,
		capGen:           s => s.$store.getters.captions.generic
	},
	watch:{
		moduleSchema:{
			handler() { this.reset(false); },
			immediate:true
		}
	},
	methods:{
		// externals
		copyValueDialog,
		deepIsEqual,
		getDependentModules,
		getRandomInt,
		getTemplatePgFunction,
		getUnixFormat,
		srcBase64Icon,
		
		reset(manuelReset) {
			if(this.moduleSchema === false)
				return;

			const inputsSchema = this.cloneInputs(this.moduleSchema);
			if(manuelReset || !this.deepIsEqual(this.inputsCopy,inputsSchema)) {
				this.inputs     = this.cloneInputs(inputsSchema);
				this.inputsCopy = this.cloneInputs(inputsSchema);
				this.isReady    = true;
			}
		},
		
		// actions
		addStartForm() {
			this.inputs.startForms.push({
				position:this.inputs.startForms.length,
				formId:null,
				roleId:null
			});
		},
		applyNullString(key,value) {
			this.inputs[key] = value === '' ? null : value;
		},
		cloneInputs(src) {
			return {
				id:src.id,
				name:src.name,
				iconId:src.iconId,
				color1:src.color1,
				parentId:src.parentId,
				position:src.position,
				formId:src.formId,
				namePwa:src.namePwa,
				namePwaShort:src.namePwaShort,
				iconIdPwa1:src.iconIdPwa1,
				iconIdPwa2:src.iconIdPwa2,
				languageMain:src.languageMain,
				jsFunctionIdOnLogin:src.jsFunctionIdOnLogin,
				pgFunctionIdLoginSync:src.pgFunctionIdLoginSync,
				articleIdsHelp:JSON.parse(JSON.stringify(src.articleIdsHelp)),
				captions:JSON.parse(JSON.stringify(src.captions)),
				dependsOn:JSON.parse(JSON.stringify(src.dependsOn)),
				startForms:JSON.parse(JSON.stringify(src.startForms)),
				languages:JSON.parse(JSON.stringify(src.languages)),
				clientEvents:JSON.parse(JSON.stringify(src.clientEvents)),
				releaseBuild:src.releaseBuild,
				releaseBuildApp:src.releaseBuildApp,
				releaseDate:src.releaseDate,
				releases:JSON.parse(JSON.stringify(src.releases)),
				releaseLogCategories:JSON.parse(JSON.stringify(src.releaseLogCategories))
			};
		},
		toggleDependsOn(moduleId,state) {
			const pos = this.inputs.dependsOn.indexOf(moduleId);
			if     (pos === -1 && state)  this.inputs.dependsOn.push(moduleId);
			else if(pos !== -1 && !state) this.inputs.dependsOn.splice(pos,1);
		},

		// presentation
		clientEventSubtitle(clientEvent) {
			if(clientEvent.action === 'callJsFunction')
				return `${this.capAppClientEvent.action.callJsFunction}: ${this.jsFunctionIdMap[clientEvent.jsFunctionId].name}()`;

			if(clientEvent.action === 'callPgFunction')
				return `${this.capAppClientEvent.action.callPgFunction}: ${this.pgFunctionIdMap[clientEvent.pgFunctionId].name}()`;

			return '-';
		},
		
		// backend calls
		set() {
			// for module change comparissons
			this.inputs.languages.sort();

			ws.sendMultiple([
				ws.prepare('module','set',this.inputs),
				ws.prepare('schema','check',{moduleId:this.id})
			],true).then(
				() => this.$root.schemaReload(this.id),
				this.$root.genericError
			);
		},
		setNewLoginSync() {
			let fncName = 'user_sync';
			for(let fnc of this.moduleSchema.pgFunctions) {
				if(fnc.name === fncName) {
					fncName = `user_sync_${this.getRandomInt(100000,200000)}`;
					break;
				}
			}
			ws.sendMultiple([
				ws.prepare('pgFunction','set',this.getTemplatePgFunction(this.id,fncName,'loginSync',false)),
				ws.prepare('schema','check',{moduleId:this.id})
			],true).then(
				() => this.$root.schemaReload(this.id),
				this.$root.genericError
			);
		}
	}
};
