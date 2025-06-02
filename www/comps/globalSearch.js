
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
			@record-count-change="resultCountUpdate"
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
				this.resultCount = 0;
				this.ready       = false;
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
		capGen:(s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getCaption,
		getColumnsProcessed,
		getQueryFiltersProcessed,
		getJoinIndexMap,
		srcBase64Icon,

		// data
		resultCountUpdate(count) {
			this.resultCount = count;
			this.$emit('result-count-update',count);
		},

		// actions
		setOption(name,value) {
			this.options[name] = value;
		}
	}
};

const MyGlobalSearchModule = {
	name:'my-global-search-module',
	components:{ MyGlobalSearchModuleSearchBar },
	template:`<div class="global-search-module column">
		<div class="global-search-module-title row gap centered clickable" @click="$emit('toggle',module.id)">
			<div class="row gap">
				<my-label
					:darkBg="true"
					:image="disabled ? 'checkBox0.png' : 'checkBox1.png'"
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
				:image="active && anyRunning ? 'load.gif' : ''"
				:large="true"
			/>
		</div>
		<div class="global-search-bars column gap" v-if="active">
			<my-global-search-module-search-bar
				@result-count-update="resultCountUpdate(b.id,$event)"
				v-for="b in searchBars"
				:input="input"
				:limit="limit"
				:searchBar="b"
				:showHeader="showHeader"
			/>
		</div>
	</div>`,
	emits:['result-count-update','toggle'],
	props:{
		disabled:  { type:Boolean, required:true },
		input:     { type:String,  required:true },
		limit:     { type:Number,  required:true },
		module:    { type:Object,  required:true },
		showHeader:{ type:Boolean, required:true }
	},
	watch:{
		input() {
			this.searchBarIdMapResultCount = {};
		}
	},
	data() {
		return {
			searchBarIdMapResultCount:{}
		};
	},
	computed:{
		anyRunning:(s) => {
			for(const b of s.searchBars) {
				if(s.searchBarIdMapResultCount[b.id] === undefined)
					return true;
			}
			return false;
		},
		resultCount:(s) => {
			let cnt = 0;
			for(const k in s.searchBarIdMapResultCount) {
				cnt += s.searchBarIdMapResultCount[k];
			}
			return cnt;
		},
		resultLabel:(s) => {
			if(s.disabled)   return s.capGen.disabled;
			if(!s.active)    return '-';
			if(s.anyRunning) return s.capGen.searchRunning;
			return s.capGen.results.replace('{CNT}',s.resultCount);
		},

		// simple
		active:    (s) => s.input !== '' && !s.disabled,
		searchBars:(s) => s.module.searchBars.filter(v => s.access[v.id] !== undefined && s.access[v.id] === 1),

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
			this.$nextTick(() => this.$emit('result-count-update',this.resultCount));
		}
	}
};

const MyGlobalSearch = {
	name:'my-global-search',
	components:{ MyGlobalSearchModule },
	template:`<div class="app-sub-window"
		@mousedown.self="$emit('close')"
		:class="{ 'under-header':!isMobile }"
	>
		<div class="contentBox global-search grow scroll float" :class="{ larger }">
			<div class="top lower">
				<div class="area">
					<my-label
						:caption="statusLabel"
						:image="statusImage"
						:large="true"
					/>
				</div>
				<div class="area">
					<my-button
						v-if="!isMobile"
						@trigger="larger = !larger"
						:image="larger ? 'shrink.png' : 'expand.png'"
					/>
					<my-button image="cancel.png"
						@trigger="$emit('close')"
						:cancel="true"
						:caption="capGen.button.close"
					/>
				</div>
			</div>
			<div class="content column no-shrink">
				<div class="global-search-input-line default-inputs row wrap gap centered">
					<div class="global-search-input-line-main row gap">
						<input class="dynamic"
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
			</div>
			<div class="content column grow no-padding" :style="patternStyle">
				<div class="global-search-modules column gap">
					<my-global-search-module
						@result-count-update="resultCountUpdate(m.id,$event)"
						@toggle="toggle"
						v-for="m in globalSearchModules"
						:disabled="moduleIdsDisabled.includes(m.id)"
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
			larger:false,
			limit:5,
			moduleIdMapResultCount:{}, // result count per module ID
			moduleIdsDisabled:[],      // module IDs disabled for global search
			showHeader:true
		};
	},
	emits:['close'],
	computed:{
		anySearchRunning:(s) => {
			for(const m of s.globalSearchModules) {
				if(!s.moduleIdsDisabled.includes(m.id) && s.moduleIdMapResultCount[m.id] === undefined)
					return true;
			}
			return false;
		},
		resultCount:(s) => {
			let cnt = 0;
			for(const k in s.moduleIdMapResultCount) {
				if(!s.moduleIdsDisabled.includes(k))
					cnt += s.moduleIdMapResultCount[k];
			}
			return cnt;
		},

		// status message
		statusImage:(s) => {
			if(s.empty)            return 'search.png';
			if(s.anySearchRunning) return 'load.gif';
			return 'ok.png';
		},
		statusLabel:(s) => {
			if(s.empty)            return s.capGen.globalSearch;
			if(s.anySearchRunning) return s.capGen.searchRunning;
			return s.capGen.results.replace('{CNT}',s.resultCount);
		},

		// simple
		empty:              (s) => s.inputActive === '',
		globalSearchModules:(s) => s.$store.getters.globalSearchModules,
		
		// stores
		capApp:      (s) => s.$store.getters.captions.globalSearch,
		capGen:      (s) => s.$store.getters.captions.generic,
		isMobile:    (s) => s.$store.getters.isMobile,
		patternStyle:(s) => s.$store.getters.patternStyle
	},
	mounted() {
		window.addEventListener('keydown',this.handleHotkeys);
	},
	unmounted() {
		window.removeEventListener('keydown',this.handleHotkeys);
	},
	methods:{
		resultCountUpdate(id,v) {
			this.moduleIdMapResultCount[id] = v;
		},
		
		// general
		handleHotkeys(e) {
			if(e.key === 'Escape') {
				this.$emit('close');
				e.preventDefault();
			}
		},

		// actions
		submit() {
			if(this.inputActive !== this.input) {
				this.inputActive            = this.input;
				this.moduleIdMapResultCount = {};
			}
		},
		toggle(id) {
			const pos = this.moduleIdsDisabled.indexOf(id);
			if(pos === -1)
				return this.moduleIdsDisabled.push(id);

			this.moduleIdsDisabled.splice(pos,1);
		}
	}
};