import MyBuilderCaption       from './builderCaption.js';
import MyBuilderColumnOptions from './builderColumnOptions.js';
import MyBuilderIconInput     from './builderIconInput.js';
import MyBuilderOpenFormInput from './builderOpenFormInput.js';
import MyBuilderQuery         from './builderQuery.js';
import MyTabs                 from '../tabs.js';
import {
	getItemTitleColumn,
	getSqlPreview
} from '../shared/builder.js';
import {
	MyBuilderColumns,
	MyBuilderColumnTemplates
} from './builderColumns.js';
import {
	copyValueDialog,
	getNilUuid
} from '../shared/generic.js';
import {
	getIsContentInAnyFilter,
	getJoinIndexMap
} from '../shared/query.js';
export {MyBuilderSearchBar as default};

let MyBuilderSearchBar = {
	name:'my-builder-search-bar',
	components:{
		MyBuilderCaption,
		MyBuilderColumnOptions,
		MyBuilderColumns,
		MyBuilderColumnTemplates,
		MyBuilderIconInput,
		MyBuilderOpenFormInput,
		MyBuilderQuery,
		MyTabs
	},
	template:`<div class="builder-search-bar" v-if="searchBar">
		<div class="contentBox grow">
			<div class="top">
				<div class="area nowrap">
					<img class="icon" src="images/tray.png" />
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
				</div>
				<div class="area nowrap">
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
				
				<div class="builder-search-bar-columns">
				
					<!-- query columns -->
					<div class="builder-search-bar-columns-active">
						<h2>{{ capGen.columnsActive }}</h2>
						<my-builder-columns groupName="columns"
							@columns-set="columns = $event"
							@column-id-show="toggleColumnOptions($event)"
							:builderLanguage="builderLanguage"
							:columnIdShow="columnIdShow"
							:columns="columns"
							:hasCaptions="true"
						/>
					</div>
					
					<div class="builder-search-bar-columns-available">
						<h2>{{ capGen.columnsAvailable }}</h2>
						<div class="builder-search-bar-column-templates">
							<my-builder-column-templates groupName="batches_columns"
								@column-add="columns.push($event)"
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
				:entries="['content','properties']"
				:entriesIcon="['images/database.png','images/edit.png']"
				:entriesText="[capGen.content,capGen.properties]"
			/>
			
			<!-- content -->
			<div class="content grow" v-if="tabTarget === 'content'">
				<my-builder-query
					@index-removed="removeIndex($event)"
					@set-filters="filters = $event"
					@set-fixed-limit="fixedLimit = $event"
					@set-joins="joins = $event"
					@set-orders="orders = $event"
					@set-relation-id="relationId = $event"
					:allowChoices="false"
					:allowLookups="false"
					:allowOrders="true"
					:builderLanguage="builderLanguage"
					:filters="filters"
					:filtersDisable="filtersDisable"
					:fixedLimit="fixedLimit"
					:joins="joins"
					:moduleId="module.id"
					:orders="orders"
					:relationId="relationId"
				/>

				<!-- SQL preview -->
				<div class="row">
					<my-button image="code.png"
						@trigger="getSqlPreview(searchBar.query,searchBar.columns)"
						:caption="capGen.sqlPreview"
					/>
				</div>
				
				<!-- no global search input warning -->
				<template v-if="!anySearchInput">
					<br />
					<my-label image="warning.png"
						:caption="capApp.warning.noSearchInput"
						:error="true"
					/>
				</template>
				
				<!-- column settings -->
				<template v-if="columnShow !== false">
					<br />
					<h3 class="selected-ref">{{ capGen.columnSettings }}</h3>
					
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
						:onlyData="false"
					/>
				</template>
			</div>
			
			<!-- properties -->
			<div class="content no-padding" v-if="tabTarget === 'properties'">
				<table class="generic-table-vertical default-inputs">
					<tbody>
						<tr>
							<td>{{ capGen.name }}</td>
							<td><input v-model="name" :disabled="readonly" /></td>
						</tr>
						<tr>
							<td>{{ capGen.title }}</td>
							<td>
								<div class="row gap centered">
									<my-builder-caption
										v-model="captions.searchBarTitle"
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
							<td>{{ capGen.icon }}</td>
							<td>
								<my-builder-icon-input
									@input="iconId = $event"
									:iconIdSelected="iconId"
									:module="module"
									:title="capGen.icon"
									:readonly="readonly"
								/>
							</td>
						</tr>
						<tr>
							<td>{{ capGen.formOpen }}</td>
							<td>
								<my-builder-open-form-input
									@update:openForm="openForm = $event"
									:allowAllForms="false"
									:joinsIndexMapField="joinIndexMap"
									:module="module"
									:openForm="openForm"
									:readonly="readonly"
								/>
							</td>
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
			fixedLimit:0,
			
			// inputs
			columns:[],
			iconId:null,
			name:'',
			openForm:null,
			captions:{},
			
			// state
			columnIdShow:null,
			filtersDisable:[
				'field','fieldChanged','fieldValid','formChanged','formState','getter','javascript',
				'record','recordMayCreate','recordMayDelete','recordMayUpdate','recordNew'
			],
			showSidebar:true,
			tabTarget:'content'
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
		hasChanges:(s) => s.name          !== s.searchBar.name
			|| s.iconId                   !== s.searchBar.iconId
			|| s.relationId               !== s.searchBar.query.relationId
			|| s.fixedLimit               !== s.searchBar.query.fixedLimit
			|| JSON.stringify(s.joins)    !== JSON.stringify(s.searchBar.query.joins)
			|| JSON.stringify(s.filters)  !== JSON.stringify(s.searchBar.query.filters)
			|| JSON.stringify(s.orders)   !== JSON.stringify(s.searchBar.query.orders)
			|| JSON.stringify(s.columns)  !== JSON.stringify(s.searchBar.columns)
			|| JSON.stringify(s.captions) !== JSON.stringify(s.searchBar.captions)
			|| JSON.stringify(s.openForm) !== JSON.stringify(s.searchBar.openForm),
		
		// simple
		anySearchInput:(s) => s.getIsContentInAnyFilter(s.filters,s.columns,'globalSearch'),
		joinIndexMap:  (s) => s.getJoinIndexMap(s.joins),
		searchBar:     (s) => s.searchBarIdMap[s.id] === undefined ? false : s.searchBarIdMap[s.id],
		module:        (s) => s.moduleIdMap[s.searchBar.moduleId],
		
		// stores
		moduleIdMap:   (s) => s.$store.getters['schema/moduleIdMap'],
		searchBarIdMap:(s) => s.$store.getters['schema/searchBarIdMap'],
		capApp:        (s) => s.$store.getters.captions.builder.searchBar,
		capGen:        (s) => s.$store.getters.captions.generic
	},
	watch:{
		searchBar:{
			handler() { this.reset(); },
			immediate:true
		}
	},
	methods:{
		// externals
		copyValueDialog,
		getIsContentInAnyFilter,
		getItemTitleColumn,
		getJoinIndexMap,
		getNilUuid,
		getSqlPreview,
		
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
			if(!this.searchBar) return;
			
			this.name       = this.searchBar.name;
			this.iconId     = this.searchBar.iconId;
			this.relationId = this.searchBar.query.relationId;
			this.fixedLimit = this.searchBar.query.fixedLimit;
			this.joins      = JSON.parse(JSON.stringify(this.searchBar.query.joins));
			this.filters    = JSON.parse(JSON.stringify(this.searchBar.query.filters));
			this.orders     = JSON.parse(JSON.stringify(this.searchBar.query.orders));
			this.columns    = JSON.parse(JSON.stringify(this.searchBar.columns));
			this.captions   = JSON.parse(JSON.stringify(this.searchBar.captions));
			this.openForm   = JSON.parse(JSON.stringify(this.searchBar.openForm));
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
			ws.send('searchBar','del',this.searchBar.id,true).then(
				() => {
					this.$root.schemaReload(this.module.id);
					this.$router.push('/builder/search-bars/'+this.searchBar.moduleId);
				},
				this.$root.genericError
			);
		},
		set() {
			ws.sendMultiple([
				ws.prepare('searchBar','set',{
					id:this.searchBar.id,
					moduleId:this.searchBar.moduleId,
					iconId:this.iconId,
					name:this.name,
					columns:this.replaceBuilderId(
						JSON.parse(JSON.stringify(this.columns))
					),
					query:{
						id:this.searchBar.query.id,
						relationId:this.relationId,
						joins:this.joins,
						filters:this.filters,
						orders:this.orders,
						fixedLimit:this.fixedLimit
					},
					captions:this.captions,
					openForm:this.openForm
				}),
				ws.prepare('schema','check',{moduleId:this.module.id})
			],true).then(
				() => this.$root.schemaReload(this.module.id),
				this.$root.genericError
			);
		}
	}
};