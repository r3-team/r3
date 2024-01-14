import MyBuilderCaption   from './builderCaption.js';
import MyBuilderQuery     from './builderQuery.js';
import {getDataFieldMap}  from '../shared/form.js';
import {getJoinsIndexMap} from '../shared/query.js';
import MyTabs             from '../tabs.js';
import {
	getDependentModules,
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
		<div class="contentBox grow" v-if="jsFunction">
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
						<div class="placeholders">
							<div class="title">
								<img src="images/fileText.png" />
								<span>{{ capApp.placeholdersFormFields }}</span>
							</div>
							
							<div class="row gap">
								<select v-model="fieldMode">
									<option value="get_field_value"  >{{ capApp.option.fieldGetValue   }}</option>
									<option value="set_field_value"  >{{ capApp.option.fieldSetValue   }}</option>
									<option value="set_field_caption">{{ capApp.option.fieldSetCaption }}</option>
									<option value="set_field_error"  >{{ capApp.option.fieldSetError   }}</option>
									<option value="set_field_focus"  >{{ capApp.option.fieldSetFocus   }}</option>
								</select>
								<select
									@change="toggleEntity('field',$event.target.value)"
									:value="entity === 'field' ? entityId : ''"
								>
									<option value="" disabled>{{ capApp.fieldId }}</option>
									<option
										v-for="fieldId in dataFieldIdsSorted"
										:title="getItemTitlePath(dataFieldMap[fieldId].attributeId)"
										:value="fieldId"
									>
										{{ displayFieldName(fieldId) }}
									</option>
								</select>
							</div>
						</div>
					</template>
					
					<!-- collection input -->
					<div class="placeholders">
						<div class="title">
							<img src="images/tray.png" />
							<span>{{ capApp.placeholdersCollections }}</span>
						</div>
						
						<div class="row gap">
							<select v-model="collectionMode">
								<option value="read"  >{{ capApp.option.collectionRead   }}</option>
								<option value="update">{{ capApp.option.collectionUpdate }}</option>
							</select>
							<select
								@change="toggleEntity('collection',$event.target.value)"
								:value="entity === 'collection' ? entityId : ''"
							>
								<option value="" disabled>{{ capApp.collectionId }}</option>
								<optgroup
									v-for="m in getDependentModules(module).filter(v => v.collections.length !== 0)"
									:label="m.name"
								>
									<option v-for="c in m.collections" :value="c.id">{{ c.name }}</option>
								</optgroup>
							</select>
						</div>
					</div>
					
					<!-- frontend functions input -->
					<div class="placeholders">
						<div class="title">
							<img src="images/codeScreen.png" />
							<span>{{ capApp.titleJs }}</span>
						</div>
						<table>
							<tr>
								<td>
									<select v-model="entityJsModuleId">
										<option :value="null">-</option>
										<option
											v-for="mod in getDependentModules(module).filter(v => v.jsFunctions.length !== 0)"
											:value="mod.id"
										>{{ mod.name }}</option>
									</select>
								</td>
								<td>
									<select
										v-if="entityJsModuleId !== null"
										@change="toggleEntity('jsFunction',$event.target.value)"
										:value="entity === 'jsFunction' ? entityId : ''"
									>
										<option value="">-</option>
										<option
											v-for="f in moduleIdMap[entityJsModuleId].jsFunctions.filter(v => v.formId === null)"
											:value="f.id"
										>{{ f.name }}</option>
										<optgroup v-if="form !== false" :label="capGen.form + ': ' + form.name">
											<option
												v-for="f in moduleIdMap[entityJsModuleId].jsFunctions.filter(v => v.formId === formId)"
												:value="f.id"
											>{{ f.name }}</option>
										</optgroup>
									</select>
								</td>
								<td>
									<my-button image="question.png"
										@trigger="showHelp(jsFunctionIdMap[entityId].name+'()',functionHelpJs)"
										:active="functionHelpJs !== ''"
									/>
								</td>
							</tr>
						</table>
					</div>
					
					<!-- backend functions input -->
					<div class="placeholders">
						<div class="title">
							<img src="images/codeDatabase.png" />
							<span>{{ capApp.titlePg }}</span>
						</div>
						<table>
							<tr>
								<td>
									<select v-model="entityPgModuleId">
										<option :value="null">-</option>
										<option
											v-for="mod in getDependentModules(module).filter(v => v.pgFunctions.filter(f => f.isFrontendExec).length !== 0)"
											:value="mod.id"
										>{{ mod.name }}</option>
									</select>
								</td>
								<td>
									<select
										v-if="entityPgModuleId !== null"
										@change="toggleEntity('pgFunction',$event.target.value)"
										:value="entity === 'pgFunction' ? entityId : ''"
									>
										<option value="">-</option>
										<option
											v-for="f in moduleIdMap[entityPgModuleId].pgFunctions.filter(v => v.isFrontendExec)"
											:value="f.id"
										>{{ f.name }}</option>
									</select>
								</td>
								<td>
									<my-button image="question.png"
										@trigger="showHelp(pgFunctionIdMap[entityId].name+'()',functionHelpPg)"
										:active="functionHelpPg !== ''"
									/>
								</td>
							</tr>
						</table>
					</div>
					
					<!-- instance functions -->
					<div class="placeholders">
						<div class="title">
							<img src="images/server.png" />
							<span>{{ capApp.placeholdersInstance }}</span>
						</div>
						<table>
							<tr>
								<td>
									<select v-model="entityId" @change="entity = 'appFunction'">
										<option :value="null">-</option>
										<option
											v-for="f in appFunctions"
											:value="f"
										>{{ f }}</option>
									</select>
								</td>
								<td>
									<my-button image="question.png"
										@trigger="showHelp(entityId+'()',capApp.helpJs[entityId])"
										:active="entity === 'appFunction' && entityId !== null"
										:captionTitle="capGen.button.help"
									/>
								</td>
							</tr>
						</table>
					</div>
					
					<div class="column gap" v-if="entityId !== null">
						<span class="insert-ref">
							{{ capApp.placeholderInsert }}
						</span>
						<div>
							<my-button image="cancel.png"
								@trigger="entity = ''; entityId = null"
								:caption="capApp.button.clear"
								:cancel="true"
							/>
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
		this.$store.commit('keyDownHandlerAdd',{fnc:this.set,key:'s',keyCtrl:true});
	},
	unmounted() {
		this.$store.commit('keyDownHandlerDel',this.set);
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
				'get_e2ee_data_key','get_e2ee_data_value','pdf_create'
			],
			
			// states
			collectionMode:'read',
			fieldMode:'get_field_value',
			entity:'', // selected placeholder entity
			entityId:null,
			entityJsModuleId:null,
			entityPgModuleId:null,
			showPreview:false,
			showSidebar:true,
			tabTarget:'content'
		};
	},
	computed:{
		dataFieldIdsSorted:(s) => {
			let map = {};
			for(let k in s.dataFieldMap) {
				let f = s.dataFieldMap[k];
				let a = s.attributeIdMap[f.attributeId];
				let r = s.relationIdMap[a.relationId];
				let m = s.moduleIdMap[r.moduleId];
				map[`${f.index}_${m.name}.${r.name}.${a.name}`] = f.id;
			}
			let keysSorted = Object.keys(map).sort();
			let out = [];
			for(let k of keysSorted) {
				out.push(map[k]);
			}
			return out;
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
		
		// simple
		dataFieldMap: (s) => s.formId === null ? {} : s.getDataFieldMap(s.formIdMap[s.formId].fields),
		form:         (s) => s.formId === null ? false : s.formIdMap[s.formId],
		joinsIndexMap:(s) => s.form !== false ? s.getJoinsIndexMap(s.form.query.joins) : {},
		jsFunction:   (s) => typeof s.jsFunctionIdMap[s.id] === 'undefined' ? false : s.jsFunctionIdMap[s.id],
		module:       (s) => s.jsFunction === false ? false : s.moduleIdMap[s.jsFunction.moduleId],
		preview:      (s) => !s.showPreview ? '' : s.placeholdersUnset(),
		
		// stores
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
		getDataFieldMap,
		getDependentModules,
		getFunctionHelp,
		getItemTitle,
		getItemTitlePath,
		getJoinsIndexMap,
		textAddTab,
		
		// presentation
		displayFieldName(fieldId) {
			let f = this.dataFieldMap[fieldId];
			return this.getItemTitle(f.attributeId,f.index,false,null);
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
				case 'collection':
					col = this.collectionIdMap[this.entityId];
					mod = this.moduleIdMap[col.moduleId];
					let columns = [];
					for(let i = 0, j = col.columns.length; i < j; i++) {
						columns.push(`{column:${i}}`);
					}
					switch(this.collectionMode) {
						case 'read':   text = `${prefix}.collection_read({${mod.name}.${col.name}},[${columns.join(',')}])`; break;
						case 'update': text = `${prefix}.collection_update({${mod.name}.${col.name}})${postfixAsync}`; break;
					}
				break;
				case 'field':
					fld  = this.dataFieldMap[this.entityId];
					atr  = this.attributeIdMap[fld.attributeId];
					rel  = this.relationIdMap[atr.relationId];
					mod  = this.moduleIdMap[rel.moduleId];
					opt  = this.fieldMode.includes('set') && this.fieldMode !== 'set_field_focus' ? ', '+this.capApp.value : '';
					text = `${prefix}.${this.fieldMode}({${fld.index}:${mod.name}.${rel.name}.${atr.name}}${opt})`;
				break;
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
			let that   = this;
			let fields = this.dataFieldMap;
			let uuid   = '[a-z0-9\-]{36}';
			let prefix = 'app';
			let pat;
			
			// replace collection & column IDs with placeholders
			pat = new RegExp(`${prefix}\.collection_(read|update)\\('(${uuid})'(,\\[([a-z0-9\\-\\s,']*)\\])?`,'g');
			body = body.replace(pat,function(match,mode,collectionId,optional,columnArray) {
				if(that.collectionIdMap[collectionId] === 'undefined')
					return match;
				
				let collection = that.collectionIdMap[collectionId];
				let module     = that.moduleIdMap[collection.moduleId];
				
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
			pat = new RegExp(`${prefix}\.(get|set)_field_(value|caption|error|focus)\\('(${uuid})'`,'g');
			body = body.replace(pat,function(match,mode,part,id) {
				
				let fld = false;
				for(let k in fields) {
					if(fields[k].id === id) {
						fld = fields[k];
						break;
					}
				}
				if(fld === false)
					return match;
				
				let atr = that.attributeIdMap[fld.attributeId];
				let rel = that.relationIdMap[atr.relationId];
				let mod = that.moduleIdMap[rel.moduleId];
				return `${prefix}.${mode}_field_${part}({${fld.index}:${mod.name}.${rel.name}.${atr.name}}`;
			});
			
			// replace function IDs with placeholders
			pat = new RegExp(`${prefix}\.call_(backend|frontend)\\('(${uuid})'`,'g');
			body = body.replace(pat,function(match,fncMode,id) {
				
				if(fncMode === 'backend' && that.pgFunctionIdMap[id] !== 'undefined') {
					const fnc = that.pgFunctionIdMap[id];
					const mod = that.moduleIdMap[fnc.moduleId];
					return `${prefix}.call_backend({${mod.name}.${fnc.name}}`;
				}
				else if(fncMode === 'frontend' && that.jsFunctionIdMap[id] !== 'undefined') {
					const fnc = that.jsFunctionIdMap[id];
					const mod = that.moduleIdMap[fnc.moduleId];
					
					if(fnc.formId === null)
						return `${prefix}.call_frontend({${mod.name}.${fnc.name}}`;
					
					const form = that.formIdMap[fnc.formId];
					return `${prefix}.call_${fncMode}({${mod.name}.${form.name}.${fnc.name}}`;
				}
				return match;
			});
			
			return body;
		},
		placeholdersUnset() {
			let that    = this;
			let body    = this.codeFunction;
			let fields  = this.dataFieldMap;
			let prefix  = 'app';
			let dbChars = '[a-z0-9_]+'; // valid chars, DB entities (PG functions, modules, attributes, ...)
			let pat;
			
			// replace collection & column placeholders
			// stored as: app.collection_read({module.collection},[column1,column2,...])
			pat = new RegExp(`${prefix}\.collection_(read|update)\\(\{(${dbChars})\.(${dbChars})\}(,\\[(.*)\\])?`,'g');
			body = body.replace(pat,function(match,mode,modName,colName,optional,columnArray) {
				if(typeof that.moduleNameMap[modName] === 'undefined')
					return match;
				
				let mod = that.moduleNameMap[modName];
				let col = false;
				
				for(let k in that.collectionIdMap) {
					if(that.collectionIdMap[k].moduleId === mod.id && that.collectionIdMap[k].name === colName)
						col = that.collectionIdMap[k];
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
			// stored as: app.get_field_value({0:contact.is_active}...
			pat = new RegExp(`${prefix}\.(get|set)_field_(value|caption|error|focus)\\(\{(\\d+)\:(${dbChars})\.(${dbChars})\.(${dbChars})\}`,'g');
			body = body.replace(pat,function(match,mode,part,index,modName,relName,atrName) {
				
				// resolve relation inside given module
				let mod = that.moduleNameMap[modName];
				let rel = false;
				for(let r of mod.relations) {
					if(r.name === relName) {
						rel = r;
						break;
					}
				}
				if(rel === false)
					return match;
				
				// resolve attribute by name
				let atr = false;
				for(let i = 0, j = rel.attributes.length; i < j; i++) {
					if(rel.attributes[i].name !== atrName)
						continue;
					
					atr = rel.attributes[i];
					break;
				}
				if(atr === false)
					return match;
				
				// data field
				let fld = false;
				for(let k in fields) {
					if(fields[k].index === parseInt(index) && fields[k].attributeId === atr.id) {
						fld = fields[k];
						break;
					}
				}
				if(fld === false)
					return match;
				
				return `${prefix}\.${mode}_field_${part}('${fld.id}'`;
			});
			
			// replace backend function placeholders
			// stored as: app.call_backend({r3_organizations.get_name_by_id},12...
			pat = new RegExp(`${prefix}\.call_backend\\(\{(${dbChars})\.(${dbChars})\}`,'g');
			body = body.replace(pat,function(match,modName,fncName) {
				
				if(typeof that.moduleNameMap[modName] === 'undefined')
					return match;
				
				let mod = that.moduleNameMap[modName];
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
			body = body.replace(pat,function(match,modName,fncName) {
				
				if(typeof that.moduleNameMap[modName] === 'undefined')
					return match;
				
				const mod = that.moduleNameMap[modName];
				
				for(let f of mod.jsFunctions) {
					if(f.formId === null && f.name === fncName)
						return `${prefix}\.call_frontend('${f.id}'`;
				}
				return match;
				
			});
			
			// replace form assigned frontend function placeholders
			// stored as: app.call_frontend({r3_organizations.contact.set_defaults},12...
			pat = new RegExp(`${prefix}\.call_frontend\\(\{(${dbChars})\.([^\.]+)\.(.+)\}`,'g');
			body = body.replace(pat,function(match,modName,formName,fncName) {
				
				if(that.form === false || typeof that.moduleNameMap[modName] === 'undefined')
					return match;
				
				const mod = that.moduleNameMap[modName];
				
				for(let f of mod.jsFunctions) {
					if(f.formId !== null && f.formId === that.form.id && formName === that.form.name && f.name === fncName)
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