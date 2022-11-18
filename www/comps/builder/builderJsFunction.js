import MyBuilderCaption               from './builderCaption.js';
import MyBuilderQuery                 from './builderQuery.js';
import {MyBuilderFunctionPlaceholder} from './builderFunctions.js';
import {getDataFieldMap}              from '../shared/form.js';
import {
	getDependentModules,
	getItemTitle
} from '../shared/builder.js';
export {MyBuilderJsFunction as default};

let MyBuilderJsFunction = {
	name:'my-builder-js-function',
	components:{
		MyBuilderCaption,
		MyBuilderFunctionPlaceholder,
		MyBuilderQuery
	},
	template:`<div class="builder-function">
		
		<div class="contentBox" v-if="jsFunction">
			<div class="top">
				<div class="area nowrap">
					<img class="icon" src="images/code.png" />
					<my-builder-caption
						v-model="captions.jsFunctionTitle"
						:contentName="capApp.titleOne"
						:language="builderLanguage"
						:longInput="true"
					/>
					<my-button :active="false" :caption="jsFunction.name" :naked="true "/>
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
					<my-button
						@trigger="showHeader = !showHeader"
						:caption="capApp.button.details"
						:image="showHeader ? 'visible1.png' : 'visible0.png'"
					/>
					<my-button
						@trigger="showPreview = !showPreview"
						:caption="capGen.preview"
						:image="showPreview ? 'visible1.png' : 'visible0.png'"
					/>
				</div>
			</div>
			
			<div class="content no-padding function-details default-inputs">
				<div class="header" v-if="showHeader">
					<table>
						<tr>
							<td>{{ capApp.codeArgs }}</td>
							<td>
								<input
									v-model="codeArgs"
									:disabled="readonly"
									:placeholder="capApp.codeArgsHintJs"
								/>
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
					</table>
				</div>
				
				<!-- function body input -->
				<textarea class="input"
					v-if="!showPreview"
					v-model="codeFunction"
					@click="insertEntitySelected"
					@keydown.tab.prevent="addTab"
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
		
		<div class="contentBox right" v-if="jsFunction && showSidebar">
			<div class="top lower">
				<div class="area nowrap">
					<img class="icon" src="images/database.png" />
					<h1 class="title">{{ capApp.placeholders }}</h1>
				</div>
			</div>
			<div class="content padding default-inputs">
				
				<div class="message" v-html="capApp.entityInput"></div>
				
				<template v-if="form !== false && form.query.joins.length !== 0">
					<div class="placeholders form-query-title">
						
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
					<div class="placeholders fields-title">
						<h2>{{ capApp.placeholdersFormFields }}</h2>
						
						<div class="row">
							<select v-model="fieldMode">
								<option value="get_field_value"  >{{ capApp.option.fieldGetValue   }}</option>
								<option value="set_field_value"  >{{ capApp.option.fieldSetValue   }}</option>
								<option value="set_field_caption">{{ capApp.option.fieldSetCaption }}</option>
							</select>
							<select
								@change="toggleEntity('field',$event.target.value)"
								:value="entitySelected === 'field' ? entitySelectedId : ''"
							>
								<option value="" disabled>{{ capApp.fieldId }}</option>
								<option v-for="fieldId in dataFieldIdsSorted" :value="fieldId">
									{{ displayFieldName(fieldId) }}
								</option>
							</select>
						</div>
						<span v-if="entitySelected === 'field' && entitySelectedId !== null">
							{{ capApp.placeholderInsert }}
						</span>
					</div>
				</template>
				
				<!-- collection input -->
				<div class="placeholders collections-title">
					<h2>{{ capApp.placeholdersCollections }}</h2>
					<div class="row">
						<select v-model="collectionMode">
							<option value="read"  >{{ capApp.option.collectionRead   }}</option>
							<option value="update">{{ capApp.option.collectionUpdate }}</option>
						</select>
						<select
							@change="toggleEntity('collection',$event.target.value)"
							:value="entitySelected === 'collection' ? entitySelectedId : ''"
						>
							<option value="" disabled>{{ capApp.collectionId }}</option>
							<optgroup
								v-for="m in getDependentModules(module,modules).filter(v => v.collections.length !== 0)"
								:label="m.name"
							>
								<option v-for="c in m.collections" :value="c.id">
									{{ c.name }}
								</option>
							</optgroup>
						</select>
					</div>
					<span v-if="entitySelected === 'collection' && entitySelectedId !== null">
						{{ capApp.placeholderInsert }}
					</span>
				</div>
				
				<!-- other module functions input -->
				<h2>{{ capApp.placeholdersModules }}</h2>
				<div class="placeholders modules"
					v-for="mod in getDependentModules(module,modules).filter(v => v.pgFunctions.length !== 0 || v.jsFunctions.length !== 0)"
					:key="mod.id"
				>
					<my-button
						@trigger="toggleModule(mod.id)"
						:caption="mod.name"
						:image="moduleIdsOpen.includes(mod.id) ? 'triangleDown.png' : 'triangleRight.png'"
						:naked="true"
					/>
					
					<template v-if="moduleIdsOpen.includes(mod.id)">
						
						<!-- JS functions -->
						<div class="functions-title" v-if="mod.jsFunctions.filter(v => v.formId === null || v.formId === formId).length !== 0">
							{{ capApp.functionsFrontend }}
						</div>
						<div class="placeholders functions">
							<my-builder-function-placeholder
								v-for="f in mod.jsFunctions.filter(v => v.formId === null || v.formId === formId)"
								@show-help="showHelp(f.name+'()',$event)"
								@toggle="toggleEntity('jsFunction',f.id)"
								:builderLanguage="builderLanguage"
								:functionObj="f"
								:functionType="'js'"
								:key="f.id"
								:name="f.name"
								:selected="entitySelected === 'jsFunction' && entitySelectedId === f.id"
							/>
						</div>
						
						<!-- PG functions -->
						<div class="functions-title" v-if="mod.pgFunctions.filter(v => v.isFrontendExec).length !== 0">
							{{ capApp.functionsBackend }}
						</div>
						<div class="placeholders functions">
							<my-builder-function-placeholder
								v-for="f in mod.pgFunctions.filter(v => v.isFrontendExec)"
								@show-help="showHelp(f.name+'()',$event)"
								@toggle="toggleEntity('pgFunction',f.id)"
								:builderLanguage="builderLanguage"
								:functionObj="f"
								:functionType="'pg'"
								:key="f.id"
								:name="f.name"
								:selected="entitySelected === 'pgFunction' && entitySelectedId === f.id"
							/>
						</div>
					</template>
				</div>
				
				<h2>{{ capApp.placeholdersInstance }}</h2>
				<div class="placeholders functions">
					<my-builder-function-placeholder
						v-for="f in appFunctions"
						@show-help="showHelp(f+'()',$event)"
						@toggle="toggleEntity('appFunction',f)"
						:builderLanguage="builderLanguage"
						:functionHelp="capApp.helpJs[f]"
						:key="f"
						:name="f"
						:selected="entitySelected === 'appFunction' && entitySelectedId === f"
					/>
				</div>
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
			handler:function() { this.reset(); },
			immediate:true
		}
	},
	mounted:function() {
		this.$emit('hotkeysRegister',[{fnc:this.set,key:'s',keyCtrl:true}]);
	},
	unmounted:function() {
		this.$emit('hotkeysRegister',[]);
	},
	data:function() {
		return {
			name:'',
			formId:null,
			captions:{},
			codeArgs:'',
			codeFunction:'',
			codeReturns:'',
			appFunctions:[
				'block_inputs','copy_to_clipboard','get_e2ee_data_key',
				'get_e2ee_data_value','get_language_code','get_login_id',
				'get_record_id','get_role_ids','go_back',	'has_role','open_form',
				'pdf_create','record_delete','record_new','record_reload',
				'record_save','set_e2ee_by_login_ids',
				'set_e2ee_by_login_ids_and_relation','show_form_message',
				'timer_clear','timer_set','value_store_get','value_store_set'
			],
			appFunctionsAsync:[
				'get_e2ee_data_key','get_e2ee_data_value'
			],
			
			// states
			collectionMode:'read',
			fieldMode:'get_field_value',
			entitySelected:'',
			entitySelectedId:null,
			moduleIdsOpen:[],
			showHeader:false,
			showPreview:false,
			showSidebar:true
		};
	},
	computed:{
		dataFieldMap:function() {
			return this.formId === null
				? {} : this.getDataFieldMap(this.formIdMap[this.formId].fields);
		},
		dataFieldIdsSorted:function() {
			let map = {};
			for(let k in this.dataFieldMap) {
				let f = this.dataFieldMap[k];
				map[`${f.index}_${this.attributeIdMap[f.attributeId].name}`] = f.id;
			}
			let keysSorted = Object.keys(map).sort();
			
			let out = [];
			for(let i = 0, j = keysSorted.length; i < j; i++) {
				out.push(map[keysSorted[i]]);
			}			
			return out;
		},
		form:function() {
			return this.formId === null ? false : this.formIdMap[this.formId];
		},
		module:function() {
			return this.jsFunction === false
				? false : this.moduleIdMap[this.jsFunction.moduleId];
		},
		jsFunction:function() {
			return typeof this.jsFunctionIdMap[this.id] === 'undefined'
				? false : this.jsFunctionIdMap[this.id];
		},
		hasChanges:function() {
			return this.codeArgs     !== this.jsFunction.codeArgs
				|| this.codeFunction !== this.placeholdersSet(this.jsFunction.codeFunction)
				|| this.codeReturns  !== this.jsFunction.codeReturns
				|| JSON.stringify(this.captions) !== JSON.stringify(this.jsFunction.captions);
		},
		preview:function() {
			return !this.showPreview ? '' : this.placeholdersUnset();
		},
		
		// stores
		modules:        function() { return this.$store.getters['schema/modules']; },
		moduleIdMap:    function() { return this.$store.getters['schema/moduleIdMap']; },
		moduleNameMap:  function() { return this.$store.getters['schema/moduleNameMap']; },
		relationIdMap:  function() { return this.$store.getters['schema/relationIdMap']; },
		attributeIdMap: function() { return this.$store.getters['schema/attributeIdMap']; },
		collectionIdMap:function() { return this.$store.getters['schema/collectionIdMap']; },
		formIdMap:      function() { return this.$store.getters['schema/formIdMap']; },
		jsFunctionIdMap:function() { return this.$store.getters['schema/jsFunctionIdMap']; },
		pgFunctionIdMap:function() { return this.$store.getters['schema/pgFunctionIdMap']; },
		capApp:         function() { return this.$store.getters.captions.builder.function; },
		capGen:         function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		// externals
		getDataFieldMap,
		getDependentModules,
		getItemTitle,
		
		// presentation
		displayFieldName:function(fieldId) {
			let f = this.dataFieldMap[fieldId];
			let a = this.attributeIdMap[f.attributeId];
			let r = this.relationIdMap[a.relationId];
			return this.getItemTitle(r,a,f.index,false,false);
		},
		
		// actions
		addTab:function(evt) {
			let field    = evt.target;
			let startPos = field.selectionStart;
			let endPos   = field.selectionEnd;
			
			field.value = field.value.substring(0, startPos)
				+ "\t"+ field.value.substring(endPos);
			
			field.selectionStart = startPos + 1;
			field.selectionEnd   = startPos + 1;
			this.codeFunction    = field.value;
		},
		reset:function() {
			this.name         = this.jsFunction.name;
			this.formId       = this.jsFunction.formId;
			this.codeArgs     = this.jsFunction.codeArgs;
			this.codeFunction = this.placeholdersSet(this.jsFunction.codeFunction);
			this.codeReturns  = this.jsFunction.codeReturns;
			this.captions     = JSON.parse(JSON.stringify(this.jsFunction.captions));
		},
		insertEntitySelected:function(evt) {
			if(this.entitySelectedId === null)
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
			switch(this.entitySelected) {
				case 'appFunction':
					opt     = '';
					postfix = '';
					
					if(typeof this.capApp.helpJsHint[this.entitySelectedId] !== 'undefined')
						opt = this.capApp.helpJsHint[this.entitySelectedId];
					
					if(this.appFunctionsAsync.includes(this.entitySelectedId))
						postfix = postfixAsync;
					
					text = `${prefix}.${this.entitySelectedId}(${opt})${postfix}`;
				break;
				case 'collection':
					col = this.collectionIdMap[this.entitySelectedId];
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
					fld  = this.dataFieldMap[this.entitySelectedId];
					atr  = this.attributeIdMap[fld.attributeId];
					rel  = this.relationIdMap[atr.relationId];
					opt  = this.fieldMode.includes('set') ? ', '+this.capApp.value : '';
					text = `${prefix}.${this.fieldMode}({${fld.index}:${rel.name}.${atr.name}}${opt})`;
				break;
				case 'form':
					frm  = this.formIdMap[this.entitySelectedId];
					mod  = this.moduleIdMap[frm.moduleId];
					text = `${prefix}.open_form({${mod.name}.${frm.name}},0,false)`;
				break;
				case 'jsFunction':
					fnc  = this.jsFunctionIdMap[this.entitySelectedId];
					mod  = this.moduleIdMap[fnc.moduleId];
					args = fnc.codeArgs === '' ? '' : ', '+fnc.codeArgs.toUpperCase();
					text = `${prefix}.call_frontend({${mod.name}.${fnc.name}}${args})`;
				break;
				case 'pgFunction':
					fnc  = this.pgFunctionIdMap[this.entitySelectedId];
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
			this.entitySelectedId = null;
		},
		toggleEntity:function(entityName,id) {
			if(this.entitySelected === entityName && this.entitySelectedId === id) {
				this.entitySelected   = '';
				this.entitySelectedId = null;
				return;
			}
			this.entitySelected   = entityName;
			this.entitySelectedId = id;
		},
		toggleModule:function(id) {
			const pos = this.moduleIdsOpen.indexOf(id);
			
			return pos === -1 ? this.moduleIdsOpen.push(id)
				: this.moduleIdsOpen.splice(pos,1);
		},
		showHelp:function(top,text) {
			this.$store.commit('dialog',{
				captionTop:top,
				captionBody:text,
				buttons:[{
					caption:this.capGen.button.close,
					cancel:true,
					image:'cancel.png'
				}]
			});
		},
		
		// placeholders are used for storing entities via ID instead of name (which can change)
		placeholdersSet:function(body) {
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
			pat = new RegExp(`${prefix}\.(get|set)_field_(value|caption)\\('(${uuid})'`,'g');
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
				return `${prefix}.${mode}_field_${part}({${fld.index}:${rel.name}.${atr.name}}`;
			});
			
			// replace function IDs with placeholders
			pat = new RegExp(`${prefix}\.call_(backend|frontend)\\('(${uuid})'`,'g');
			body = body.replace(pat,function(match,fncMode,id) {
				
				let fnc = false;
				if(fncMode === 'backend' && that.pgFunctionIdMap[id] !== 'undefined') {
					fnc = that.pgFunctionIdMap[id];
				}
				else if(fncMode === 'frontend' && that.jsFunctionIdMap[id] !== 'undefined') {
					fnc = that.jsFunctionIdMap[id];
				}
				if(fnc === false)
					return match;
				
				let mod = that.moduleIdMap[fnc.moduleId];
				return `${prefix}.call_${fncMode}({${mod.name}.${fnc.name}}`;
			});
			
			return body;
		},
		placeholdersUnset:function() {
			let that   = this;
			let body   = this.codeFunction;
			let fields = this.dataFieldMap;
			let prefix = 'app';
			let dbName = '[a-z0-9_]+'; // valid chars, DB entities (PG functions, modules, attributes, ...)
			let pat;
			
			// replace collection & column placeholders
			// stored as: app.collection_read({module.collection},[column1,column2,...])
			pat = new RegExp(`${prefix}\.collection_(read|update)\\(\{(${dbName})\.(${dbName})\}(,\\[(.*)\\])?`,'g');
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
			pat = new RegExp(`${prefix}\.(get|set)_field_(value|caption)\\(\{(\\d+)\:(${dbName})\.(${dbName})\}`,'g');
			body = body.replace(pat,function(match,mode,part,index,relName,atrName) {
				
				// resolve relation by name
				let rel = false;
				for(let i = 0, j = that.module.relations.length; i < j; i++) {
					if(that.module.relations[i].name !== relName)
						continue;
					
					rel = that.module.relations[i];
					break;
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
			pat = new RegExp(`${prefix}\.call_backend\\(\{(${dbName})\.(${dbName})\}`,'g');
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
			
			// replace frontend function placeholders
			// stored as: app.call_frontend({r3_organizations.add_numbers},12...
			pat = new RegExp(`${prefix}\.call_frontend\\(\{(${dbName})\.(.+)\}`,'g');
			body = body.replace(pat,function(match,modName,fncName) {
				
				if(typeof that.moduleNameMap[modName] === 'undefined')
					return match;
				
				let mod = that.moduleNameMap[modName];
				let fnc = false;
				
				for(let i = 0, j = mod.jsFunctions.length; i < j; i++) {
					if(mod.jsFunctions[i].name !== fncName)
						continue;
					
					fnc = mod.jsFunctions[i];
					break;
				}
				
				if(fnc === false)
					return match;
				
				return `${prefix}\.call_frontend('${fnc.id}'`;
			});
			
			return body;
		},
		
		// backend calls
		set:function() {
			ws.sendMultiple([
				ws.prepare('jsFunction','set',{
					id:this.jsFunction.id,
					moduleId:this.jsFunction.moduleId,
					formId:this.jsFunction.formId,
					name:this.jsFunction.name,
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