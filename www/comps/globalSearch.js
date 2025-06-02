
import {getColumnsProcessed} from './shared/column.js';
import srcBase64Icon         from './shared/image.js';
import {getCaption}          from './shared/language.js';
import MyList                from './list.js';
import {
	getQueryFiltersProcessed,
	getJoinIndexMap
} from './shared/query.js';
export {MyGlobalSearch as default};

const MyGlobalSearchModuleSearchBar = {
	name:'my-global-search-module-search-bar',
	components: { MyList },
	template:`<div class="global-search-bar" v-show="resultCount !== 0">
		<my-list
			@open-form=""
			@record-count-change="resultCount = $event;$emit('result-count-update',$event)"
			@set-login-option="setOption"
			:columns="columnsProcessed"
			:columnsAll="columns"
			:columnsSortOnly="true"
			:dataOptions="dataOptions"
			:filters="filtersProcessed"
			:filterQuick="true"
			:formLoading="!ready"
			:hasOpenForm="searchBar.openForm !== null"
			:headerActions="false"
			:headerColumns="showHeader"
			:isDynamicSize="true"
			:isSingleField="true"
			:limitDefault="limit"
			:loginOptions="options"
			:moduleId="searchBar.moduleId"
			:query="query"
		>
			<template #input-icon>
				<my-label
					:caption="getCaption('searchBarTitle',searchBar.moduleId,searchBar.id,searchBar.captions,searchBar.name)"
					:imageBase64="srcBase64Icon(searchBar.iconId,'')"
				/>
			</template>
		</my-list>
	</div>`,
	emits:['result-count-update'],
	props:{
		input:     { type:String,  required:true },
		limit:     { type:Number,  required:true },
		searchBar: { type:Object,  required:true },
		showHeader:{ type:Boolean, required:true }
	},
	watch:{
		input:{
			handler() {
				this.ready = false;
				this.$nextTick(() => this.ready = true);
			},
			immediate:true
		}
	},
	data() {
		return {
			options:{},
			resultCount:0,
			ready:false
		}
	},
	computed:{
		// simple
		columns:         (s) => s.searchBar.columns,
		columnsProcessed:(s) => s.getColumnsProcessed(s.columns,[],s.joinIndexMap,s.input),
		dataOptions:     (s) => s.searchBar.openForm !== null ? 2 : -1,
		query:           (s) => s.searchBar.query,
		filters:         (s) => s.query.filters,
		filtersProcessed:(s) => s.getQueryFiltersProcessed(s.filters,s.joinIndexMap,s.input),
		joinIndexMap:    (s) => s.getJoinIndexMap(s.query.joins),

		// stores
		capApp:(s) => s.$store.getters.captions.searchBar,
		capGen:(s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getCaption,
		getColumnsProcessed,
		getQueryFiltersProcessed,
		getJoinIndexMap,
		srcBase64Icon,

		// actions
		setOption(name,value) {
			this.options[name] = value;
		}
	}
};

const MyGlobalSearchModule = {
	name:'my-global-search-module',
	components:{ MyGlobalSearchModuleSearchBar },
	template:`<div class="global-search-module column clickable">
		<div class="global-search-module-title row gap centered" @click="toggle">
			<div class="row gap">
				<my-label
					:darkBg="true"
					:image="!moduleIdsDisabled.includes(module.id) ? 'checkBox1.png' : 'checkBox0.png'"
					:large="true"
				/>
				<my-label
					:caption="getCaption('moduleTitle',module.id,module.id,module.captions,module.name)"
					:darkBg="true"
					:imageBase64="srcBase64Icon(module.iconId,'images/module.png')"
					:large="true"
				/>
			</div>
			<my-label
				:caption="resultLabel"
				:darkBg="true"
				:large="true"
			/>
		</div>
		<div class="global-search-bars column gap" v-if="active">
			<my-global-search-module-search-bar
				@result-count-update="resultCountUpdate(b.id,$event)"
				v-for="b in module.searchBars.filter(v => access[v.id] !== undefined && access[v.id] === 1)"
				:input="input"
				:limit="limit"
				:searchBar="b"
				:showHeader="showHeader"
			/>
		</div>
	</div>`,
	props:{
		input:     { type:String,  required:true },
		limit:     { type:Number,  required:true },
		module:    { type:Object,  required:true },
		showHeader:{ type:Boolean, required:true }
	},
	data() {
		return {
			moduleIdsDisabled:[], // TEMP: MOCKUP
			searchBarIdMapResultCount:{}
		};
	},
	computed:{
		resultCount:(s) => {
			let cnt = 0;
			for(const k in s.searchBarIdMapResultCount) {
				cnt += s.searchBarIdMapResultCount[k];
			}
			return cnt;
		},
		resultLabel:(s) => {
			if(s.disabled) return s.capGen.disabled;
			if(!s.active)  return '-';
			return s.capGen.results.replace('{CNT}',s.resultCount);
		},

		// simple
		active:  (s) => s.input !== '' && !s.disabled,
		disabled:(s) => s.moduleIdsDisabled.includes(s.module.id),

		// stores
		access:(s) => s.$store.getters.access.searchBar,
		capGen:(s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getCaption,
		srcBase64Icon,

		// data
		resultCountUpdate(searchBarId,count) {
			this.searchBarIdMapResultCount[searchBarId] = count;
		},
		
		// actions
		toggle() {
			const pos = this.moduleIdsDisabled.indexOf(this.module.id);
			if(pos === -1) this.moduleIdsDisabled.push(this.module.id);
			else           this.moduleIdsDisabled.splice(pos,1);
		}
	}
};

const MyGlobalSearch = {
	name:'my-global-search',
	components:{ MyGlobalSearchModule },
	template:`<div class="app-sub-window under-header"
		@mousedown.self="$emit('close')"
	>
		<div class="contentBox global-search grow scroll float">
			<div class="top lower">
				<div class="area">
					<img class="icon" src="images/search.png" />
					<h1>{{ capGen.globalSearch }}</h1>
				</div>
				<div class="area">
					<my-button image="cancel.png"
						@trigger="$emit('close')"
						:cancel="true"
						:caption="capGen.button.close"
					/>
				</div>
			</div>
			<div class="content flex column grow">
				<div class="global-search-input-line default-inputs row gap centered">
					<div class="row gap">
						<input class="long"
							v-model="input"
							v-focus
							@keyup.enter="submit"
							:placeholder="capGen.threeDots"
						/>
						<my-button image="ok.png"
							@trigger="submit"
							:active="input !== inputActive"
							:caption="capGen.button.ok"
						/>
						<my-button image="cancel.png"
							@trigger="input = ''; submit()"
							:active="inputActive !== ''"
							:caption="capGen.button.clear"
							:cancel="true"
						/>
					</div>
					<div class="row gap">
						<my-button-check
							v-model="showHeader"
							:caption="capApp.button.showHeader"
						/>
					</div>
				</div>
				<h2>{{ capGen.searchResults }}</h2>
				<div class="global-search-modules column gap">
					<my-global-search-module
						v-for="m in globalSearchModules"
						:input="inputActive"
						:key="m.id"
						:limit="limit"
						:module="m"
						:showHeader="showHeader"
					/>
				</div>
			</div>
		</div>
	</div>`,
	data() {
		return {
			inputActive:'', // submitted input
			input:'',       // input text from input element
			limit:5,
			showHeader:true
		};
	},
	emits:['close'],
	computed:{
		// simple
		globalSearchModules:(s) => s.$store.getters.globalSearchModules,
		
		// stores
		capApp:(s) => s.$store.getters.captions.globalSearch,
		capGen:(s) => s.$store.getters.captions.generic
	},
	methods:{
		submit() {
			this.inputActive = this.input;
		}
	}
};