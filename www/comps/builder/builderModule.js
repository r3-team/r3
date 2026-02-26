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
	template:`<div class="builder-module contentBox grow" v-if="module">
		<div class="top">
			<div class="area nowrap">
				<img class="icon" src="images/module.png" />
				<h1 class="title">{{ capApp.title.replace('{NAME}',module.name) }}</h1>
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
					@trigger="copyValueDialog(module.name,id,id)"
					:caption="capGen.id"
				/>
			</div>
		</div>
		
		<div class="content default-inputs no-padding">
			<table class="generic-table-vertical w1200">
				<tbody>
					<tr>
						<td>{{ capGen.name }}</td>
						<td><input v-model="module.name" :disabled="readonly" :placeholder="capApp.nameHolder" /></td>
						<td>{{ capApp.nameHint }}</td>
					</tr>
					<tr>
						<td>{{ capGen.title }}</td>
						<td>
							<my-builder-caption class="title"
								v-model="module.captions.moduleTitle"
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
									v-for="m in modules.filter(v => v.id !== id && module.dependsOn.includes(v.id))"
									@trigger="toggleDependsOn(m.id,false)"
									:active="!readonly"
									:caption="m.name"
									:naked="true"
								/>
							</div>
							<my-module-select
								v-if="!readonly"
								@update:modelValue="toggleDependsOn($event,true)"
								:moduleIdsFilter="module.dependsOn.concat([id])"
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
								@input="module.iconId = $event"
								:icon-id-selected="module.iconId"
								:module
								:readonly
							/>
						</td>
						<td>{{ capApp.iconHint }}</td>
					</tr>
					<tr>
						<td>{{ capApp.color }}</td>
						<td><my-input-color-wrap v-model="module.color1" :allowNull="true" :readonly /></td>
						<td>{{ capApp.colorHint }}</td>
					</tr>
					<tr>
						<td>{{ capApp.parent }}</td>
						<td>
							<select v-model="module.parentId" :disabled="readonly">
								<option :value="null">-</option>
								<option
									v-for="mod in getDependentModules(module).filter(v => v.id !== id && v.parentId === null)"
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
						<td><input class="short" v-model.number="module.position" :disabled="readonly" /></td>
						<td>{{ capApp.positionHint }}</td>
					</tr>
					<tr>
						<td>{{ capApp.startFormDefault }}</td>
						<td>
							<my-builder-select-form
								v-model="module.formId"
								:allowAllForms="true"
								:module
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
									:list="module.startForms"
								>
									<template #item="{element,index}">
										<my-builder-module-start-form
											@remove="module.startForms.splice(index,1)"
											@update:modelValue="module.startForms[index] = $event"
											:modelValue="element"
											:module
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
								<div class="row gap centered" v-for="(l,i) in module.languages">
									<input type="text"
										v-model="module.languages[i]"
										:disabled="readonly"
										:placeholder="capApp.languageCodeHint"
									/>
									<my-button image="delete.png"
										@trigger="module.languages.splice(i,1)"
										:active="!readonly"
										:cancel="true"
									/>
								</div>
								<div>
									<my-button image="add.png"
										@trigger="module.languages.push('')"
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
							<select v-model="module.languageMain" :disabled="readonly">
								<option
									v-for="l in module.languages"
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
								:value="module.namePwa === null ? '' : module.namePwa"
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
								:value="module.namePwaShort === null ? '' : module.namePwaShort"
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
									@input="module.iconIdPwa1 = $event"
									:icon-id-selected="module.iconIdPwa1"
									:module
									:readonly
								/>
								<span></span>
								<span>512x512 px</span>
								<my-builder-icon-input
									@input="module.iconIdPwa2 = $event"
									:icon-id-selected="module.iconIdPwa2"
									:module
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
									:value="module.jsFunctionIdOnLogin === null ? '' : module.jsFunctionIdOnLogin"
								>
									<option value="">-</option>
									<option v-for="fnc in module.jsFunctions.filter(v => v.formId === null)" :value="fnc.id">
										{{ fnc.name }}
									</option>
								</select>
								<my-button image="open.png"
									@trigger="$router.push('/builder/js-function/'+module.jsFunctionIdOnLogin)"
									:active="module.jsFunctionIdOnLogin !== null"
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
										:value="module.pgFunctionIdLoginSync === null ? '' : module.pgFunctionIdLoginSync"
									>
										<option value="">-</option>
										<option v-for="fnc in module.pgFunctions.filter(v => v.isLoginSync)" :value="fnc.id">
											{{ fnc.name }}
										</option>
									</select>
									<my-button image="open.png"
										@trigger="$router.push('/builder/pg-function/'+module.pgFunctionIdLoginSync)"
										:active="module.pgFunctionIdLoginSync !== null"
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
										v-for="ce in module.clientEvents"
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
										:module
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
								<div class="row gap" v-for="(c,i) in module.releaseLogCategories">
									<input
										v-model="module.releaseLogCategories[i]"
										:disabled="readonly"
									/>
									<my-button image="cancel.png"
										v-if="i === module.releaseLogCategories.length - 1"
										@trigger="module.releaseLogCategories.pop()"
										:active="!readonly"
										:naked="true"
									/>
								</div>
								<div>
									<my-button image="add.png"
										@trigger="module.releaseLogCategories.push('')"
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
						<td colspan="2"><input class="short" v-model="module.releaseBuild" disabled="disabled" /></td>
					</tr>
					<tr>
						<td>{{ capGen.versionPlatform }}</td>
						<td colspan="2"><input class="short" v-model="module.releaseBuildApp" disabled="disabled" /></td>
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
			module:false,  // module being edited in this component
			moduleCopy:{}, // copy of module from schema when component last reset
			
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
		displayReleaseDate:s => s.module.releaseDate === 0 ? '-' : s.getUnixFormat(s.module.releaseDate,'Y-m-d H:i'),
		isChanged:         s => !s.deepIsEqual(s.module,s.moduleSchema),
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
			if(this.moduleSchema !== false && (manuelReset || !this.deepIsEqual(this.moduleCopy,this.moduleSchema))) {
				this.module     = JSON.parse(JSON.stringify(this.moduleSchema));
				this.moduleCopy = JSON.parse(JSON.stringify(this.moduleSchema));
			}
		},
		
		// actions
		addStartForm() {
			this.module.startForms.push({
				position:this.module.startForms.length,
				formId:null,
				roleId:null
			});
		},
		applyNullString(key,value) {
			this.module[key] = value === '' ? null : value;
		},
		goBack() {
			window.history.back();
		},
		toggleDependsOn(moduleId,state) {
			const pos = this.module.dependsOn.indexOf(moduleId);
			if     (pos === -1 && state)  this.module.dependsOn.push(moduleId);
			else if(pos !== -1 && !state) this.module.dependsOn.splice(pos,1);
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
			this.module.languages.sort();

			ws.sendMultiple([
				ws.prepare('module','set',this.module),
				ws.prepare('schema','check',{moduleId:this.id})
			],true).then(
				() => this.$root.schemaReload(this.id),
				this.$root.genericError
			);
		},
		setNewLoginSync() {
			let fncName = 'user_sync';
			for(let fnc of this.module.pgFunctions) {
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
