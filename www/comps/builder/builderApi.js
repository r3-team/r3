import MyBuilderQuery         from './builderQuery.js';
import MyBuilderColumnOptions from './builderColumnOptions.js';
import MyTabs                 from '../tabs.js';
import {
	isAttributeBoolean,
	isAttributeDecimal,
	isAttributeFiles,
	isAttributeInteger,
	isAttributeRelationship,
	isAttributeString,
	isAttributeUuid,
} from '../shared/attribute.js';
import {
	MyBuilderColumns,
	MyBuilderColumnTemplates
} from './builderColumns.js';
import {
	copyValueDialog,
	getNilUuid
} from '../shared/generic.js';
export {MyBuilderApi as default};

let MyBuilderApiPreview = {
	name:'my-builder-api-preview',
	template:`<table class="generic-table-vertical tight fullWidth default-inputs">
		<tbody>
			<tr>
				<td>{{ capApp.call }}</td>
				<td>
					<select v-model="call">
						<option value="AUTH">AUTH</option>
						<option value="GET"    :disabled="!hasGet">GET</option>
						<option value="POST"   :disabled="!hasPost">POST</option>
						<option value="DELETE" :disabled="!hasDelete">DELETE</option>
					</select>
				</td>
				<td>{{ capAppApi.hint[call.toLowerCase()] }}</td>
			</tr>
			<tr>
				<td>{{ capApp.httpMethod }}</td>
				<td colspan="2">
					<input class="long" disabled="disabled" :value="method" />
				</td>
			</tr>
			<tr>
				<td>Content-Type</td>
				<td colspan="2">
					<div class="row centered gap">
						<input class="long" disabled="disabled" :value="contentType" />
						<my-button image="copyClipboard.png"
							@trigger="copyToClipboard(contentType)"
							:captionTitle="capGen.button.copyClipboard"
						/>
					</div>
				</td>
			</tr>
			<tr>
				<td>URL</td>
				<td colspan="2">
					<div class="row centered gap">
						<input class="long" disabled="disabled" :value="url" />
						<my-button image="copyClipboard.png"
							@trigger="copyToClipboard(url)"
							:captionTitle="capGen.button.copyClipboard"
						/>
					</div>
				</td>
			</tr>
			<tr v-if="isGet || isDelete">
				<td>{{ capApp.recordId }}</td>
				<td><input v-model.number="recordId" /></td>
				<td>{{ isGet ? capApp.recordIdHintGet : capApp.recordIdHintDelete }}</td>
			</tr>
			<tr v-if="warnings.length !== 0">
				<td class="warnings">{{ capAppApi.warnings }}</td>
				<td colspan="2">
					<ul>
						<li v-for="w in warnings">{{ w }}</li>
					</ul>
				</td>
			</tr>
			<tr v-if="!isAuth">
				<td>{{ capApp.headers }}</td>
				<td colspan="2">
					<table>
						<thead>
							<tr><th>Key</th><th>Value</th></tr>
						</thead>
						<tbody>
							<tr><th>Authorization</th><th>Bearer {TOKEN_FROM_AUTH_CALL}</th></tr>
						</tbody>
					</table>
				</td>
			</tr>
			<tr v-if="isGet || isPost">
				<td>{{ capApp.params }}</td>
				<td colspan="2">
					<table>
						<tbody>
							<tr v-if="isGet">
								<td>Limit</td>
								<td><input v-model.number="params.limit" @keyup="limitChanged = true" /></td>
								<td>{{ capApp.limitHint }}</td>
							</tr>
							<tr v-if="isGet">
								<td>Offset</td>
								<td><input v-model.number="params.offset" /></td>
								<td>{{ capApp.offsetHint }}</td>
							</tr>
							<tr v-if="isGet || isPost">
								<td>Verbose</td>
								<td><my-bool v-model="params.verbose" @update:modelValue="verboseChanged = true" /></td>
								<td>{{ capApp.verboseHint }}</td>
							</tr>
						</tbody>
					</table>
				</td>
			</tr>
			<tr>
				<td>{{ capApp.request }}</td>
				<td colspan="2">
					<div class="column gap">
						<textarea class="long code-preview" disabled="disabled"
							:class="{ high:isPost, low:isGet || isDelete }"
							:value="request"
						></textarea>
						<span v-if="isPost && !params.verbose" v-html="capApp.requestHintPost"></span>
					</div>
				</td>
			</tr>
			<tr>
				<td>{{ capApp.response }}</td>
				<td colspan="2">
					<div class="column gap">
						<textarea class="long code-preview" disabled="disabled"
							:class="{ high:isGet, low:isDelete }"
							:value="response"
						></textarea>
						<span v-if="isPost" v-html="capApp.responseHintPost"></span>
					</div>
				</td>
			</tr>
		</tbody>
	</table>`,
	props:{
		api:            { type:Object,  required:true },
		builderLanguage:{ type:String,  required:true },
		columns:        { type:Array,   required:true },
		hasDelete:      { type:Boolean, required:true },
		hasGet:         { type:Boolean, required:true },
		hasPost:        { type:Boolean, required:true },
		joins:          { type:Array,   required:true },
		limitDef:       { type:Number,  required:true },
		module:         { type:Object,  required:true },
		name:           { type:String,  required:true },
		verboseDef:     { type:Boolean, required:true },
		version:        { type:Number,  required:true },
		warnings:       { type:Array,   required:true }
	},
	data() {
		return {
			// API call preview
			call:'AUTH', // AUTH, GET, POST, DELETE
			contentType:'application/json',
			limitChanged:false,
			params:{
				limit:100,
				offset:0,
				verbose:false
			},
			recordId:0,
			verboseChanged:false
		};
	},
	computed:{
		// preview values
		method:(s) => s.isAuth ? 'POST' : s.call,
		paramsUrl:(s) => {
			if(s.isAuth) return '';
			
			let out = [];
			if(s.verboseChanged)       out.push(`verbose=${s.params.verbose ? '1' : '0'}`);
			if(s.isGet && s.limitSet)  out.push(`limit=${s.params.limit}`);
			if(s.isGet && s.offsetSet) out.push(`offset=${s.params.offset}`);
			return out.length === 0 ? '' : `?${out.join('&')}`;
		},
		request:(s) => {
			if(s.isAuth) return `{\n\t"username": "API_USER_NAME",\n\t"password": "API_USER_PASSWORD"\n}`;
			if(s.isPost) return s.getBodyPreview(true);
			return s.capApp.empty;
		},
		response:(s) => {
			if(s.isAuth) return `{\n\t"token": "ACCESS_TOKEN"\n}`;
			if(s.isGet)  return s.getBodyPreview(false);
			
			if(s.isPost) {
				let out = {};
				for(let join of s.joins) {
					out[join.index] = 123;
				}
				return JSON.stringify(out,null,'\t');
			}
			return s.capApp.empty;
		},
		url:(s) => {
			let base = `${location.protocol}//${location.host}/api/`;
			switch(s.call) {
				case 'AUTH': base += 'auth'; break;
				default: base += `${s.module.name}/${s.name}/v${s.version}`; break;
			}
			
			if(s.isDelete)             base += `/${s.recordSet ? s.recordId : 1}`;
			if(s.isGet && s.recordSet) base += `/${s.recordId}`;
			return base + s.paramsUrl;
		},
		
		// simple
		isAuth:   (s) => s.call === 'AUTH',
		isDelete: (s) => s.call === 'DELETE',
		isGet:    (s) => s.call === 'GET',
		isPost:   (s) => s.call === 'POST',
		limitSet: (s) => s.params.limit  !== '' && s.params.limit  !== 0 && s.limitChanged,
		offsetSet:(s) => s.params.offset !== '' && s.params.offset !== 0,
		recordSet:(s) => s.recordId      !== '' && s.recordId      !== 0,
		
		// stores
		relationIdMap: (s) => s.$store.getters['schema/relationIdMap'],
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		capApp:        (s) => s.$store.getters.captions.builder.api.preview,
		capAppApi:     (s) => s.$store.getters.captions.builder.api,
		capGen:        (s) => s.$store.getters.captions.generic
	},
	mounted() {
		// set defaults from API
		this.params.limit   = this.limitDef;
		this.params.verbose = this.verboseDef;
	},
	methods:{
		// externals
		isAttributeBoolean,
		isAttributeDecimal,
		isAttributeFiles,
		isAttributeInteger,
		isAttributeRelationship,
		isAttributeString,
		isAttributeUuid,
		
		// display
		getAttributeExampleValue(content,aggregator) {
			let value;
			if(this.isAttributeInteger(content))      value = 123;
			if(this.isAttributeDecimal(content))      value = 123.45;
			if(this.isAttributeString(content))       value = 'ABC';
			if(this.isAttributeRelationship(content)) value = 456;
			if(this.isAttributeUuid(content))         value = '064fc31d-479d-450d-22cd-71f874df3a50';
			if(this.isAttributeBoolean(content))      value = true;
			if(this.isAttributeFiles(content))
				value = [{
	                "changed":1677925664,
	                "hash":"FILE_HASH",
	                "id":"FILE_UUID",
	                "name":"FILE_NAME",
	                "size":240,
	                "version":0
	            }];
			
			if(aggregator !== null) {
				switch(aggregator) {
					case 'array': return [value,value];        break;
					case 'list':  return `${value}, ${value}`; break;
				}
			}
			return value;
		},
		getBodyPreview(singleRecord) {
			let rows     = [];
			let rowCount = this.recordSet || this.params.limit === 1 || singleRecord ? 1 : 2;
			
			for(;rowCount > 0;rowCount--) {
				if(!this.params.verbose) {
					let row = [];
					for(let column of this.columns) {
						row.push(this.getAttributeExampleValue(
							this.attributeIdMap[column.attributeId].content,column.aggregator));
					}
					rows.push(row);
				} else {
					let row         = {};
					let subQueryCtr = 0;
					for(let join of this.joins) {
						// relation reference (relation index + name): '0(person)' or '1(department)'
						let relRef  = `${join.index}(${this.relationIdMap[join.relationId].name})`;
						row[relRef] = {};
						
						for(let column of this.columns) {
							if(column.index !== join.index)
								continue;
							
							// new sub query columns do not have an attribute unless selected
							if(column.attributeId === null) {
								row[relRef][`[sub_query${subQueryCtr++}_no_attribute]`] = null;
								continue;
							}
							
							let colRef;
							let atr = this.attributeIdMap[column.attributeId];
							
							if(typeof column.captions.columnTitle[this.builderLanguage] !== 'undefined') {
								colRef = column.captions.columnTitle[this.builderLanguage];
							} else {
								colRef = !column.subQuery ? atr.name : `sub_query${subQueryCtr++}`;
								
								if(column.aggregator !== null)
									colRef = `${column.aggregator.toUpperCase()} (${colRef})`;
							}
							row[relRef][colRef] = this.getAttributeExampleValue(atr.content,column.aggregator);
						}
					}
					rows.push(row);
				}
			}
			return JSON.stringify(singleRecord ? rows[0] : rows,null,'\t');
		},
		
		// actions
		copyToClipboard(value) {
			navigator.clipboard.writeText(value);
		}
	}
};

