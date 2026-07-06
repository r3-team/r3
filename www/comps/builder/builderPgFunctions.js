import MyBuilderTagInput        from './builderTagInput.js';
import MyBuilderFilterPairInput from './builderFilterPairInput.js';
import {
	builderOptionGet,
	builderOptionSet
} from '../shared/builder.js';

export default {
	name:'my-builder-pg-functions',
	components:{ MyBuilderFilterPairInput, MyBuilderTagInput },
	template:`<div class="row grow nowrap builder-functions" v-if="module">

		<div class="contentBox grow">
			<div class="top lower">
				<div class="area nowrap">
					<img class="icon" src="images/codeDatabase.png" />
					<h1 class="title">{{ capGen.functionsBackend }}</h1>
				</div>
				<div class="area">
					<my-button image="open.png"
						@trigger="$router.push('/builder/overview/pg-functions/'+id+'/1');"
						:caption="capGen.overview"
					/>
					<my-button
						@trigger="showSidebar = !showSidebar"
						:image="showSidebar ? 'toggleRight.png' : 'toggleLeft.png'"
					/>
				</div>
			</div>
			<div class="content">
				<div class="generic-entry-list">
					<div class="entry"
						v-if="!readonly"
						@click="$emit('createNew','pgFunction')"
						:class="{ clickable:!readonly }"
					>
						<div class="row gap centered">
							<img class="icon" src="images/add.png" />
							<span>{{ capGen.button.new }}</span>
						</div>
					</div>

					<router-link class="entry clickable"
						v-for="f in module.pgFunctions.filter(v => idsShow.includes(v.id))"
						:key="f.id"
						:to="'/builder/pg-function/'+f.id"
					>
						<div class="lines">
							<span>{{ f.name }}</span>
							<span class="subtitle" v-if="typeof f.captions.pgFunctionTitle[builderLanguage] !== 'undefined'">
								[{{ f.captions.pgFunctionTitle[builderLanguage] }}]
							</span>
						</div>
						<div class="row">
							<my-button image="personArrow.png"
								v-if="f.isLoginSync"
								:active="false"
								:captionTitle="capApp.isLoginSync"
								:naked="true"
							/>
							<my-button image="databasePlay.png"
								v-if="f.isTrigger"
								:active="false"
								:captionTitle="capApp.isTrigger"
								:naked="true"
							/>
							<my-button image="screen.png"
								v-if="f.isFrontendExec"
								:active="false"
								:captionTitle="capApp.isFrontendExec"
								:naked="true"
							/>
							<my-button image="time.png"
								v-if="f.schedules.length !== 0"
								:active="false"
								:captionTitle="capApp.schedules"
								:naked="true"
							/>
						</div>
					</router-link>
				</div>
			</div>
		</div>
		<div class="contentBox builder-sidebar narrow" v-if="showSidebar">
			<div class="top lower">
				<div class="area nowrap">
					<img class="icon" src="images/filter.png" />
					<h1 class="title">{{ capGen.filters }}</h1>
				</div>
			</div>
			<div class="content default-inputs">
				<div class="column gap-large">
					<div class="column gap">
						<my-label image="editBox.png" :bold="filterText !== ''" :caption="capGen.name" />
						<input class="dynamic" v-model="filterText" :placeholder="capGen.threeDots" />
					</div>

					<div class="column gap">
						<div class="row gap centered space-between">
							<my-label image="tag.png" :bold="filterTagIds.length !== 0" :caption="capGen.tags" />
							<my-button
								@trigger="filterTagsAnd = !filterTagsAnd"
								:caption="capAppFilter.option.connector.OR"
								:image="filterTagsAnd ? 'checkbox0.png' : 'checkbox1.png'"
								:naked="true"
							/>
						</div>
						<my-builder-tag-input
							v-model="filterTagIds"
							@update:modelValue="updateFilterArgs"
							:dynamic="true"
							:module
							:readonly="false"
						/>
					</div>

					<my-builder-filter-pair-input image="screen.png"
						@update="updateFilterArgs"
						v-model:value0="filters.frontend0"
						v-model:value1="filters.frontend1"
						:caption="capApp.isFrontendExec"
					/>
					<my-builder-filter-pair-input image="files_list2.png"
						@update="updateFilterArgs"
						v-model:value0="filters.column0"
						v-model:value1="filters.column1"
						:caption="capApp.isColumnExec"
					/>
					<my-builder-filter-pair-input image="personArrow.png"
						@update="updateFilterArgs"
						v-model:value0="filters.loginsync0"
						v-model:value1="filters.loginsync1"
						:caption="capApp.isLoginSync"
					/>
				</div>
			</div>
		</div>
	</div>`,
	emits:['createNew'],
	props:{
		builderLanguage:{ type:String,  required:true },
		filter:         { type:String,  required:true },
		id:             { type:String,  required:true },
		readonly:       { type:Boolean, required:true }
	},
	data() {
		return {
			filterTagIds: [],
			filterText: '',
			filters: {
				column0: false,
				column1: false,
				frontend0: false,
				frontend1: false,
				loginsync0: false,
				loginsync1: false
			},
			showSidebar: true,
		};
	},
	computed:{
		idsShow: s => {
			const filterName = s.filterText.toLowerCase();
			let out = [];
			for (const f of s.module.pgFunctions) {
				if (
					(filterName === '' || f.name.toLowerCase().includes(filterName))
					&& (!s.filters.column0 || !f.isColumnExec)
					&& (!s.filters.column1 || f.isColumnExec)
					&& (!s.filters.frontend0 || !f.isFrontendExec)
					&& (!s.filters.frontend1 || f.isFrontendExec)
					&& (!s.filters.loginsync0 || !f.isLoginSync)
					&& (!s.filters.loginsync1 || f.isLoginSync)
					&& (s.filterTagIds.length === 0 || (
						(s.filterTagsAnd && s.filterTagIds.every(v => f.tagIds.includes(v)))
						|| (!s.filterTagsAnd && s.filterTagIds.some(v => f.tagIds.includes(v)))
					))
				) {
					out.push(f.id);
				}
			}
			return out;
		},

		// inputs
		filterTagsAnd: {
			get()  { return this.builderOptionGet('overviewFilterTagsAnd', true); },
			set(v) { this.builderOptionSet('overviewFilterTagsAnd', v); }
		},

		// simple
		module:s => s.moduleIdMap[s.id] === undefined ? false : s.moduleIdMap[s.id],

		// stores
		moduleIdMap: s => s.$store.getters['schema/moduleIdMap'],
		tagIdMap:    s => s.$store.getters['schema/tagIdMap'],
		capApp:      s => s.$store.getters.captions.builder.function,
		capAppFilter:s => s.$store.getters.captions.filter,
		capGen:      s => s.$store.getters.captions.generic
	},
	mounted() {
		console.log('filters avail', Object.keys(this.filters));

		if (this.filter !== '') {
			const filterLine = decodeURIComponent(this.filter);
			for (const a of Object.keys(this.filters)) {
				if (filterLine.includes(a)) this.filters[a] = true;
			}

			let tagIds = [];
			for (const m of filterLine.matchAll(/t\-([0-9a-f\-]{36})/g)) {
				if (this.tagIdMap[m[1]] !== undefined)
					tagIds.push(m[1]);
			}
			this.filterTagIds = tagIds;
		}
	},
	methods: {
		// externals
		builderOptionGet,
		builderOptionSet,

		// actions
		updateFilterArgs() {
			let parts = [];
			for (const a of Object.keys(this.filters)) {
				if(this.filters[a])
					parts.push(a);
			}
			for (const tagId of this.filterTagIds) {
				parts.push(`t-${tagId}`);
			}
			this.$router.replace(parts.length === 0
				? `/builder/pg-functions/${this.module.id}/all`
				: `/builder/pg-functions/${this.module.id}/${encodeURIComponent(parts.join('+'))}`
			);
		},
	}
};
