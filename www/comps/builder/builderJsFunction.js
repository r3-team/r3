import MyBuilderCaption   from './builderCaption.js';
import MyBuilderQuery     from './builderQuery.js';
import {getFieldMap}      from '../shared/form.js';
import {getJoinsIndexMap} from '../shared/query.js';
import MyTabs             from '../tabs.js';
import {
	getDependentModules,
	getFormEntityMapRef,
	getFunctionHelp,
	getItemTitle,
	getItemTitlePath
} from '../shared/builder.js';
import {
	copyValueDialog,
	textAddTab
} from '../shared/generic.js';
export {MyBuilderJsFunction as default};

let MyBuilderJsFunction = {
	name:'my-builder-js-function',
	components:{
		MyBuilderCaption,
		MyBuilderQuery,
		MyTabs
	},
	template:`<div class="builder-function">
		
		<div class="contentBox" v-if="jsFunction">
			<div class="top">
				<div class="area nowrap">
					<img class="icon" src="images/codeScreen.png" />
					<h1 class="title">{{ capApp.titleJsOne.replace('{NAME}',name) }}</h1>
				</div>
				<div class="area">
					<my-builder-caption
						v-model="captions.jsFunctionTitle"
						:contentName="capGen.title"
						:language="builderLanguage"
						:longInput="true"
					/>
				</div>
				<div class="area">
					<my-button
						@trigger="showSidebar = !showSidebar"
						:image="showSidebar ? 'toggleRight.png' : 'toggleLeft.png'"
					/>
				</div>
			</div>
			<div class="top lower">
				<div class="area nowrap">
					<my-button image="save.png"
						@trigger="set"
						:active="hasChanges && !readonly"
						:caption="capGen.button.save"
					/>
					<my-button image="refresh.png"
						@trigger="reset"
						:active="hasChanges"
						:caption="capGen.button.refresh"
					/>
					<my-button image="visible1.png"
						@trigger="copyValueDialog(name,id,id)"
						:caption="capGen.id"
					/>
					<my-button
						@trigger="showPreview = !showPreview"
						:caption="capGen.preview"
						:image="showPreview ? 'checkbox1.png' : 'checkbox0.png'"
					/>
					<my-button image="delete.png"
						@trigger="delAsk"
						:active="!readonly"
						:cancel="true"
						:caption="capGen.button.delete"
						:captionTitle="capGen.button.delete"
					/>
				</div>
			</div>
			
			<div class="content no-padding function-details default-inputs">
				
				<!-- function body input -->
				<textarea class="input"
					v-if="!showPreview"
					v-model="codeFunction"
					@click="insertEntity"
					@keydown.tab.prevent="codeFunction = textAddTab($event)"
					:disabled="readonly"
					:placeholder="capApp.code"
				></textarea>
				
				<!-- function body preview -->
				<textarea class="input" disabled="disabled"
					v-if="showPreview"
					v-model="preview"
				></textarea>
			</div>
		</div>
		
		<div class="contentBox sidebar right" v-if="jsFunction && showSidebar">
			<div class="top lower">
				<div class="area nowrap">
					<h1 class="title">{{ capGen.settings }}</h1>
				</div>
			</div>
			
			<my-tabs
				v-model="tabTarget"
				:entries="['content','properties']"
				:entriesIcon="['images/database.png','images/edit.png']"
				:entriesText="[capApp.placeholders,capGen.properties]"
			/>
			
			<div class="content padding default-inputs">
				
				<template v-if="tabTarget === 'content'">
					<div class="message" v-html="capApp.entityInput"></div>
					
					<template v-if="form !== false && form.query.joins.length !== 0">
						<div class="placeholders">
							
							<!-- read only form query view -->
							<h2>{{ capApp.placeholdersFormQuery }}</h2>
							
							<my-builder-query
								:allowChoices="false"
								:allowFixedLimit="false"
								:allowFilters="false"
								:allowJoinEdit="false"
								:builderLanguage="builderLanguage"
								:choices="form.query.choices"
								:filters="form.query.filters"
								:fixedLimit="0"
								:joins="form.query.joins"
								:lookups="form.query.lookups"
								:moduleId="form.moduleId"
								:orders="form.query.orders"
								:relationId="form.query.relationId"
							/>
						</div>
						
						<!-- current form data field input -->
						<div class="entities-title">
							<my-button
								@trigger="showHolderFields = !showHolderFields"
								:caption="capApp.placeholdersFormFields"
								:image="showHolderFields ? 'triangleDown.png' : 'triangleRight.png'"
								:large="true"
								:naked="true"
							/>
							<div class="row centered gap">
								<template v-if="showHolderFields">
									<my-button
										@trigger="holderFieldOnlyData = !holderFieldOnlyData"
										:caption="capApp.fieldsOnlyData"
										:image="holderFieldOnlyData ? 'checkbox1.png' : 'checkbox0.png'"
										:naked="true"
									/>
									<input class="short" v-model="holderFieldFilter" :placeholder="capGen.threeDots" :title="capGen.button.filter" />
								</template>
							</div>
						</div>
						<div class="entities" v-if="showHolderFields">
							<div class="entity" v-for="field in fieldsSorted.filter(v => holderFieldFilter === '' || v.name.toLowerCase().includes(holderFieldFilter.toLowerCase())).filter(v => !holderFieldOnlyData || v.isData)">
								<div class="entity-title">
									<my-button
										@trigger="toggleFieldShow(field.id)"
										:image="holderFieldIdsOpen.includes(field.id) ? 'triangleDown.png' : 'triangleRight.png'"
										:naked="true"
										:caption="field.name"
									/>
								</div>
								<div class="entity-children" v-if="holderFieldIdsOpen.includes(field.id)">
									<template v-if="field.isData">
										<my-button
											@trigger="selectEntity('field_value_get',field.id)"
											:caption="capApp.option.fieldGetValue"
											:image="radioIcon('field_value_get',field.id)"
											:naked="true"
										/>
										<my-button
											@trigger="selectEntity('field_value_set',field.id)"
											:caption="capApp.option.fieldSetValue"
											:image="radioIcon('field_value_set',field.id)"
											:naked="true"
										/>
										<my-button
											@trigger="selectEntity('field_caption_set',field.id)"
											:caption="capApp.option.fieldSetCaption"
											:image="radioIcon('field_caption_set',field.id)"
											:naked="true"
										/>
										<my-button
											@trigger="selectEntity('field_error_set',field.id)"
											:caption="capApp.option.fieldSetError"
											:image="radioIcon('field_error_set',field.id)"
											:naked="true"
										/>
										<my-button
											@trigger="selectEntity('field_focus_set',field.id)"
											:caption="capApp.option.fieldSetFocus"
											:image="radioIcon('field_focus_set',field.id)"
											:naked="true"
										/>
									</template>
									<my-button
										@trigger="selectEntity('field_order_set',field.id)"
										:caption="capApp.option.fieldSetOrder"
										:image="radioIcon('field_order_set',field.id)"
										:naked="true"
									/>
								</div>
							</div>
						</div>
					</template>
					
					<!-- collection input -->
					<div class="entities-title">
						<my-button
							@trigger="showHolderCollection = !showHolderCollection"
							:caption="capApp.placeholdersCollections"
							:image="showHolderCollection ? 'triangleDown.png' : 'triangleRight.png'"
							:large="true"
							:naked="true"
						/>
						<div class="row centered gap">
							<template v-if="showHolderCollection">
								<input class="short" v-model="holderCollectionFilter" :placeholder="capGen.threeDots" :title="capGen.button.filter" />
								<select class="dynamic" v-model="holderCollectionModuleId">
									<option v-for="m in getDependentModules(module,modules).filter(v => v.id === module.id || v.collections.length !== 0)" :value="m.id">{{ m.name }}</option>
								</select>
							</template>
						</div>
					</div>
					<div class="entities" v-if="showHolderCollection">
						<div class="entity" v-for="c in moduleIdMap[holderCollectionModuleId].collections.filter(v => holderCollectionFilter === '' || v.name.toLowerCase().includes(holderCollectionFilter.toLowerCase()))">
							<div class="entity-title">
								<my-button
									@trigger="toggleCollectionShow(c.id)"
									:image="holderCollectionIdsOpen.includes(c.id) ? 'triangleDown.png' : 'triangleRight.png'"
									:naked="true"
									:caption="c.name"
									:captionTitle="c.name"
								/>
								<router-link :key="c.id" :to="'/builder/collection/'+c.id">
									<my-button image="open.png" :captionTitle="capGen.button.open" :naked="true" />
								</router-link>
							</div>
							<div class="entity-children" v-if="holderCollectionIdsOpen.includes(c.id)">
								<div class="entity-title">
									<my-button
										@trigger="selectEntity('collection_read',c.id)"
										:caption="capGen.button.read"
										:image="radioIcon('collection_read',c.id)"
										:naked="true"
									/>
									<my-button
										@trigger="selectEntity('collection_update',c.id)"
										:caption="capGen.button.update"
										:image="radioIcon('collection_update',c.id)"
										:naked="true"
									/>
								</div>
							</div>
						</div>
					</div>
					
					<!-- frontend functions -->
					<div class="entities-title">
						<my-button
							@trigger="showHolderFncFrontend = !showHolderFncFrontend"
							:caption="capApp.placeholderFncFrontend"
							:image="showHolderFncFrontend ? 'triangleDown.png' : 'triangleRight.png'"
							:large="true"
							:naked="true"
						/>
						<div class="row centered gap">
							<template v-if="showHolderFncFrontend">
								<input class="short" v-model="holderFncFrontendFilter" :placeholder="capGen.threeDots" :title="capGen.button.filter" />
								<select class="dynamic" v-model="holderFncFrontendModuleId">
									<option v-for="m in modulesFncFrontend" :value="m.id">{{ m.name }}</option>
								</select>
							</template>
						</div>
					</div>
					<div class="entities" v-if="showHolderFncFrontend">
						<div class="entity" v-for="fnc in jsFunctionsSorted.filter(v => holderFncFrontendFilter === '' || v.name.toLowerCase().includes(holderFncFrontendFilter.toLowerCase()))">
							<div class="entity-title">
								<my-button
									@trigger="selectEntity('jsFunction',fnc.id)"
									:adjusts="true"
									:caption="fnc.formId === null ? fnc.name : form.name + ': ' + fnc.name"
									:captionTitle="fnc.name"
									:image="radioIcon('jsFunction',fnc.id)"
									:naked="true"
								/>
								<div class="row centered">
									<my-button image="question.png"
										@trigger="showHelp(fnc.name+'()',getFunctionHelp('js',fnc,builderLanguage))"
										:active="getFunctionHelp('js',fnc,builderLanguage) !== ''"
										:captionTitle="capGen.help"
										:naked="true"
									/>
									<router-link :key="fnc.id" :to="'/builder/js-function/'+fnc.id">
										<my-button image="open.png" :captionTitle="capGen.button.open" :naked="true" />
									</router-link>
								</div>
							</div>
						</div>
					</div>
					
					<!-- backend functions -->
					<div class="entities-title">
						<my-button
							@trigger="showHolderFncBackend = !showHolderFncBackend"
							:caption="capApp.placeholderFncBackend"
							:image="showHolderFncBackend ? 'triangleDown.png' : 'triangleRight.png'"
							:large="true"
							:naked="true"
						/>
						<div class="row centered gap">
							<template v-if="showHolderFncBackend">
								<input class="short" v-model="holderFncBackendFilter" :placeholder="capGen.threeDots" :title="capGen.button.filter" />
								<select class="dynamic" v-model="holderFncBackendModuleId">
									<option v-for="m in modulesFncBackend" :value="m.id">{{ m.name }}</option>
								</select>
							</template>
						</div>
					</div>
					<div class="entities" v-if="showHolderFncBackend">
						<div class="entity" v-for="fnc in moduleIdMap[holderFncBackendModuleId].pgFunctions.filter(v => v.isFrontendExec && (holderFncBackendFilter === '' || v.name.toLowerCase().includes(holderFncBackendFilter.toLowerCase())))">
							<div class="entity-title">
								<my-button
									@trigger="selectEntity('pgFunction',fnc.id)"
									:adjusts="true"
									:caption="fnc.name"
									:captionTitle="fnc.name"
									:image="radioIcon('pgFunction',fnc.id)"
									:naked="true"
								/>
								<div class="row centered">
									<my-button image="question.png"
										@trigger="showHelp(fnc.name+'()',getFunctionHelp('pg',fnc,builderLanguage))"
										:active="getFunctionHelp('pg',fnc,builderLanguage) !== ''"
										:captionTitle="capGen.help"
										:naked="true"
									/>
									<router-link :key="fnc.id" :to="'/builder/pg-function/'+fnc.id">
										<my-button image="open.png" :captionTitle="capGen.button.open" :naked="true" />
									</router-link>
								</div>
							</div>
						</div>
					</div>
					
					<!-- instance functions -->
					<div class="entities-title">
						<my-button
							@trigger="showHolderFncInstance = !showHolderFncInstance"
							:caption="capApp.placeholderFncInstance"
							:image="showHolderFncInstance ? 'triangleDown.png' : 'triangleRight.png'"
							:large="true"
							:naked="true"
						/>
					</div>
					<div class="entities" v-if="showHolderFncInstance">
						<div class="entity" v-for="fnc in appFunctions">
							<div class="entity-title">
								<my-button
									@trigger="selectEntity('appFunction',fnc)"
									:adjusts="true"
									:caption="fnc"
									:captionTitle="fnc"
									:image="radioIcon('appFunction',fnc)"
									:naked="true"
								/>
								<my-button image="question.png"
									@trigger="showHelp(fnc+'()',capApp.helpJs[fnc])"
									:captionTitle="capGen.help"
									:naked="true"
								/>
							</div>
						</div>
					</div>
				</template>
				
				<template v-if="tabTarget === 'properties'">
					<table class="generic-table-vertical tight fullWidth">
						<tr>
							<td>{{ capGen.name }}</td>
							<td><input v-model="name" :disabled="readonly" /></td>
						</tr>
						<tr>
							<td>{{ capGen.title }}</td>
							<td>
								<my-builder-caption
									v-model="captions.jsFunctionTitle"
									:language="builderLanguage"
									:readonly="readonly"
								/>
							</td>
						</tr>
						<tr>
							<td>{{ capGen.description }}</td>
							<td>
								<my-builder-caption
									v-model="captions.jsFunctionDesc"
									:language="builderLanguage"
									:multiLine="true"
									:readonly="readonly"
								/>
							</td>
						</tr>
						<tr>
							<td>{{ capApp.form }}</td>
							<td>
								<div class="row centered">
									<select v-model="formId" disabled>
										<option :value="null">-</option>
										<option v-for="f in moduleIdMap[jsFunction.moduleId].forms" :value="f.id">
											{{ f.name }}
										</option>
									</select>
									<my-button image="open.png"
										@trigger="openForm"
										:active="formId !== null"
									/>
								</div>
							</td>
						</tr>
						<tr>
							<td>{{ capApp.codeArgs }}</td>
							<td>
								<textarea
									v-model="codeArgs"
									:disabled="readonly"
									:placeholder="capApp.codeArgsHintJs"
								></textarea>
							</td>
						</tr>
						<tr>
							<td>{{ capApp.codeReturns }}</td>
							<td>
								<input
									v-model="codeReturns"
									:disabled="readonly"
									:placeholder="capApp.codeReturnsHintJs"
								/>
							</td>
						</tr>
					</table>
				</template>
			</div>
		</div>
	</div>`,
	emits:['hotkeysRegister'],
	props:{
		builderLanguage:{ type:String,  required:true },
		id:             { type:String,  required:true },
		readonly:       { type:Boolean, required:true }
	},
	watch:{
		jsFunction:{
			handler() { this.reset(); },
			immediate:true
		}
	},
	mounted() {
		this.$emit('hotkeysRegister',[{fnc:this.set,key:'s',keyCtrl:true}]);
		
		// set defaults
		this.holderCollectionModuleId  = this.module.id;
		this.holderFncBackendModuleId  = this.module.id;
		this.holderFncFrontendModuleId = this.module.id;
	},
	unmounted() {
		this.$emit('hotkeysRegister',[]);
	},
	data() {
		return {
			name:'',
			formId:null,
			captions:{},
			codeArgs:'',
			codeFunction:'',
			codeReturns:'',
			appFunctions:[
				'block_inputs','copy_to_clipboard','form_close','form_open',
				'form_set_title','form_show_message','get_e2ee_data_key',
				'get_e2ee_data_value','get_language_code','get_login_id',
				'get_preset_record_id','get_record_id','get_role_ids','go_back',
				'has_role','pdf_create','record_delete','record_new',
				'record_reload','record_save','record_save_new',
				'set_e2ee_by_login_ids','set_e2ee_by_login_ids_and_relation',
				'timer_clear','timer_set','value_store_get','value_store_set'
			],
			appFunctionsAsync:[
				'get_e2ee_data_key','get_e2ee_data_value'
			],
			
			// states
			entity:'', // selected placeholder entity
			entityId:null,
			entityJsModuleId:null,
			entityPgModuleId:null,
			holderCollectionFilter:'',
			holderCollectionIdsOpen:[],
			holderCollectionModuleId:null,
			holderFieldFilter:'',
			holderFieldIdsOpen:[],
			holderFieldOnlyData:true,
			holderFncBackendFilter:'',
			holderFncBackendModuleId:null,
			holderFncFrontendFilter:'',
			holderFncFrontendModuleId:null,
			showHolderCollection:false,
			showHolderFields:false,
			showHolderFncBackend:false,
			showHolderFncFrontend:false,
			showHolderFncInstance:false,
			showPreview:false,
			showSidebar:true,
			tabTarget:'content'
		};
	},
	computed:{
		fieldsSorted:(s) => {
			let out = [];
			for(let id in s.entityIdMapRef.field) {
				out.push({
					id:id,
					isData:s.fieldIdMap[id].content === 'data',
					name:s.displayFieldName(id),
					ref:s.entityIdMapRef.field[id]
				});
			}
			return out.sort((a, b) => a.ref - b.ref);
		},
		hasChanges:(s) => s.name     !== s.jsFunction.name
			|| s.codeArgs            !== s.jsFunction.codeArgs
			|| s.codeFunction        !== s.placeholdersSet(s.jsFunction.codeFunction)
			|| s.codeReturns         !== s.jsFunction.codeReturns
			|| JSON.stringify(s.captions) !== JSON.stringify(s.jsFunction.captions),
		
		functionHelpJs:(s) => s.entity === 'jsFunction' && s.entityId !== null
			? s.getFunctionHelp('js',s.jsFunctionIdMap[s.entityId],s.builderLanguage) : '',
		
		functionHelpPg:(s) => s.entity === 'pgFunction' && s.entityId !== null
			? s.getFunctionHelp('pg',s.pgFunctionIdMap[s.entityId],s.builderLanguage) : '',
		jsFunctionsSorted:(s) => s.moduleIdMap[s.holderFncFrontendModuleId].jsFunctions.filter(v => v.formId === null).concat(
			s.moduleIdMap[s.holderFncFrontendModuleId].jsFunctions.filter(v => v.formId === s.formId && s.formId !== null)),
		
		// simple
		entityIdMapRef:    (s) => s.formId === null ? {} : s.getFormEntityMapRef(s.form.fields),
		fieldIdMap:        (s) => s.formId === null ? {} : s.getFieldMap(s.formIdMap[s.formId].fields),
		form:              (s) => s.formId === null ? false : s.formIdMap[s.formId],
		joinsIndexMap:     (s) => s.form !== false ? s.getJoinsIndexMap(s.form.query.joins) : {},
		jsFunction:        (s) => s.jsFunctionIdMap[s.id] === undefined ? false : s.jsFunctionIdMap[s.id],
		module:            (s) => s.jsFunction === false ? false : s.moduleIdMap[s.jsFunction.moduleId],
		modulesFncBackend: (s) => s.getDependentModules(s.module,s.modules).filter(v => v.id === s.module.id || v.pgFunctions.filter(v => v.isFrontendExec).length !== 0),
		modulesFncFrontend:(s) => s.getDependentModules(s.module,s.modules).filter(v => v.id === s.module.id || v.jsFunctions.length !== 0),
		preview:           (s) => !s.showPreview ? '' : s.placeholdersUnset(),
		
		// stores
		modules:        (s) => s.$store.getters['schema/modules'],
		moduleIdMap:    (s) => s.$store.getters['schema/moduleIdMap'],
		moduleNameMap:  (s) => s.$store.getters['schema/moduleNameMap'],
		relationIdMap:  (s) => s.$store.getters['schema/relationIdMap'],
		attributeIdMap: (s) => s.$store.getters['schema/attributeIdMap'],
		collectionIdMap:(s) => s.$store.getters['schema/collectionIdMap'],
		formIdMap:      (s) => s.$store.getters['schema/formIdMap'],
		jsFunctionIdMap:(s) => s.$store.getters['schema/jsFunctionIdMap'],
		pgFunctionIdMap:(s) => s.$store.getters['schema/pgFunctionIdMap'],
		capApp:         (s) => s.$store.getters.captions.builder.function,
		capGen:         (s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		copyValueDialog,
		getDependentModules,
		getFieldMap,
		getFormEntityMapRef,
		getFunctionHelp,
		getItemTitle,
		getItemTitlePath,
		getJoinsIndexMap,
		textAddTab,
		
		// presentation
		displayFieldName(fieldId) {
			const f = this.fieldIdMap[fieldId];
			if(f === undefined)
				return '-';
			
			return `F${this.entityIdMapRef.field[f.id]}: ${f.attributeId !== undefined ? this.getItemTitle(f.attributeId,f.index,false,null) : f.content}`;
		},
		radioIcon(entity,id) {
			return this.entity === entity && this.entityId === id
				? 'radio1.png' : 'radio0.png';
		},
		
		// actions
		openForm() {
			this.$router.push('/builder/form/'+this.formId);
		},
		reset() {
			this.name         = this.jsFunction.name;
			this.formId       = this.jsFunction.formId;
			this.codeArgs     = this.jsFunction.codeArgs;
			this.codeFunction = this.placeholdersSet(this.jsFunction.codeFunction);
			this.codeReturns  = this.jsFunction.codeReturns;
			this.captions     = JSON.parse(JSON.stringify(this.jsFunction.captions));
		},
		selectEntity(entity,id) {
			if(entity === this.entity && id === this.entityId)
				return this.entityId = null;
			
			this.entity   = entity;
			this.entityId = id;
		},
		toggleCollectionShow(id) {
			const pos = this.holderCollectionIdsOpen.indexOf(id);
			if(pos === -1) this.holderCollectionIdsOpen.push(id);
			else           this.holderCollectionIdsOpen.splice(pos,1);
		},
		toggleFieldShow(id) {
			const pos = this.holderFieldIdsOpen.indexOf(id);
			if(pos === -1) this.holderFieldIdsOpen.push(id);
			else           this.holderFieldIdsOpen.splice(pos,1);
		},
		insertEntity(evt) {
			if(this.entityId === null)
				return;
			
			let field   = evt.target;
			let text    = '';
			let prefix  = 'app';
			let postfix = '';
			let postfixAsync = '.then('
				+ '\n\tres => { }, // if success: return value in \'res\''
				+ '\n\terr => { }  // if error: error message in \'err\'\n)'
			;
			let mod, rel, atr, col, fnc, frm, fld, opt, args;
			
			// build unique placeholder name
			switch(this.entity) {
				case 'appFunction':
					opt     = '';
					postfix = '';
					
					if(typeof this.capApp.helpJsHint[this.entityId] !== 'undefined')
						opt = this.capApp.helpJsHint[this.entityId];
					
					if(this.appFunctionsAsync.includes(this.entityId))
						postfix = postfixAsync;
					
					text = `${prefix}.${this.entityId}(${opt})${postfix}`;
				break;
				case 'collection_read': // fallthrough
				case 'collection_update':
					col = this.collectionIdMap[this.entityId];
					mod = this.moduleIdMap[col.moduleId];
					let columns = [];
					for(let i = 0, j = col.columns.length; i < j; i++) {
						columns.push(`{column:${i}}`);
					}
					switch(this.entity) {
						case 'collection_read':   text = `${prefix}.collection_read({${mod.name}.${col.name}},[${columns.join(',')}])`; break;
						case 'collection_update': text = `${prefix}.collection_update({${mod.name}.${col.name}})${postfixAsync}`; break;
					}
				break;
				case 'field_value_get':   text = `${prefix}.get_field_value({${this.displayFieldName(this.entityId)}})`;                         break;
				case 'field_value_set':   text = `${prefix}.set_field_value({${this.displayFieldName(this.entityId)}}, ${this.capApp.value})`;   break;
				case 'field_caption_set': text = `${prefix}.set_field_caption({${this.displayFieldName(this.entityId)}}, ${this.capApp.value})`; break;
				case 'field_error_set':   text = `${prefix}.set_field_error({${this.displayFieldName(this.entityId)}}, ${this.capApp.value})`;   break;
				case 'field_focus_set':   text = `${prefix}.set_field_focus({${this.displayFieldName(this.entityId)}})`;                         break;
				case 'field_order_set':   text = `${prefix}.set_field_order({${this.displayFieldName(this.entityId)}}, ${this.capApp.value})`;   break;
				case 'form':
					frm  = this.formIdMap[this.entityId];
					mod  = this.moduleIdMap[frm.moduleId];
					text = `${prefix}.open_form({${mod.name}.${frm.name}},0,false)`;
				break;
				case 'jsFunction':
					fnc  = this.jsFunctionIdMap[this.entityId];
					mod  = this.moduleIdMap[fnc.moduleId];
					args = fnc.codeArgs === '' ? '' : ', '+fnc.codeArgs.toUpperCase();
					text = fnc.formId === null
						? `${prefix}.call_frontend({${mod.name}.${fnc.name}}${args})`
						: `${prefix}.call_frontend({${mod.name}.${this.formIdMap[fnc.formId].name}.${fnc.name}}${args})`;
				break;
				case 'pgFunction':
					fnc  = this.pgFunctionIdMap[this.entityId];
					mod  = this.moduleIdMap[fnc.moduleId];
					
					// add argument names to show function interface
					// remove argument type and default value to keep it easy to read
					let argsOut = [];
					args = fnc.codeArgs.split(',');
					for(let i = 0, j = args.length; i < j; i++) {
						if(args[i] !== '')
							argsOut.push(args[i].trim().split(' ')[0].toUpperCase());
					}
					let argsList = argsOut.length === 0 ? '' : ', '+argsOut.join(', ');
					
					text = `${prefix}.call_backend({${mod.name}.${fnc.name}}${argsList})${postfixAsync}`;
				break;
			}
			
			if(field.selectionStart || field.selectionStart === '0') {
				let startPos = field.selectionStart;
				let endPos   = field.selectionEnd;
				
				field.value = field.value.substring(0,startPos)
					+ text
					+ field.value.substring(endPos,field.value.length);
				
				field.selectionStart = startPos + text.length;
				field.selectionEnd   = startPos + text.length;
			}
			else {
				field.value += text;
			}
			this.codeFunction = field.value;
			this.entityId = null;
		},
		toggleEntity(entityName,id) {
			if(this.entity === entityName && this.entityId === id) {
				this.entity   = '';
				this.entityId = null;
				return;
			}
			this.entity   = entityName;
			this.entityId = id;
		},
		showHelp(top,text) {
			this.$store.commit('dialog',{
				captionTop:top,
				captionBody:text
			});
		},
		
		// placeholders are used for storing entities via ID instead of name (which can change)
		placeholdersSet(body) {
			let uuid   = '[a-z0-9\-]{36}';
			let prefix = 'app';
			let pat;
			
			// replace collection & column IDs with placeholders
			pat = new RegExp(`${prefix}\.collection_(read|update)\\('(${uuid})'(,\\[([a-z0-9\\-\\s,']*)\\])?`,'g');
			body = body.replace(pat,(match,mode,collectionId,optional,columnArray) => {
				if(this.collectionIdMap[collectionId] === 'undefined')
					return match;
				
				let collection = this.collectionIdMap[collectionId];
				let module     = this.moduleIdMap[collection.moduleId];
				
				if(mode === 'update')
					return `${prefix}.collection_update({${module.name}.${collection.name}}`;
				
				let columns = [];
				let matches = columnArray.match(new RegExp(`${uuid}`,'g'));
				for(let i = 0, j = matches.length; i < j; i++) {
					for(let x = 0, y = collection.columns.length; x < y; x++) {
						if(collection.columns[x].id === matches[i])
							columns.push(`{column:${x}}`);
					}
				}
				return `${prefix}.collection_read({${module.name}.${collection.name}},[${columns.join(',')}]`;
			});
			
			// replace field IDs with placeholders
			pat = new RegExp(`${prefix}\.(get|set)_field_(value|caption|error|focus|order)\\('(${uuid})'`,'g');
			body = body.replace(pat,(match,mode,part,id) => this.fieldIdMap[id] !== undefined
				? `${prefix}.${mode}_field_${part}({${this.displayFieldName(id)}}` : match
			);
			
			// replace function IDs with placeholders
			pat = new RegExp(`${prefix}\.call_(backend|frontend)\\('(${uuid})'`,'g');
			body = body.replace(pat,(match,fncMode,id) => {
				
				if(fncMode === 'backend' && this.pgFunctionIdMap[id] !== 'undefined') {
					const fnc = this.pgFunctionIdMap[id];
					const mod = this.moduleIdMap[fnc.moduleId];
					return `${prefix}.call_backend({${mod.name}.${fnc.name}}`;
				}
				else if(fncMode === 'frontend' && this.jsFunctionIdMap[id] !== 'undefined') {
					const fnc = this.jsFunctionIdMap[id];
					const mod = this.moduleIdMap[fnc.moduleId];
					
					if(fnc.formId === null)
						return `${prefix}.call_frontend({${mod.name}.${fnc.name}}`;
					
					const form = this.formIdMap[fnc.formId];
					return `${prefix}.call_${fncMode}({${mod.name}.${form.name}.${fnc.name}}`;
				}
				return match;
			});
			
			return body;
		},
		placeholdersUnset() {
			let body    = this.codeFunction;
			let prefix  = 'app';
			let dbChars = '[a-z0-9_]+'; // valid chars, DB entities (PG functions, modules, attributes, ...)
			let pat;
			
			// replace collection & column placeholders
			// stored as: app.collection_read({module.collection},[column1,column2,...])
			pat = new RegExp(`${prefix}\.collection_(read|update)\\(\{(${dbChars})\.(${dbChars})\}(,\\[(.*)\\])?`,'g');
			body = body.replace(pat,(match,mode,modName,colName,optional,columnArray) => {
				if(this.moduleNameMap[modName] === undefined)
					return match;
				
				let mod = this.moduleNameMap[modName];
				let col = false;
				
				for(let k in this.collectionIdMap) {
					if(this.collectionIdMap[k].moduleId === mod.id && this.collectionIdMap[k].name === colName)
						col = this.collectionIdMap[k];
				}
				if(col === false)
					return false;
				
				if(mode === 'update')
					return `${prefix}\.collection_update('${col.id}'`;
				
				let columnIds = [];
				let columns   = columnArray.split(',');
				
				for(let c of columns) {
					let columnIndex = parseInt(c.replace('{column:','').replace('}',''));
					
					if(col.columns.length <= columnIndex)
						return match;
					
					columnIds.push(`'${col.columns[columnIndex].id}'`);
				}
				return `${prefix}\.collection_read('${col.id}',[${columnIds.join(',')}]`;
			});
			
			// replace field value/caption get/set placeholders
			// stored as: app.get_field_value(F12: 0 display_name... or app.get_field_value(F13: Container...
			pat = new RegExp(`${prefix}\.(get|set)_field_(value|caption|error|focus|order)\\(\{F(\\d+)\:.*?\}`,'g');
			body = body.replace(pat,(match,mode,part,ref) => {
				for(let fieldId in this.entityIdMapRef.field) {
					if(this.entityIdMapRef.field[fieldId] === parseInt(ref))
						return `${prefix}\.${mode}_field_${part}('${fieldId}'`;
				}
				return match;
			});
			
			// replace backend function placeholders
			// stored as: app.call_backend({r3_organizations.get_name_by_id},12...
			pat = new RegExp(`${prefix}\.call_backend\\(\{(${dbChars})\.(${dbChars})\}`,'g');
			body = body.replace(pat,(match,modName,fncName) => {
				if(this.moduleNameMap[modName] === undefined)
					return match;
				
				let mod = this.moduleNameMap[modName];
				let fnc = false;
				
				for(let i = 0, j = mod.pgFunctions.length; i < j; i++) {
					if(mod.pgFunctions[i].name !== fncName)
						continue;
					
					fnc = mod.pgFunctions[i];
					break;
				}
				
				if(fnc === false)
					return match;
				
				return `${prefix}\.call_backend('${fnc.id}'`;
			});
			
			// replace global frontend function placeholders
			// stored as: app.call_frontend({r3_organizations.add_numbers},12...
			pat = new RegExp(`${prefix}\.call_frontend\\(\{(${dbChars})\.(.+)\}`,'g');
			body = body.replace(pat,(match,modName,fncName) => {
				if(this.moduleNameMap[modName] === undefined)
					return match;
				
				const mod = this.moduleNameMap[modName];
				
				for(let f of mod.jsFunctions) {
					if(f.formId === null && f.name === fncName)
						return `${prefix}\.call_frontend('${f.id}'`;
				}
				return match;
				
			});
			
			// replace form assigned frontend function placeholders
			// stored as: app.call_frontend({r3_organizations.contact.set_defaults},12...
			pat = new RegExp(`${prefix}\.call_frontend\\(\{(${dbChars})\.([^\.]+)\.(.+)\}`,'g');
			body = body.replace(pat,(match,modName,formName,fncName) => {
				if(this.form === false || this.moduleNameMap[modName] === undefined)
					return match;
				
				const mod = this.moduleNameMap[modName];
				
				for(let f of mod.jsFunctions) {
					if(f.formId !== null && f.formId === this.form.id && formName === this.form.name && f.name === fncName)
						return `${prefix}\.call_frontend('${f.id}'`;
				}
				return match;
			});
			return body;
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
			ws.send('jsFunction','del',{id:this.jsFunction.id},true).then(
				() => {
					this.$root.schemaReload(this.jsFunction.moduleId);
					this.$router.push('/builder/js-functions/'+this.jsFunction.moduleId);
				},
				this.$root.genericError
			);
		},
		set() {
			ws.sendMultiple([
				ws.prepare('jsFunction','set',{
					id:this.jsFunction.id,
					moduleId:this.jsFunction.moduleId,
					formId:this.jsFunction.formId,
					name:this.name,
					codeArgs:this.codeArgs,
					codeFunction:this.placeholdersUnset(),
					codeReturns:this.codeReturns,
					captions:this.captions
				}),
				ws.prepare('schema','check',{moduleId:this.module.id})
			],true).then(
				() => this.$root.schemaReload(this.module.id),
				this.$root.genericError
			);
		}
	}
};