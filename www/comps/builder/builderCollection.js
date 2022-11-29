import MyBuilderQuery                  from './builderQuery.js';
import MyBuilderCollectionInput        from './builderCollectionInput.js';
import MyBuilderIconInput              from './builderIconInput.js';
import {getCollectionConsumerTemplate} from '../shared/collection.js';
import {getQueryTemplate}              from '../shared/query.js';
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
						@trigger="showInHeader = !showInHeader"
						:caption="capApp.inHeader"
						:image="showInHeader ? 'visible1.png' : 'visible0.png'"
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
									{{ attributeIdMap[c.attributeId].name }}
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
				
				<!-- collection to be shown in application header -->
				<div class="inHeader default-inputs" v-if="showInHeader">
					<table>
						<tr>
							<td>
								<my-button image="add.png"
									@trigger="collectionAdd"
									:active="!readonly"
									:caption="capGen.button.add"
									:naked="true"
								/>
							</td>
						</tr>
						<tr>
							<td>
								<my-builder-collection-input
									v-for="(c,i) in inHeader"
									@remove="collectionRemove(i)"
									@update:consumer="collectionSet(i,$event)"
									:allowFormOpen="true"
									:allowRemove="true"
									:consumer="c"
									:fixedCollection="true"
									:module="module"
									:readonly="readonly"
									:showMultiValue="false"
									:showNoDisplayEmpty="true"
									:showOnMobile="true"
								/>
							</td>
						</tr>
					</table>
				</div>
				
				<!-- collection query columns -->
				<div class="columnsTarget">
					<div v-if="columns.length === 0">{{ capApp.columnsTarget }}</div>
					<my-builder-columns groupName="columns"
						@columns-set="columns = $event"
						@column-id-query-set="columnIdQuery = $event"
						@column-remove=""
						:builderLanguage="builderLanguage"
						:columnIdQuery="columnIdQuery"
						:columns="columns"
						:displayOptions="false"
						:hasCaptions="true"
						:joins="joins"
						:isTemplate="false"
						:moduleId="module.id"
						:showCaptions="true"
					/>
				</div>
			</div>
			
			<div class="columnsTemplates">
				<my-builder-column-templates groupName="columns"
					:builderLanguage="builderLanguage"
					:columns="columns"
					:hasCaptions="true"
					:joins="joins"
					:moduleId="module.id"
				/>
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
			
			<div class="content" v-if="tabTarget === 'content'">
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
					:choices="[]"
					:filters="filters"
					:fixedLimit="fixedLimit"
					:joins="joins"
					:lookups="[]"
					:moduleId="module.id"
					:orders="orders"
					:relationId="relationId"
				/>
				
				<template v-if="showColumnQuery">
					<!-- column sub query -->
					<br /><br />
					<div class="row">
						<my-button image="database.png"
							:active="false"
							:caption="capApp.contentColumn"
							:large="true"
							:naked="true"
						/>
					</div>
					
					<my-builder-query
						@set-choices="columnQuerySet('choices',$event)"
						@set-filters="columnQuerySet('filters',$event)"
						@set-fixed-limit="columnQuerySet('fixedLimit',$event)"
						@set-joins="columnQuerySet('joins',$event)"
						@set-lookups="columnQuerySet('lookups',$event)"
						@set-orders="columnQuerySet('orders',$event)"
						@set-relation-id="columnQuerySet('relationId',$event)"
						:allowChoices="false"
						:allowOrders="true"
						:builderLanguage="builderLanguage"
						:choices="columnQueryEdit.query.choices"
						:filters="columnQueryEdit.query.filters"
						:fixedLimit="columnQueryEdit.query.fixedLimit"
						:joins="columnQueryEdit.query.joins"
						:joinsParents="[joins]"
						:orders="columnQueryEdit.query.orders"
						:lookups="columnQueryEdit.query.lookups"
						:moduleId="module.id"
						:relationId="columnQueryEdit.query.relationId"
					/>
				</template>
			</div>
			
			<div class="content" v-if="tabTarget === 'properties'">
				<table class="builder-table-vertical tight fullWidth default-inputs">
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
	mounted:function() {
		this.$emit('hotkeysRegister',[{fnc:this.set,key:'s',keyCtrl:true}]);
	},
	unmounted:function() {
		this.$emit('hotkeysRegister',[]);
	},
	data:function() {
		return {
			// query
			relationId:'',
			joins:[],
			filters:[],
			orders:[],
			fixedLimit:0,
			
			// inputs
			columns:[],
			columnIdQuery:null,
			iconId:null,
			inHeader:[],
			name:'',
			
			// state
			showInHeader:false,
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
		columnQueryEdit:(s) => {
			if(s.columnIdQuery === null) return false;
			
			for(let i = 0, j = s.columns.length; i < j; i++) {
				if(s.columns[i].id === s.columnIdQuery)
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
		collection:     (s) => typeof s.collectionIdMap[s.id] === 'undefined' ? false : s.collectionIdMap[s.id],
		module:         (s) => s.moduleIdMap[s.collection.moduleId],
		showColumnQuery:(s) => s.columnQueryEdit !== false,
		
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
			handler:function() { this.reset(); },
			immediate:true
		}
	},
	methods:{
		// externals
		copyValueDialog,
		getCollectionConsumerTemplate,
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
		columnQuerySet(name,value) {
			let v = JSON.parse(JSON.stringify(this.columnQueryEdit.query));
			v[name] = value;
			this.columnQueryEdit.query = v;
		},
		removeIndex(index) {
			for(let i = 0, j = this.columns.length; i < j; i++) {
				let c = this.columns[i];
				
				if(c.index === index) {
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