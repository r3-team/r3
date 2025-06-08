
import {getColumnsProcessed} from './shared/column.js';
import srcBase64Icon         from './shared/image.js';
import MyForm                from './form.js';
import MyInputDictionary     from './inputDictionary.js';
import MyList                from './list.js';
import {
	getFormPopUpConfig,
	getFormRoute
}  from './shared/form.js';
import {
	colorAdjustBg,
	openLink
} from './shared/generic.js';
import {
	getCaption,
	getDictByLang
} from './shared/language.js';
import {
	getIsOperatorInAnyFilter,
	getQueryFiltersProcessed,
	getJoinIndexMap
} from './shared/query.js';
export {MyGlobalSearch as default};

const MyGlobalSearchModuleSearchBar = {
	name:'my-global-search-module-search-bar',
	components: { MyList },
	template:`<div class="global-search-bar" v-show="resultCount !== 0">
		<my-list
			@open-form="openForm"
			@record-count-change="resultCountUpdate"
			@set-login-option="setListOption"
			:blockDuringLoad="false"
			:columns="columnsProcessed"
			:columnsAll="columns"
			:columnsSortOnly="true"
			:dataOptions="dataOptions"
			:filters="filtersProcessed"
			:filterQuick="true"
			:formLoading="!ready"
			:hasOpenForm="searchBar.openForm !== null"
			:headerActions="false"
			:headerColumns="options.showHeader"
			:isDynamicSize="true"
			:isSingleField="true"
			:limitDefault="limit"
			:loginOptions="listOptions"
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
	emits:['close','pop-up-open','result-count-update'],
	props:{
		input:    { type:String, required:true },
		limit:    { type:Number, required:true },
		searchBar:{ type:Object, required:true }
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
			listOptions:{},
			resultCount:0,
			ready:false
		}
	},
	computed:{
		// simple
		columns:         (s) => s.searchBar.columns,
		columnsProcessed:(s) => s.getColumnsProcessed(s.columns,[],s.joinIndexMap,s.input,s.options.dictionary),
		dataOptions:     (s) => s.searchBar.openForm !== null ? 2 : -1,
		query:           (s) => s.searchBar.query,
		filters:         (s) => s.query.filters,
		filtersProcessed:(s) => s.getQueryFiltersProcessed(s.filters,s.joinIndexMap,s.input,s.options.dictionary),
		joinIndexMap:    (s) => s.getJoinIndexMap(s.query.joins),

		// stores
		capGen: (s) => s.$store.getters.captions.generic,
		options:(s) => s.$store.getters['local/globalSearchOptions']
	},
	methods:{
		// externals
		getCaption,
		getColumnsProcessed,
		getFormPopUpConfig,
		getFormRoute,
		getQueryFiltersProcessed,
		getJoinIndexMap,
		openLink,
		srcBase64Icon,

		// data
		resultCountUpdate(count) {
			this.resultCount = count;
			this.$emit('result-count-update',count);
		},

		// actions
		openForm(rows,newTab) {
			const openForm = this.searchBar.openForm;
			let recordIds = [];
			for(const r of rows) {
				const id = r.indexRecordIds[openForm.relationIndexOpen];
				
				if(id !== undefined && id !== null)
					recordIds.push(id);
			}

			// open pop-up form unless new tab is requested
			if(this.options.openAsPopUp && !newTab)
				return this.$emit('pop-up-open',this.getFormPopUpConfig(recordIds,openForm,[],null));

			// full form navigation, only single record allowed as target
			const recordIdOpen = recordIds.length === 1 ? recordIds[0] : 0;
			const path = this.getFormRoute(null,openForm.formIdOpen,recordIdOpen,true,[]);

			if(newTab)
				return this.openLink('#'+path,true);

			this.$router.push(path);
			this.$emit('close');
		},
		setListOption(name,value) {
			this.listOptions[name] = value;
		}
	}
};

const MyGlobalSearchModule = {
	name:'my-global-search-module',
	components:{ MyGlobalSearchModuleSearchBar },
	template:`<div class="global-search-module column">
		<div class="global-search-module-title row gap centered clickable" @click="$emit('toggle',module.id)" :class="{ disabled }">
			<div class="row gap">
				<my-button
					:darkBg="!disabled"
					:image="disabled ? 'checkBox0.png' : 'checkBox1.png'"
					:naked="true"
				/>
				<my-label
					:caption="getCaption('moduleTitle',module.id,module.id,module.captions,module.name)"
					:darkBg="!disabled"
					:imageBase64="srcBase64Icon(module.iconId,'images/module.png')"
					:large="true"
				/>
			</div>
			<my-button image="languages.png"
				v-if="anyFtsOperator"
				@trigger="showFtsHelp"
				:blockBubble="true"
				:caption="isMobile ? '' : capApp.button.fullTextSearch"
				:darkBg="!disabled"
				:naked="true"
			/>
			<div class="row gap centered">
				<my-label
					:caption="resultLabel"
					:darkBg="!disabled"
					:image="active && anyRunning ? 'load.gif' : ''"
					:large="true"
				/>
				<my-button image="builder.png"
					v-if="isAdmin && builderEnabled && !isMobile"
					@trigger="openBuilder(false)"
					@trigger-middle="openBuilder(true)"
					:blockBubble="true"
					:captionTitle="capGen.button.openBuilder"
					:darkBg="!disabled"
					:naked="true"
				/>
				<div class="global-search-module-title-result" :style="bobbleStyle"></div>
			</div>
		</div>
		<div class="global-search-bars column gap" v-if="active">
			<my-global-search-module-search-bar
				@close="$emit('close')"
				@pop-up-open="$emit('pop-up-open',$event)"
				@result-count-update="resultCountUpdate(b.id,$event)"
				v-for="b in searchBars"
				:input="input"
				:limit="limit"
				:searchBar="b"
			/>
		</div>
	</div>`,
	emits:['close','pop-up-open','result-count-update','toggle'],
	props:{
		disabled:{ type:Boolean, required:false, default:false },
		input:   { type:String,  required:false, default:'' },
		limit:   { type:Number,  required:false, default:10 },
		module:  { type:Object,  required:true }
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
		anyFtsOperator:(s) => {
			for(const b of s.module.searchBars) {
				if(s.getIsOperatorInAnyFilter(b.query.filters,b.columns,'@@'))
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
		active:     (s) => s.input !== '' && !s.disabled,
		bobbleStyle:(s) => s.module.color1 !== null ? `border-bottom-color:${s.colorAdjustBg(s.module.color1)}` : '',
		searchBars: (s) => s.module.searchBars.filter(v => s.access[v.id] !== undefined && s.access[v.id] === 1),

		// stores
		builderEnabled:(s) => s.$store.getters.builderEnabled,
		access:        (s) => s.$store.getters.access.searchBar,
		capApp:        (s) => s.$store.getters.captions.globalSearch,
		capAppFilter:  (s) => s.$store.getters.captions.filter,
		capGen:        (s) => s.$store.getters.captions.generic,
		isAdmin:       (s) => s.$store.getters.isAdmin,
		isMobile:      (s) => s.$store.getters.isMobile
	},
	methods:{
		// externals
		colorAdjustBg,
		getCaption,
		getIsOperatorInAnyFilter,
		srcBase64Icon,

		// data
		resultCountUpdate(searchBarId,count) {
			this.searchBarIdMapResultCount[searchBarId] = count;
			this.$nextTick(() => this.$emit('result-count-update',this.resultCount));
		},

		// actions
		openBuilder(middle) {
			if(middle)
				return window.open('#/builder/search-bars/'+this.module.id,'_blank');
			
			this.$router.push('/builder/search-bars/'+this.module.id);
			this.$emit('close');
		},
		showFtsHelp() {
			this.$store.commit('dialog',{
				captionTop:this.capGen.contextHelp,
				captionBody:this.capAppFilter.dialog.ftsHelp,
				image:'languages.png',
				width:1000
			});
		}
	}
};

const MyGlobalSearch = {
	name:'my-global-search',
	components:{ MyForm, MyGlobalSearchModule, MyInputDictionary },
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

				<!-- pop-up form -->
				<div class="app-sub-window under-header"
					v-if="popUp !== null"
					@mousedown.left.self="$refs.popUpForm.closeAsk()"
				>
					<my-form ref="popUpForm"
						@close="popUp = null"
						@records-open="popUp.recordIds = $event"
						:formId="popUp.formId"
						:isPopUp="true"
						:isPopUpFloating="true"
						:moduleId="popUp.moduleId"
						:recordIds="popUp.recordIds"
						:style="popUp.style"
					/>
				</div>

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
					<div class="row wrap gap-large">
						<my-button-check
							@update:modelValue="setOption('openAsPopUp',$event)"
							:caption="capApp.button.openAsPopUp"
							:modelValue="options.openAsPopUp"
						/>
						<my-button-check
							@update:modelValue="setOption('showHeader',$event)"
							:caption="capApp.button.showHeader"
							:modelValue="options.showHeader"
						/>
						<div class="row gap">
							<my-button image="languages.png"
								@trigger="resetDict"
								:captionTitle="capApp.button.dictReset"
								:naked="true"
							/>
							<my-input-dictionary
								@update:modelValue="setOption('dictionary',$event)"
								:title="capApp.searchDictionaryHint"
								:modelValue="options.dictionary"
							/>
							<my-button image="question.png"
								@trigger="showFtsHelp"
							/>
						</div>
					</div>
				</div>
			</div>
			<div class="content column grow no-padding global-search-results" :style="patternStyle">
				<div class="global-search-modules column gap">
					<my-global-search-module
						@close="$emit('close')"
						@pop-up-open="popUp = $event"
						@result-count-update="resultCountUpdate(m.id,$event)"
						@toggle="toggle"
						v-for="m in modulesActive"
						:input="inputActive"
						:key="m.id"
						:limit="limit"
						:module="m"
					/>
					<my-label class="global-search-header" image="search.png"
						v-if="modulesInactive.length !== 0"
						:caption="capApp.modulesInactive"
						:large="true"
					/>
					<my-global-search-module
						@toggle="toggle"
						v-for="m in modulesInactive"
						:disabled="true"
						:key="m.id"
						:module="m"
					/>
				</div>
			</div>
		</div>
	</div>`,
	props:{
		inputStart:{ type:String, required:true}
	},
	data() {
		return {
			inputActive:'', // submitted input
			input:'',       // input text from input element
			larger:false,
			limit:5,
			moduleIdMapResultCount:{}, // result count per module ID
			moduleIdsActive:[],
			popUp:null
		};
	},
	emits:['close'],
	computed:{
		anySearchRunning:(s) => {
			for(const m of s.modulesActive) {
				if(s.moduleIdMapResultCount[m.id] === undefined)
					return true;
			}
			return false;
		},
		modulesActive:(s) => {
			let out = [];
			for(const id of s.moduleIdsActive) {
				out.push(s.moduleIdMap[id]);
			}
			return out;
		},
		modulesInactive:(s) => {
			let out = [];
			for(const id of s.modulesIdsInactive) {
				out.push(s.moduleIdMap[id]);
			}
			return out;
		},
		resultCount:(s) => {
			let cnt = 0;
			for(const k in s.moduleIdMapResultCount) {
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
		empty:             (s) => s.inputActive === '',
		modulesIdsInactive:(s) => s.searchModuleIds.filter(v => !s.moduleIdsActive.includes(v)),
		
		// stores
		moduleIdMap:    (s) => s.$store.getters['schema/moduleIdMap'],
		options:        (s) => s.$store.getters['local/globalSearchOptions'],
		capApp:         (s) => s.$store.getters.captions.globalSearch,
		capGen:         (s) => s.$store.getters.captions.generic,
		isMobile:       (s) => s.$store.getters.isMobile,
		moduleIdLast:   (s) => s.$store.getters.moduleIdLast,
		patternStyle:   (s) => s.$store.getters.patternStyle,
		searchModuleIds:(s) => s.$store.getters.searchModuleIds
	},
	mounted() {
		window.addEventListener('keydown',this.handleHotkeys);

		if(this.options.dictionary === null)
			this.resetDict();

		this.moduleIdsActive = this.moduleIdLast !== null && this.searchModuleIds.includes(this.moduleIdLast)
			? [this.moduleIdLast] : JSON.parse(JSON.stringify(this.searchModuleIds));

		this.input = this.inputStart;
		this.submit();
	},
	unmounted() {
		window.removeEventListener('keydown',this.handleHotkeys);
	},
	methods:{
		// externals
		getDictByLang,
		
		// general
		handleHotkeys(e) {
			if(e.key === 'Escape') {
				if(this.popUp === null) {
					this.$emit('close');
					e.preventDefault();
				}
			}
		},
		resultCountUpdate(id,v) {
			this.moduleIdMapResultCount[id] = v;
		},

		// actions
		resetDict() {
			this.setOption('dictionary',this.getDictByLang());
		},
		setOption(name,value) {
			let o = JSON.parse(JSON.stringify(this.options));
			o[name] = value;
			this.$store.commit('local/globalSearchOptions',o);
		},
		showFtsHelp() {
			this.$store.commit('dialog',{
				captionTop:this.capApp.help.ftsDictTitle,
				captionBody:`<p>${this.capApp.help.ftsDict.join('</p><p>')}</p>`,
				image:'languages.png'
			});
		},
		submit() {
			if(this.inputActive !== this.input) {
				this.inputActive            = this.input;
				this.moduleIdMapResultCount = {};
			}
		},
		toggle(id) {
			const p = this.moduleIdsActive.indexOf(id);
			if(p === -1)
				return this.moduleIdsActive.push(id);

			this.moduleIdsActive.splice(p,1);
			delete this.moduleIdMapResultCount[id];
		}
	}
};