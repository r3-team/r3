import MyBuilderQuery                  from './builderQuery.js';
import MyBuilderCollectionInput        from './builderCollectionInput.js';
import MyBuilderColumnOptions          from './builderColumnOptions.js';
import MyBuilderIconInput              from './builderIconInput.js';
import {getItemTitleColumn}            from '../shared/builder.js';
import {getCollectionConsumerTemplate} from '../shared/collection.js';
import MyTabs                          from '../tabs.js';
import {
	MyBuilderColumns,
	MyBuilderColumnTemplates
} from './builderColumns.js';
import {
	copyValueDialog,
	getNilUuid
} from '../shared/generic.js';
export {MyBuilderCollection as default};

let MyBuilderCollection = {
	name:'my-builder-collection',
	components:{
		MyBuilderColumnOptions,
		MyBuilderCollectionInput,
		MyBuilderColumns,
		MyBuilderColumnTemplates,
		MyBuilderIconInput,
		MyBuilderQuery,
		MyTabs
	},
	template:`<div class="builder-collection" v-if="collection">
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
			
			<div class="content no-padding">
				
				<!-- collection value preview -->
				<div class="preview" v-if="showPreview">
					<table>
						<thead>
							<tr>
								<th v-for="c in collection.columns">
									{{ getItemTitleColumn(c,true) }}
								</th>
							</tr>
						</thead>
						<tbody>
							<tr v-for="r in collectionRows">
								<td v-for="v in r">{{ v }}</td>
							</tr>
						</tbody>
					</table>
					<p>{{ capApp.previewHint }}</p>
				</div>
				
				<div class="builder-collection-columns">
				
					<!-- collection query columns -->
					<div class="builder-collection-columns-active">
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
					
					<div class="builder-collection-columns-available">
						<h2>{{ capApp.columnsAvailable }}</h2>
						<div class="builder-collection-column-templates">
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
				:entries="['content','properties']"
				:entriesIcon="['images/database.png','images/edit.png']"
				:entriesText="[capGen.content,capGen.properties]"
			/>
			
			<!-- collection content -->
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
			
			<!-- collection properties -->
			<div class="content" v-if="tabTarget === 'properties'">
				<table class="generic-table-vertical tight fullWidth default-inputs">
					<tbody>
						<tr>
							<td>{{ capGen.name }}</td>
							<td><input v-model="name" :disabled="readonly" /></td>
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
							<td>
								<div class="column gap">
									<span>{{ capApp.inHeader }}</span>
									<my-button image="add.png"
										@trigger="collectionAdd"
										:active="!readonly"
										:caption="capGen.button.add"
										:naked="true"
									/>
								</div>
							</td>
							<td>
								<my-builder-collection-input
									v-for="(c,i) in inHeader"
									@remove="collectionRemove(i)"
									@update:consumer="collectionSet(i,$event)"
									:allowFormOpen="true"
									:allowRemove="true"
									:consumer="c"
									:fixedCollection="true"
									:flagsEnable="['noDisplayEmpty','showRowCount']"
									:module="module"
									:readonly="readonly"
									:showOnMobile="true"
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
			inHeader:[],
			name:'',
			
			// state
			columnIdShow:null,
			filtersDisable:[
				'collection','formChanged','field','fieldChanged','fieldValid',
				'formState','getter','javascript','record','recordNew','variable'
			],
			showPreview:false,
			showSidebar:true,
			tabTarget:'content'
		};
	},
	computed:{
		collectionRows:(s) => {
			const col = s.$store.getters.collectionIdMap[s.collection.id];
			if(typeof col === 'undefined')
				return [];
			
			let out = [];
			for(const r of col) {
				out.push(r.values);
			}
			return out;
		},
		columnShow:(s) => {
			if(s.columnIdShow === null) return false;
			
			for(let i = 0, j = s.columns.length; i < j; i++) {
				if(s.columns[i].id === s.columnIdShow)
					return s.columns[i];
			}
			return false;
		},
		hasChanges:(s) => s.name          !== s.collection.name
			|| s.iconId                   !== s.collection.iconId
			|| s.relationId               !== s.collection.query.relationId
			|| s.fixedLimit               !== s.collection.query.fixedLimit
			|| JSON.stringify(s.joins)    !== JSON.stringify(s.collection.query.joins)
			|| JSON.stringify(s.filters)  !== JSON.stringify(s.collection.query.filters)
			|| JSON.stringify(s.orders)   !== JSON.stringify(s.collection.query.orders)
			|| JSON.stringify(s.columns)  !== JSON.stringify(s.collection.columns)
			|| JSON.stringify(s.inHeader) !== JSON.stringify(s.collection.inHeader),
		
		// simple
		collection:(s) => typeof s.collectionIdMap[s.id] === 'undefined' ? false : s.collectionIdMap[s.id],
		module:    (s) => s.moduleIdMap[s.collection.moduleId],
		
		// stores
		moduleIdMap:    (s) => s.$store.getters['schema/moduleIdMap'],
		attributeIdMap: (s) => s.$store.getters['schema/attributeIdMap'],
		collectionIdMap:(s) => s.$store.getters['schema/collectionIdMap'],
		settings:       (s) => s.$store.getters.settings,
		capApp:         (s) => s.$store.getters.captions.builder.collection,
		capGen:         (s) => s.$store.getters.captions.generic
	},
	watch:{
		collection:{
			handler() { this.reset(); },
			immediate:true
		}
	},
	methods:{
		// externals
		copyValueDialog,
		getCollectionConsumerTemplate,
		getItemTitleColumn,
		getNilUuid,
		
		// actions
		collectionAdd() {
			let v = JSON.parse(JSON.stringify(this.inHeader));
			let c = this.getCollectionConsumerTemplate();
			c.collectionId = this.collection.id;
			v.push(c);
			this.inHeader = v;
		},
		collectionRemove(i) {
			this.inHeader.splice(i,1);
		},
		collectionSet(i,value) {
			this.inHeader[i] = value;
		},
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
			if(!this.collection) return;
			
			this.name       = this.collection.name;
			this.iconId     = this.collection.iconId;
			this.relationId = this.collection.query.relationId;
			this.fixedLimit = this.collection.query.fixedLimit;
			this.joins      = JSON.parse(JSON.stringify(this.collection.query.joins));
			this.filters    = JSON.parse(JSON.stringify(this.collection.query.filters));
			this.orders     = JSON.parse(JSON.stringify(this.collection.query.orders));
			this.columns    = JSON.parse(JSON.stringify(this.collection.columns));
			this.inHeader   = JSON.parse(JSON.stringify(this.collection.inHeader));
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
			ws.send('collection','del',{id:this.collection.id},true).then(
				() => {
					this.$root.schemaReload(this.module.id);
					this.$router.push('/builder/collections/'+this.collection.moduleId);
				},
				this.$root.genericError
			);
		},
		set() {
			ws.sendMultiple([
				ws.prepare('collection','set',{
					id:this.collection.id,
					moduleId:this.collection.moduleId,
					iconId:this.iconId,
					name:this.name,
					columns:this.replaceBuilderId(
						JSON.parse(JSON.stringify(this.columns))
					),
					query:{
						id:this.collection.query.id,
						relationId:this.relationId,
						joins:this.joins,
						filters:this.filters,
						orders:this.orders,
						fixedLimit:this.fixedLimit
					},
					inHeader:this.inHeader
				}),
				ws.prepare('schema','check',{moduleId:this.module.id})
			],true).then(
				() => this.$root.schemaReload(this.module.id),
				this.$root.genericError
			);
		}
	}
};