import MyBuilderCaption       from './builderCaption.js';
import MyBuilderColumnOptions from './builderColumnOptions.js';
import MyBuilderIconInput     from './builderIconInput.js';
import MyBuilderOpenForm      from './builderOpenForm.js';
import MyBuilderQuery         from './builderQuery.js';
import {getTemplateQuery}     from '../shared/builderTemplate.js';
import {dialogDeleteAsk}      from '../shared/dialog.js';
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
	deepIsEqual
} from '../shared/generic.js';
import {
	getIsContentInAnyFilter,
	getJoinsIndexMap
} from '../shared/query.js';

export default {
	name:'my-builder-search-bar',
	components:{
		MyBuilderCaption,
		MyBuilderColumnOptions,
		MyBuilderColumns,
		MyBuilderColumnTemplates,
		MyBuilderIconInput,
		MyBuilderOpenForm,
		MyBuilderQuery
	},
	template:`<div class="builder-search-bar" v-if="searchBar">
		<div class="contentBox grow">
			<div class="top">
				<div class="area nowrap">
					<img class="icon" src="images/tray.png" />
					<h1 class="title">
						{{ capApp.titleOne.replace('{NAME}',searchBar.name) }}
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
				</div>
				<div class="area nowrap">
					<my-button image="visible1.png"
						@trigger="copyValueDialog(searchBar.name,id,id)"
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
				
				<div class="builder-search-bar-columns">
				
					<!-- query columns -->
					<div class="builder-search-bar-columns-active">
						<h2>{{ capGen.columnsActive }}</h2>
						<my-builder-columns groupName="columns"
							@columns-set="searchBar.columns = $event"
							@column-id-show="toggleColumnOptions($event)"
							:builderLanguage
							:columnIdShow
							:columns="searchBar.columns"
							:hasCaptions="true"
							:readonly
						/>
					</div>
					
					<div class="builder-search-bar-columns-available">
						<h2>{{ capGen.columnsAvailable }}</h2>
						<div class="builder-search-bar-column-templates">
							<my-builder-column-templates groupName="batches_columns"
								@column-add="searchBar.columns.push($event)"
								:columns="searchBar.columns"
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
			
			<!-- content -->
			<div class="content grow" v-if="tabTarget === 'content'">
				<my-builder-query
					@index-removed="removeIndex($event)"
					@update:modelValue="searchBar.query = $event"
					:allowChoices="false"
					:allowLookups="false"
					:allowOrders="true"
					:builderLanguage
					:filtersDisable
					:modelValue="query"
					:moduleId="module.id"
					:readonly
				/>

				<!-- SQL preview -->
				<div class="row">
					<my-button image="code.png"
						@trigger="getSqlPreview(query,searchBar.columns)"
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
						v-model="columnShow.query"
						:allowChoices="false"
						:allowOrders="true"
						:builderLanguage
						:filtersDisable
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
						:onlyData="false"
						:readonly
					/>
				</template>
			</div>
			
			<!-- properties -->
			<div class="content no-padding" v-if="tabTarget === 'properties'">
				<table class="generic-table-vertical default-inputs">
					<tbody>
						<tr>
							<td>{{ capGen.name }}</td>
							<td><input v-model="searchBar.name" :disabled="readonly" /></td>
						</tr>
						<tr>
							<td>{{ capGen.title }}</td>
							<td>
								<div class="row gap centered">
									<my-builder-caption
										v-model="searchBar.captions.searchBarTitle"
										:dynamicSize="true"
										:language="builderLanguage"
										:readonly
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
									@input="searchBar.iconId = $event"
									:iconIdSelected="searchBar.iconId"
									:module
									:title="capGen.icon"
									:readonly
								/>
							</td>
						</tr>
						<tr>
							<td>{{ capGen.formOpen }}</td>
							<td>
								<my-builder-open-form
									v-model="searchBar.openForm"
									:allowAllForms="false"
									:joinsIndexMapField="joinIndexMap"
									:module
									:readonly
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
			searchBar:false,
			searchBarCopy:{},
			
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
		columnShow:s => {
			if(s.columnIdShow === null) return false;
			
			for(let i = 0, j = s.searchBar.columns.length; i < j; i++) {
				if(s.searchBar.columns[i].id === s.columnIdShow)
					return s.searchBar.columns[i];
			}
			return false;
		},
		
		// simple
		anySearchInput: s => s.getIsContentInAnyFilter(s.query.filters,s.searchBar.columns,'globalSearch'),
		hasChanges:     s => !s.deepIsEqual(s.searchBar,s.searchBarSchema),
		joinIndexMap:   s => s.getJoinsIndexMap(s.query.joins),
		module:         s => s.moduleIdMap[s.searchBar.moduleId],
		query:          s => s.searchBar.query !== null ? s.searchBar.query : s.getTemplateQuery(),
		searchBarSchema:s => s.searchBarIdMap[s.id] === undefined ? false : s.searchBarIdMap[s.id],
		
		// stores
		moduleIdMap:    s => s.$store.getters['schema/moduleIdMap'],
		searchBarIdMap: s => s.$store.getters['schema/searchBarIdMap'],
		capApp:         s => s.$store.getters.captions.builder.searchBar,
		capGen:         s => s.$store.getters.captions.generic
	},
	watch:{
		searchBarSchema:{
			handler() { this.reset(false); },
			immediate:true
		}
	},
	methods:{
		// externals
		copyValueDialog,
		deepIsEqual,
		dialogDeleteAsk,
		getIsContentInAnyFilter,
		getItemTitleColumn,
		getJoinsIndexMap,
		getSqlPreview,
		getTemplateQuery,
		
		// actions
		columnSet(name,value) {
			this.columnShow[name] = value;
		},
		removeIndex(index) {
			for(let i = 0, j = this.searchBar.columns.length; i < j; i++) {
				if(!this.searchBar.columns[i].subQuery && this.searchBar.columns[i].index === index) {
					this.searchBar.columns.splice(i,1);
					i--; j--;
				}
			}
		},
		reset(manuelReset) {
			if(this.searchBarSchema !== false && (manuelReset || !this.deepIsEqual(this.searchBarCopy,this.searchBarSchema))) {
				this.searchBar     = JSON.parse(JSON.stringify(this.searchBarSchema));
				this.searchBarCopy = JSON.parse(JSON.stringify(this.searchBarSchema));
				this.columnIdShow  = null;
			}
		},
		toggleColumnOptions(id) {
			this.columnIdShow = this.columnIdShow === id ? null : id;
			
			if(this.columnIdShow !== null)
				this.tabTarget = 'content';
		},
		
		// backend calls
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
				ws.prepare('searchBar','set',this.searchBar),
				ws.prepare('schema','check',{moduleId:this.module.id})
			],true).then(
				() => this.$root.schemaReload(this.module.id),
				this.$root.genericError
			);
		}
	}
};