import MyBuilderQuery           from './builderQuery.js';
import MyBuilderCollectionInput from './builderCollectionInput.js';
import MyBuilderColumnOptions   from './builderColumnOptions.js';
import MyBuilderIconInput       from './builderIconInput.js';
import {getItemTitleColumn}     from '../shared/builder.js';
import {dialogDeleteAsk}        from '../shared/dialog.js';
import {
	MyBuilderColumns,
	MyBuilderColumnTemplates
} from './builderColumns.js';
import {
	getTemplateCollectionConsumer,
	getTemplateQuery
} from '../shared/builderTemplate.js';
import {
	copyValueDialog,
	deepIsEqual
} from '../shared/generic.js';

export default {
	name:'my-builder-collection',
	components:{
		MyBuilderColumnOptions,
		MyBuilderCollectionInput,
		MyBuilderColumns,
		MyBuilderColumnTemplates,
		MyBuilderIconInput,
		MyBuilderQuery
	},
	template:`<div class="builder-collection" v-if="collection !== false">
		<div class="contentBox grow">
			<div class="top">
				<div class="area nowrap">
					<img class="icon" src="images/tray.png" />
					<h1 class="title">
						{{ capApp.titleOne.replace('{NAME}',collection.name) }}
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
						@trigger="reset(true)"
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
						@trigger="copyValueDialog(collection.name,id,id)"
						:caption="capGen.id"
					/>
					<my-button image="delete.png"
						@trigger="dialogDeleteAsk(del,capApp.dialog.delete)"
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
								<th v-for="c in collectionSchema.columns">
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
							@columns-set="collection.columns = $event"
							@column-id-show="toggleColumnOptions($event)"
							:builderLanguage
							:columnIdShow
							:columns="collection.columns"
							:hasBatches="false"
							:hasCaptions="true"
							:hasStyling="false"
							:readonly
						/>
					</div>
					
					<div class="builder-collection-columns-available">
						<h2>{{ capGen.columnsAvailable }}</h2>
						<div class="builder-collection-column-templates">
							<my-builder-column-templates groupName="batches_columns"
								@column-add="collection.columns.push($event)"
								:allowRelationships="true"
								:columns="collection.columns"
								:joins="query.joins"
								:readonly
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
					@update:modelValue="collection.query = $event"
					:allowChoices="false"
					:allowLookups="false"
					:allowOrders="true"
					:builderLanguage="builderLanguage"
					:filtersDisable="filtersDisable"
					:modelValue="query"
					:moduleId="module.id"
					:readonly
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
						:builderLanguage
						:filtersDisable="filtersDisable"
						:joinsParents="[query.joins]"
						:moduleId="module.id"
						:readonly
					/>
					<my-builder-column-options
						@set="(...args) => columnSet(args[0],args[1])"
						:builderLanguage
						:column="columnShow"
						:hasCaptions="true"
						:moduleId="module.id"
						:onlyData="true"
						:readonly
					/>
				</template>
			</div>
			
			<!-- collection properties -->
			<div class="content no-padding" v-if="tabTarget === 'properties'">
				<table class="generic-table-vertical default-inputs">
					<tbody>
						<tr>
							<td>{{ capGen.name }}</td>
							<td><input v-model="collection.name" :disabled="readonly" /></td>
						</tr>
						<tr>
							<td>{{ capGen.icon }}</td>
							<td>
								<my-builder-icon-input
									@input="collection.iconId = $event"
									:iconIdSelected="collection.iconId"
									:module
									:title="capGen.icon"
									:readonly
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
									v-for="(c,i) in collection.inHeader"
									@remove="collectionRemove(i)"
									@update:consumer="collectionSet(i,$event)"
									:allowFormOpen="true"
									:allowRemove="true"
									:consumer="c"
									:fixedCollection="true"
									:flagsEnable="['noDisplayEmpty','showRowCount']"
									:module
									:readonly
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
			collection:false,  // collection being edited in this component
			collectionCopy:{}, // copy of collection from schema when component last reset

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
		collectionRows:s => {
			const col = s.$store.getters.collectionIdMap[s.collection.id];
			if(col === undefined)
				return [];
			
			let out = [];
			for(const r of col) {
				out.push(r.values);
			}
			return out;
		},
		columnShow:s => {
			if(s.columnIdShow === null) return false;
			
			for(let i = 0, j = s.collection.columns.length; i < j; i++) {
				if(s.collection.columns[i].id === s.columnIdShow)
					return s.collection.columns[i];
			}
			return false;
		},
		
		// simple
		collectionSchema:s => s.collectionIdMap[s.id] === undefined ? false : s.collectionIdMap[s.id],
		hasChanges:      s => !s.deepIsEqual(s.collection,s.collectionSchema),
		module:          s => s.moduleIdMap[s.collection.moduleId],
		query:           s => s.collection.query !== null ? s.collection.query : s.getTemplateQuery(),
		
		// stores
		moduleIdMap:    s => s.$store.getters['schema/moduleIdMap'],
		attributeIdMap: s => s.$store.getters['schema/attributeIdMap'],
		collectionIdMap:s => s.$store.getters['schema/collectionIdMap'],
		capApp:         s => s.$store.getters.captions.builder.collection,
		capGen:         s => s.$store.getters.captions.generic
	},
	watch:{
		collectionSchema:{
			handler() { this.reset(false); },
			immediate:true
		}
	},
	methods:{
		// externals
		copyValueDialog,
		deepIsEqual,
		dialogDeleteAsk,
		getItemTitleColumn,
		getTemplateCollectionConsumer,
		getTemplateQuery,
		
		// actions
		collectionAdd() {
			let v = JSON.parse(JSON.stringify(this.collection.inHeader));
			let c = this.getTemplateCollectionConsumer();
			c.collectionId = this.collection.id;
			v.push(c);
			this.collection.inHeader = v;
		},
		collectionRemove(i) {
			this.collection.inHeader.splice(i,1);
		},
		collectionSet(i,value) {
			this.collection.inHeader[i] = value;
		},
		columnSet(name,value) {
			this.columnShow[name] = value;
		},
		removeIndex(index) {
			for(let i = 0, j = this.collection.columns.length; i < j; i++) {
				if(!this.collection.columns[i].subQuery && this.collection.columns[i].index === index) {
					this.collection.columns.splice(i,1);
					i--; j--;
				}
			}
		},
		reset(manuelReset) {
			if(this.collectionSchema !== false && (manuelReset || !this.deepIsEqual(this.collectionCopy,this.collectionSchema))) {
				this.collection     = JSON.parse(JSON.stringify(this.collectionSchema));
				this.collectionCopy = JSON.parse(JSON.stringify(this.collectionSchema));

				this.columnIdShow = null;
			}
		},
		toggleColumnOptions(id) {
			this.columnIdShow = this.columnIdShow === id ? null : id;
			
			if(this.columnIdShow !== null)
				this.tabTarget = 'content';
		},
		
		// backend calls
		del() {
			ws.send('collection','del',this.collection.id,true).then(
				() => {
					this.$root.schemaReload(this.module.id);
					this.$router.push('/builder/collections/'+this.collection.moduleId);
				},
				this.$root.genericError
			);
		},
		set() {
			ws.sendMultiple([
				ws.prepare('collection','set',this.collection),
				ws.prepare('schema','check',{moduleId:this.module.id})
			],true).then(
				() => this.$root.schemaReload(this.module.id),
				this.$root.genericError
			);
		}
	}
};