let MyBuilderApi = {
	name:'my-builder-api',
	components:{
		MyBuilderApiPreview,
		MyBuilderColumnOptions,
		MyBuilderColumns,
		MyBuilderColumnTemplates,
		MyBuilderQuery,
		MyTabs
	},
	template:`<div class="builder-api" v-if="api">
		<div class="contentBox grow">
			<div class="top">
				<div class="area nowrap">
					<img class="icon" src="images/api.png" />
					<h1 class="title">
						{{ capApp.titleOne.replace('{NAME}',name) }}
					</h1>
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
					<my-button image="files.png"
						@trigger="copy"
						:active="!readonly"
						:caption="capApp.button.versionNew"
						:captionTitle="capApp.button.versionNewHint"
					/>
					<my-button image="visible1.png"
						@trigger="copyValueDialog(name,id,id)"
						:caption="capGen.id"
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
			
			<div class="content no-padding">
				
				<div class="builder-api-columns">
				
					<!-- columns -->
					<div class="builder-api-columns-active">
						<h2>{{ capApp.columnsTarget }}</h2>
						<my-builder-columns groupName="columns"
							@columns-set="columns = $event"
							@column-id-show="toggleColumnOptions($event)"
							@column-remove=""
							:builderLanguage="builderLanguage"
							:columnIdShow="columnIdShow"
							:columns="columns"
							:hasBatches="false"
							:hasCaptions="true"
							:hasStyling="false"
						/>
					</div>
					
					<div class="builder-api-columns-available">
						<h2>{{ capApp.columnsAvailable }}</h2>
						<div class="builder-api-column-templates">
							<my-builder-column-templates groupName="batches_columns"
								@column-add="columns.push($event)"
								:allowRelationships="true"
								:columns="columns"
								:joins="joins"
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
		
		<div class="contentBox sidebar scroll" v-if="showSidebar">
			<div class="top lower">
				<div class="area">
					<h1>{{ capGen.settings }}</h1>
				</div>
			</div>
			
			<my-tabs
				v-model="tabTarget"
				:entries="['content','calls','properties']"
				:entriesIcon="['images/database.png','images/code.png','images/edit.png']"
				:entriesText="[capGen.content,capApp.calls,capGen.properties]"
			/>
			
			<!-- API content -->
			<div class="content grow" v-if="tabTarget === 'content'">
				<my-builder-query
					@index-removed="removeIndex($event)"
					@set-filters="filters = $event"
					@set-fixed-limit="fixedLimit = $event"
					@set-joins="joins = $event"
					@set-lookups="lookups = $event"
					@set-orders="orders = $event"
					@set-relation-id="relationId = $event"
					:allowChoices="false"
					:allowLookups="true"
					:allowOrders="true"
					:builderLanguage="builderLanguage"
					:filters="filters"
					:filtersDisable="filtersDisable"
					:fixedLimit="fixedLimit"
					:joins="joins"
					:lookups="lookups"
					:moduleId="module.id"
					:orders="orders"
					:relationId="relationId"
				/>
				
				<!-- column settings -->
				<template v-if="columnShow !== false">
					<br />
					<h3 class="selected-ref">{{ capApp.columnSettings }}</h3>
					
					<my-builder-query
						v-if="columnShow.subQuery"
						@set-choices="columnSetQuery('choices',$event)"
						@set-filters="columnSetQuery('filters',$event)"
						@set-fixed-limit="columnSetQuery('fixedLimit',$event)"
						@set-joins="columnSetQuery('joins',$event)"
						@set-lookups="columnSetQuery('lookups',$event)"
						@set-orders="columnSetQuery('orders',$event)"
						@set-relation-id="columnSetQuery('relationId',$event)"
						:allowChoices="false"
						:allowOrders="true"
						:builderLanguage="builderLanguage"
						:choices="columnShow.query.choices"
						:filters="columnShow.query.filters"
						:filtersDisable="filtersDisable"
						:fixedLimit="columnShow.query.fixedLimit"
						:joins="columnShow.query.joins"
						:joinsParents="[joins]"
						:orders="columnShow.query.orders"
						:lookups="columnShow.query.lookups"
						:moduleId="module.id"
						:relationId="columnShow.query.relationId"
					/>
					<my-builder-column-options
						@set="(...args) => columnSet(args[0],args[1])"
						:builderLanguage="builderLanguage"
						:column="columnShow"
						:hasCaptions="true"
						:moduleId="module.id"
						:onlyData="true"
					/>
				</template>
			</div>
			
			<!-- calls -->
			<div class="content" v-if="tabTarget === 'calls'">
				<my-builder-api-preview
					:api="api"
					:builderLanguage="builderLanguage"
					:columns="columns"
					:hasDelete="hasDelete"
					:hasGet="hasGet"
					:hasPost="hasPost"
					:joins="joins"
					:limitDef="limitDef"
					:module="module"
					:name="name"
					:verboseDef="verboseDef"
					:version="version"
					:warnings="warnings"
				/>
			</div>
			
			<!-- properties -->
			<div class="content" v-if="tabTarget === 'properties'">
				<table class="generic-table-vertical tight fullWidth default-inputs">
					<tbody>
						<tr>
							<td>{{ capGen.name }}</td>
							<td><input v-model="name" :disabled="readonly" /></td>
							<td>{{ capApp.nameHint }}</td>
						</tr>
						<tr>
							<td>{{ capGen.version }}</td>
							<td><input v-model.number="version" :disabled="readonly" /></td>
							<td>{{ capApp.versionHint }}</td>
						</tr>
						<tr>
							<td>{{ capGen.comments }}</td>
							<td colspan="2">
								<textarea class="long" v-model="comment" :disabled="readonly"></textarea>
							</td>
						</tr>
						<tr>
							<td>{{ capApp.content }}</td>
							<td><input disabled="disabled" :value="capApp.contentValue" /></td>
							<td></td>
						</tr>
						<tr>
							<td>{{ capApp.verboseDef }}</td>
							<td><my-bool v-model="verboseDef" /></td>
							<td>{{ capApp.verboseDefHint }}</td>
						</tr>
						<tr v-if="warnings.length !== 0">
							<td class="warnings">{{ capApp.warnings }}</td>
							<td colspan="2">
								<ul>
									<li v-for="w in warnings">{{ w }}</li>
								</ul>
							</td>
						</tr>
						<tr>
							<td>{{ capApp.httpMethods }}</td>
							<td colspan="2">
								<div class="column">
									<table>
										<tbody>
											<tr>
												<td>GET</td>
												<td><my-bool v-model="hasGet" /></td>
												<td>{{ capApp.hint.get }}</td>
											</tr>
											<tr>
												<td>POST</td>
												<td><my-bool v-model="hasPost" /></td>
												<td>{{ capApp.hint.post }}</td>
											</tr>
											<tr>
												<td>DELETE</td>
												<td><my-bool v-model="hasDelete" /></td>
												<td>{{ capApp.hint.delete }}</td>
											</tr>
										</tbody>
									</table>
								</div>
							</td>
						</tr>
						<tr v-if="hasGet">
							<td>{{ capApp.limitDef }}</td>
							<td><input v-model.number="limitDef" :disabled="readonly" /></td>
							<td>{{ capApp.limitDefHint }}</td>
						</tr>
						<tr v-if="hasGet">
							<td>{{ capApp.limitMax }}</td>
							<td><input v-model.number="limitMax" :disabled="readonly" /></td>
							<td>{{ capApp.limitMaxHint }}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		id:             { type:String,  required:false, default:'' },
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
			// query
			relationId:'',
			joins:[],
			filters:[],
			orders:[],
			lookups:[],
			fixedLimit:0,
			
			// API inputs
			columns:[],
			comment:'',
			hasDelete:false,
			hasGet:false,
			hasPost:false,
			limitDef:100,
			limitMax:1000,
			name:'',
			verboseDef:false,
			version:1,
			
			// state
			columnIdShow:null,
			filtersDisable:[
				'collection','field','fieldChanged','fieldValid','formChanged',
				'formState','javascript','record','recordNew','variable'
			],
			showPreview:false,
			showSidebar:true,
			tabTarget:'properties'
		};
	},
	computed:{
		// states
		columnShow:(s) => {
			if(s.columnIdShow === null) return false;
			
			for(let i = 0, j = s.columns.length; i < j; i++) {
				if(s.columns[i].id === s.columnIdShow)
					return s.columns[i];
			}
			return false;
		},
		hasChanges:(s) => s.name         !== s.api.name
			|| s.comment                 !== s.api.comment
			|| s.hasDelete               !== s.api.hasDelete
			|| s.hasGet                  !== s.api.hasGet
			|| s.hasPost                 !== s.api.hasPost
			|| s.limitDef                !== s.api.limitDef
			|| s.limitMax                !== s.api.limitMax
			|| s.verboseDef              !== s.api.verboseDef
			|| s.version                 !== s.api.version
			|| s.relationId              !== s.api.query.relationId
			|| s.fixedLimit              !== s.api.query.fixedLimit
			|| JSON.stringify(s.joins)   !== JSON.stringify(s.api.query.joins)
			|| JSON.stringify(s.filters) !== JSON.stringify(s.api.query.filters)
			|| JSON.stringify(s.orders)  !== JSON.stringify(s.api.query.orders)
			|| JSON.stringify(s.lookups) !== JSON.stringify(s.api.query.lookups)
			|| JSON.stringify(s.columns) !== JSON.stringify(s.api.columns),
		warnings:(s) => {
			let out = [];
			if(s.hasGet || s.hasPost) {
				// check no base relation/no columns
				if(s.relationId === '' || s.columns.length === 0)
					out.push(s.capApp.warning.noData);
			}
			if(s.hasPost) {
				// check sub queries in POST API
				for(let c of s.columns) {
					if(c.subQuery) {
						out.push(s.capApp.warning.postSubQuery);
						break;
					}
				}
				// check missing record lookups
				for(let j of s.joins) {
					if(!j.applyUpdate) continue;
					
					if(s.lookups.filter(l => l.index === j.index).length === 0) {
						out.push(s.capApp.warning.postNoUpdate);
						break;
					}
				}
			}
			return out;
		},
		
		// simple
		api:   (s) => typeof s.apiIdMap[s.id] === 'undefined' ? false : s.apiIdMap[s.id],
		module:(s) => s.moduleIdMap[s.api.moduleId],
		
		// stores
		moduleIdMap:(s) => s.$store.getters['schema/moduleIdMap'],
		apiIdMap:   (s) => s.$store.getters['schema/apiIdMap'],
		capApp:     (s) => s.$store.getters.captions.builder.api,
		capGen:     (s) => s.$store.getters.captions.generic
	},
	watch:{
		api:{
			handler() { this.reset(); },
			immediate:true
		}
	},
	methods:{
		// externals
		copyValueDialog,
		getNilUuid,
		
		// actions
		columnSet(name,value) {
			this.columnShow[name] = value;
		},
		columnSetQuery(name,value) {
			let v = JSON.parse(JSON.stringify(this.columnShow.query));
			v[name] = value;
			this.columnShow.query = v;
		},
		removeIndex(index) {
			for(let i = 0, j = this.columns.length; i < j; i++) {
				if(this.columns[i].index === index) {
					this.columns.splice(i,1);
					i--; j--;
				}
			}
		},
		reset() {
			if(!this.api) return;
			
			this.name       = this.api.name;
			this.comment    = this.api.comment;
			this.hasDelete  = this.api.hasDelete;
			this.hasGet     = this.api.hasGet;
			this.hasPost    = this.api.hasPost;
			this.limitDef   = this.api.limitDef;
			this.limitMax   = this.api.limitMax;
			this.verboseDef = this.api.verboseDef;
			this.version    = this.api.version;
			this.relationId = this.api.query.relationId;
			this.fixedLimit = this.api.query.fixedLimit;
			this.joins      = JSON.parse(JSON.stringify(this.api.query.joins));
			this.filters    = JSON.parse(JSON.stringify(this.api.query.filters));
			this.orders     = JSON.parse(JSON.stringify(this.api.query.orders));
			this.lookups    = JSON.parse(JSON.stringify(this.api.query.lookups));
			this.columns    = JSON.parse(JSON.stringify(this.api.columns));
			this.columnIdShow = null;
		},
		toggleColumnOptions(id) {
			this.columnIdShow = this.columnIdShow === id ? null : id;
			
			if(this.columnIdShow !== null)
				this.tabTarget = 'content';
		},
		
		// helpers
		replaceBuilderId(columns) {
			for(let i = 0, j = columns.length; i < j; i++) {
				if(columns[i].id.startsWith('new_'))
					columns[i].id = this.getNilUuid();
			}
			return columns;
		},
		
		// backend calls
		copy() {
			ws.send('api','copy',{id:this.id},true).then(
				() => {
					this.$root.schemaReload(this.module.id);
					this.$router.push('/builder/apis/'+this.module.id);
				},
				this.$root.genericError
			);
		},
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
			ws.send('api','del',{id:this.api.id},true).then(
				() => {
					this.$root.schemaReload(this.module.id);
					this.$router.push('/builder/apis/'+this.module.id);
				},
				this.$root.genericError
			);
		},
		set() {
			ws.sendMultiple([
				ws.prepare('api','set',{
					id:this.api.id,
					moduleId:this.api.moduleId,
					name:this.name,
					comment:this.comment === '' ? null : this.comment,
					columns:this.replaceBuilderId(
						JSON.parse(JSON.stringify(this.columns))
					),
					query:{
						id:this.api.query.id,
						relationId:this.relationId,
						joins:this.joins,
						filters:this.filters,
						orders:this.orders,
						lookups:this.lookups,
						fixedLimit:this.fixedLimit
					},
					hasDelete:this.hasDelete,
					hasGet:this.hasGet,
					hasPost:this.hasPost,
					limitDef:this.limitDef,
					limitMax:this.limitMax,
					verboseDef:this.verboseDef,
					version:this.version
				}),
				ws.prepare('schema','check',{moduleId:this.module.id})
			],true).then(
				() => this.$root.schemaReload(this.module.id),
				this.$root.genericError
			);
		}
	}
};