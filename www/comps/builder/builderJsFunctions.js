import MyBuilderTagInput        from './builderTagInput.js';
import MyBuilderFilterPairInput from './builderFilterPairInput.js';
import { getJsFunctionsProcessed } from '../shared/builder.js';
import {
	builderOptionGet,
	builderOptionSet
} from '../shared/builder.js';

export default {
	name:'my-builder-js-functions',
	components:{ MyBuilderFilterPairInput, MyBuilderTagInput },
	template:`<div class="row grow nowrap builder-functions" v-if="module">

		<div class="contentBox grow builder-functions">
			<div class="top lower">
				<div class="area nowrap">
					<img class="icon" src="images/codeScreen.png" />
					<h1 class="title">{{ capGen.functionsFrontend }}</h1>
				</div>
				<div class="area">
					<my-button image="open.png"
						@trigger="$router.push('/builder/overview/js-functions/'+id+'/1');"
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
						@click="$emit('createNew','jsFunction')"
						:class="{ clickable:!readonly }"
					>
						<div class="row gap centered">
							<img class="icon" src="images/add.png" />
							<span>{{ capGen.button.new }}</span>
						</div>
					</div>

					<router-link class="entry clickable"
						v-for="f in jsFunctions.filter(v => idsShow.includes(v.id))"
						:key="f.id"
						:to="'/builder/js-function/'+f.id"
					>
						<div class="lines">
							<span v-if="f.formId === null">{{ f.name }}</span>
							<span v-if="f.formId !== null"><b>{{ formIdMap[f.formId].name }}:</b> {{ f.name }}</span>
							<span class="subtitle" v-if="typeof f.captions.jsFunctionTitle[builderLanguage] !== 'undefined'">
								[{{ f.captions.jsFunctionTitle[builderLanguage] }}]
							</span>
						</div>
						<div class="row">
							<my-button image="fileText.png"
								v-if="f.formId !== null"
								:active="false"
								:captionTitle="capApp.form"
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
						<input class="dynamic" v-focus v-model="filterText" :placeholder="capGen.threeDots" />
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

					<my-builder-filter-pair-input image="fileText.png"
						@update="updateFilterArgs"
						v-model:value0="filters.form0"
						v-model:value1="filters.form1"
						:caption="capGen.forms"
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
				form0: false,
				form1: false
			},
			showSidebar: true,
		};
	},
	computed:{
		idsShow: s => {
			const filterName = s.filterText.toLowerCase();
			let out = [];
			for (const f of s.module.jsFunctions) {
				if (
					(
						filterName === ''
						|| f.name.toLowerCase().includes(filterName)
						|| (
							f.formId !== null
							&& s.formIdMap[f.formId].name.toLowerCase().includes(filterName)
						)
					)
					&& (!s.filters.form0 || f.formId === null)
					&& (!s.filters.form1 || f.formId !== null)
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
		jsFunctions:s => s.getJsFunctionsProcessed(s.module.jsFunctions,''),
		module:     s => s.moduleIdMap[s.id] === undefined ? false : s.moduleIdMap[s.id],

		// stores
		moduleIdMap: s => s.$store.getters['schema/moduleIdMap'],
		tagIdMap:    s => s.$store.getters['schema/tagIdMap'],
		formIdMap:   s => s.$store.getters['schema/formIdMap'],
		capApp:      s => s.$store.getters.captions.builder.function,
		capAppFilter:s => s.$store.getters.captions.filter,
		capGen:      s => s.$store.getters.captions.generic
	},
	mounted() {
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
	methods:{
		// external
		builderOptionGet,
		builderOptionSet,
		getJsFunctionsProcessed,

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
				? `/builder/js-functions/${this.module.id}/all`
				: `/builder/js-functions/${this.module.id}/${encodeURIComponent(parts.join('+'))}`
			);
		}
	}
};
