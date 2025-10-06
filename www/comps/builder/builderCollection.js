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

const MyBuilderCollection = {
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
					<my-button
						@trigger="showPreview = !showPreview"
						:caption="capGen.preview"
						:image="showPreview ? 'checkbox1.png' : 'checkbox0.png'"
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
						<h2>{{ capGen.columnsActive }}</h2>
						<my-builder-columns groupName="columns"
							@columns-set="columns = $event"
							@column-id-show="toggleColumnOptions($event)"
							:builderLanguage="builderLanguage"
							:columnIdShow="columnIdShow"
							:columns="columns"
							:hasBatches="false"
							:hasCaptions="true"
							:hasStyling="false"
						/>
					</div>
					
					<div class="builder-collection-columns-available">
						<h2>{{ capGen.columnsAvailable }}</h2>
						<div class="builder-collection-column-templates">
							<my-builder-column-templates groupName="batches_columns"
								@column-add="columns.push($event)"
								:allowRelationships="true"
								:columns="columns"
								:joins="query.joins"
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
					v-model="query"
					@index-removed="removeIndex($event)"
					:allowChoices="false"
					:allowLookups="false"
					:allowOrders="true"
					:builderLanguage="builderLanguage"
					:filtersDisable="filtersDisable"
					:moduleId="module.id"
				/>
				
				<!-- column settings -->
				<template v-if="columnShow !== false">
					<br />
					<h3 class="selected-ref">{{ capGen.columnSettings }}</h3>
					
					<my-builder-query
						v-if="columnShow.subQuery"
						v-model="columnShow.query"
						:allowChoices="false"
						:allowOrders="true"
						:builderLanguage="builderLanguage"
						:filtersDisable="filtersDisable"
						:joinsParents="[query.joins]"
						:moduleId="module.id"
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
			<div class="content no-padding" v-if="tabTarget === 'properties'">
				<table class="generic-table-vertical default-inputs">
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
			// inputs
			columns:[],
			iconId:null,
			inHeader:[],
			name:'',
			query:{},
			
			// state
			columnIdShow:null,
			filtersDisable:[
				'collection','field','fieldChanged','fieldValid','formChanged',
				'formState','getter','globalSearch','javascript','record','recordMayCreate',
				'recordMayDelete','recordMayUpdate','recordNew','variable'
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
			|| JSON.stringify(s.query)    !== JSON.stringify(s.collection.query)
			|| JSON.stringify(s.columns)  !== JSON.stringify(s.collection.columns)
			|| JSON.stringify(s.inHeader) !== JSON.stringify(s.collection.inHeader),
		
		// simple
		collection:(s) => typeof s.collectionIdMap[s.id] === 'undefined' ? false : s.collectionIdMap[s.id],
		module:    (s) => s.moduleIdMap[s.collection.moduleId],
		
		// stores
		moduleIdMap:    (s) => s.$store.getters['schema/moduleIdMap'],
		attributeIdMap: (s) => s.$store.getters['schema/attributeIdMap'],
		collectionIdMap:(s) => s.$store.getters['schema/collectionIdMap'],
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
			
			this.name     = this.collection.name;
			this.iconId   = this.collection.iconId;
			this.query    = JSON.parse(JSON.stringify(this.collection.query));
			this.columns  = JSON.parse(JSON.stringify(this.collection.columns));
			this.inHeader = JSON.parse(JSON.stringify(this.collection.inHeader));
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
					query:this.query,
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