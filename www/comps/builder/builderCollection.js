import MyBuilderQuery     from './builderQuery.js';
import {getNilUuid}       from '../shared/generic.js';
import {getQueryTemplate} from '../shared/query.js';
import {
	MyBuilderColumns,
	MyBuilderColumnTemplates
} from './builderColumns.js';
export {MyBuilderCollection as default};

let MyBuilderCollection = {
	name:'my-builder-collection',
	components:{
		MyBuilderColumns,
		MyBuilderColumnTemplates,
		MyBuilderQuery
	},
	template:`<div class="builder-collection" v-if="collection">
	
		<div class="contentBox grow">
			<div class="top">
				<div class="area nowrap">
					<div class="separator"></div>
					<h1 class="title">
						{{ capApp.titleOne.replace('{NAME}',collection.name) }}
					</h1>
				</div>
				<div class="area">
					<my-button
						@trigger="showSidebar = !showSidebar"
						:darkBg="true"
						:image="showSidebar ? 'toggleRight.png' : 'toggleLeft.png'"
					/>
				</div>
			</div>
			<div class="top lower">
				<div class="area nowrap">
					<my-button image="save.png"
						@trigger="set"
						:active="hasChanges"
						:caption="capGen.button.save"
						:darkBg="true"
					/>
					<my-button image="refresh.png"
						@trigger="reset"
						:active="hasChanges"
						:caption="capGen.button.refresh"
						:darkBg="true"
					/>
					<my-button
						@trigger="showPreview = !showPreview"
						:caption="capGen.preview"
						:darkBg="true"
						:image="showPreview ? 'visible1.png' : 'visible0.png'"
					/>
				</div>
			</div>
			
			<div class="content no-padding">
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
			<div class="top">
				<div class="area">
					<img class="icon" src="images/database.png" />
					<h1>{{ capApp.query }}</h1>
				</div>
			</div>
			<div class="top lower" v-if="settings.compact" />
			
			<div class="content">
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
		</div>
	</div>`,
	props:{
		builderLanguage:{ type:String, required:true },
		id:             { type:String, required:false, default:'' }
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
			
			// state
			showPreview:false,
			showSidebar:true
		};
	},
	computed:{
		// entities
		collection:function() {
			return typeof this.collectionIdMap[this.id] === 'undefined'
				? false : this.collectionIdMap[this.id];
		},
		columnQueryEdit:function() {
			if(this.columnIdQuery === null) return false;
			
			for(let i = 0, j = this.columns.length; i < j; i++) {
				if(this.columns[i].id === this.columnIdQuery)
					return this.columns[i];
			}
			return false;
		},
		
		// states
		hasChanges:function() {
			return this.relationId              !== this.collection.query.relationId
				|| this.fixedLimit              !== this.collection.query.fixedLimit
				|| JSON.stringify(this.joins)   !== JSON.stringify(this.collection.query.joins)
				|| JSON.stringify(this.filters) !== JSON.stringify(this.collection.query.filters)
				|| JSON.stringify(this.orders)  !== JSON.stringify(this.collection.query.orders)
				|| JSON.stringify(this.columns) !== JSON.stringify(this.collection.columns)
			;
		},
		showColumnQuery:function() {
			return this.columnQueryEdit !== false;
		},
		
		// entities
		module:function() {
			return this.moduleIdMap[this.collection.moduleId];
		},
		collectionRows:function() {
			let col = this.$store.getters.collectionIdMap[this.collection.id];
			return typeof col !== 'undefined' ? col : [];
		},
		
		// stores
		moduleIdMap:    function() { return this.$store.getters['schema/moduleIdMap']; },
		attributeIdMap: function() { return this.$store.getters['schema/attributeIdMap']; },
		collectionIdMap:function() { return this.$store.getters['schema/collectionIdMap']; },
		settings:       function() { return this.$store.getters.settings; },
		capApp:         function() { return this.$store.getters.captions.builder.collection; },
		capGen:         function() { return this.$store.getters.captions.generic; }
	},
	watch:{
		collection:{
			handler:function() { this.reset(); },
			immediate:true
		}
	},
	methods:{
		// externals
		getNilUuid,
		
		// actions
		columnQuerySet:function(name,value) {
			let v = JSON.parse(JSON.stringify(this.columnQueryEdit.query));
			v[name] = value;
			this.columnQueryEdit.query = v;
		},
		removeIndex:function(index) {
			for(let i = 0, j = this.columns.length; i < j; i++) {
				let c = this.columns[i];
				
				if(c.index === index) {
					this.columns.splice(i,1);
					i--; j--;
				}
			}
		},
		reset:function() {
			if(!this.collection) return;
			
			this.relationId = this.collection.query.relationId;
			this.fixedLimit = this.collection.query.fixedLimit;
			this.joins      = JSON.parse(JSON.stringify(this.collection.query.joins));
			this.filters    = JSON.parse(JSON.stringify(this.collection.query.filters));
			this.orders     = JSON.parse(JSON.stringify(this.collection.query.orders));
			this.columns    = JSON.parse(JSON.stringify(this.collection.columns));
		},
		
		// helpers
		replaceBuilderId:function(columns) {
			for(let i = 0, j = columns.length; i < j; i++) {
				
				if(columns[i].id.startsWith('new_'))
					columns[i].id = this.getNilUuid();
			}
			return columns;
		},
		
		// backend calls
		set:function() {
			let requests = [];
			requests.push(ws.prepare('collection','set',{
				id:this.collection.id,
				moduleId:this.collection.moduleId,
				name:this.collection.name,
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
				}
			}));
			requests.push(ws.prepare('schema','check',{
				moduleId:this.collection.moduleId
			}));
			
			ws.sendMultiple(requests,true).then(
				(res) => this.$root.schemaReload(this.module.id),
				(err) => this.$root.genericError(err)
			);
		}
	}
};