import MyBuilderQuery         from './builderQuery.js';
import MyBuilderColumnOptions from './builderColumnOptions.js';
import {getItemTitleColumn}   from '../shared/builder.js';
import MyTabs                 from '../tabs.js';
import {
	MyBuilderColumns,
	MyBuilderColumnTemplates
} from './builderColumns.js';
import {
	copyValueDialog,
	getNilUuid
} from '../shared/generic.js';
export {MyBuilderApi as default};

let MyBuilderApi = {
	name:'my-builder-api',
	components:{
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
				
					<!-- query columns -->
					<div class="builder-api-columns-active">
						<h2>{{ capApp.columnsTarget }}</h2>
						<my-builder-columns groupName="columns"
							@columns-set="columns = $event"
							@column-id-show="toggleColumnOptions($event)"
							@column-remove=""
							:builderLanguage="builderLanguage"
							:columnIdShow="columnIdShow"
							:columns="columns"
							:hasCaptions="true"
							:joins="joins"
							:isTemplate="false"
							:moduleId="module.id"
							:showOptions="false"
						/>
					</div>
					
					<div class="builder-api-columns-available">
						<h2>{{ capApp.columnsAvailable }}</h2>
						<div class="builder-api-column-templates">
							<my-builder-column-templates groupName="columns"
								:builderLanguage="builderLanguage"
								:columns="columns"
								:hasCaptions="true"
								:joins="joins"
								:moduleId="module.id"
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
				:entries="['content','properties']"
				:entriesIcon="['images/database.png','images/edit.png']"
				:entriesText="[capGen.content,capGen.properties]"
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
			
			<!-- properties -->
			<div class="content" v-if="tabTarget === 'properties'">
				<table class="builder-table-vertical tight fullWidth default-inputs">
					<tr>
						<td>{{ capGen.name }}</td>
						<td><input v-model="name" :disabled="readonly" /></td>
						<td>{{ capApp.nameHint }}</td>
					</tr>
					<tr>
						<td>{{ capApp.content }}</td>
						<td><input disabled="disabled" :value="capApp.contentValue" /></td>
						<td></td>
					</tr>
					<tr>
						<td>{{ capApp.httpMethods }}</td>
						<td colspan="2">
							<div class="column">
								<table>
									<tr>
										<td>GET</td>
										<td><my-bool v-model="hasGet" /></td>
										<td>{{ capApp.hasGetHint }}</td>
									</tr>
									<tr>
										<td>POST</td>
										<td><my-bool v-model="hasPost" /></td>
										<td>{{ capApp.hasPostHint }}</td>
									</tr>
									<tr>
										<td>DELETE</td>
										<td><my-bool v-model="hasDelete" /></td>
										<td>{{ capApp.hasDeleteHint }}</td>
									</tr>
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
				</table>
			</div>
		</div>
	</div>`,
	emits:['hotkeysRegister'],
	props:{
		builderLanguage:{ type:String,  required:true },
		id:             { type:String,  required:false, default:'' },
		readonly:       { type:Boolean, required:true }
	},
	mounted() {
		this.$emit('hotkeysRegister',[{fnc:this.set,key:'s',keyCtrl:true}]);
	},
	unmounted() {
		this.$emit('hotkeysRegister',[]);
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
			
			// inputs
			columns:[],
			hasDelete:false,
			hasGet:false,
			hasPost:false,
			limitDef:100,
			limitMax:1000,
			name:'',
			verboseDef:false,
			
			// state
			columnIdShow:null,
			showPreview:false,
			showSidebar:true,
			tabTarget:'properties'
		};
	},
	computed:{
		columnShow:(s) => {
			if(s.columnIdShow === null) return false;
			
			for(let i = 0, j = s.columns.length; i < j; i++) {
				if(s.columns[i].id === s.columnIdShow)
					return s.columns[i];
			}
			return false;
		},
		hasChanges:(s) => s.name         !== s.api.name
			|| s.hasDelete               !== s.api.hasDelete
			|| s.hasGet                  !== s.api.hasGet
			|| s.hasPost                 !== s.api.hasPost
			|| s.limitDef                !== s.api.limitDef
			|| s.limitMax                !== s.api.limitMax
			|| s.verboseDef              !== s.api.verboseDef
			|| s.relationId              !== s.api.query.relationId
			|| s.fixedLimit              !== s.api.query.fixedLimit
			|| JSON.stringify(s.joins)   !== JSON.stringify(s.api.query.joins)
			|| JSON.stringify(s.filters) !== JSON.stringify(s.api.query.filters)
			|| JSON.stringify(s.orders)  !== JSON.stringify(s.api.query.orders)
			|| JSON.stringify(s.lookups) !== JSON.stringify(s.api.query.lookups)
			|| JSON.stringify(s.columns) !== JSON.stringify(s.api.columns),
		
		// simple
		api:   (s) => typeof s.apiIdMap[s.id] === 'undefined' ? false : s.apiIdMap[s.id],
		module:(s) => s.moduleIdMap[s.api.moduleId],
		
		// stores
		moduleIdMap:   (s) => s.$store.getters['schema/moduleIdMap'],
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		apiIdMap:      (s) => s.$store.getters['schema/apiIdMap'],
		settings:      (s) => s.$store.getters.settings,
		capApp:        (s) => s.$store.getters.captions.builder.api,
		capGen:        (s) => s.$store.getters.captions.generic
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
		getItemTitleColumn,
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
			this.hasDelete  = this.api.hasDelete;
			this.hasGet     = this.api.hasGet;
			this.hasPost    = this.api.hasPost;
			this.limitDef   = this.api.limitDef;
			this.limitMax   = this.api.limitMax;
			this.verboseDef = this.api.verboseDef;
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
					verboseDef:this.verboseDef
				}),
				ws.prepare('schema','check',{moduleId:this.module.id})
			],true).then(
				() => this.$root.schemaReload(this.module.id),
				this.$root.genericError
			);
		}
	}
};