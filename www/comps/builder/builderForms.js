import MyBuilderTagInput from './builderTagInput.js';
import MyBuilderFilterPairInput from './builderFilterPairInput.js';
import { srcBase64 } from '../shared/image.js';
import {
	builderOptionGet,
	builderOptionSet
} from '../shared/builder.js';

export default {
	name: 'my-builder-forms',
	components: { MyBuilderFilterPairInput, MyBuilderTagInput },
	template:`<div class="row grow nowrap builder-forms" v-if="module">
		<div class="contentBox grow">
			<div class="top lower">
				<div class="area nowrap">
					<img class="icon" src="images/fileText.png" />
					<h1 class="title">{{ capApp.title }} ({{ idsShow.length + '/' + module.forms.length }})</h1>
				</div>
				<div class="area">
					<my-button image="open.png"
						@trigger="$router.push('/builder/overview/forms/'+id+'/1');"
						:caption="capGen.overview"
					/>
					<my-button
						@trigger="showSidebar = !showSidebar"
						:image="showSidebar ? 'toggleRight.png' : 'toggleLeft.png'"
					/>
				</div>
			</div>

			<div class="content default-inputs">

				<div class="generic-entry-list">
					<div class="entry"
						v-if="!readonly"
						@click="$emit('createNew','form')"
						:class="{ clickable:!readonly }"
					>
						<div class="row gap centered">
							<img class="icon" src="images/add.png" />
							<span>{{ capGen.button.new }}</span>
						</div>
					</div>

					<router-link class="entry clickable"
						v-for="f in module.forms.filter(v => idsShow.includes(v.id))"
						:key="f.id"
						:to="'/builder/form/'+f.id"
					>
						<div class="lines">
							<span>{{ f.name }}</span>
							<span class="subtitle" v-if="typeof f.captions.formTitle[builderLanguage] !== 'undefined'">
								[{{ f.captions.formTitle[builderLanguage] }}]
							</span>
						</div>
						<my-button
							v-if="f.iconId !== null"
							:active="false"
							:captionTitle="capGen.icon"
							:imageBase64="srcBase64(iconIdMap[f.iconId].file)"
							:naked="true"
						/>
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

					<my-builder-filter-pair-input image="databaseCircle.png"
						@update="updateFilterArgs"
						v-model:value0="filters.data0"
						v-model:value1="filters.data1"
						:caption="capGen.recordLoad"
					/>
					<my-builder-filter-pair-input image="files_list2.png"
						@update="updateFilterArgs"
						v-model:value0="filters.list0"
						v-model:value1="filters.list1"
						:caption="capGen.listFullpage"
					/>
				</div>
			</div>
		</div>
	</div>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		filter:         { type:String,  required:true },
		id:             { type:String,  required:true },
		readonly:       { type:Boolean, required:true }
	},
	data() {
		return {
			filterText: '',
			filterTagIds: [],
			filters: {
				data0: false,
				data1: false,
				list0: false,
				list1: false
			},
			showSidebar: true
		};
	},
	computed:{
		idsShow: s => {
			const filterName = s.filterText.toLowerCase();
			let out = [];
			for (const f of s.module.forms) {
				const listFullpage = f.fields.length === 1 && f.fields[0].content === 'list';

				if (
					(filterName === '' || f.name.toLowerCase().includes(filterName))
					&& (!s.filters.data0 || f.query === null)
					&& (!s.filters.data1 || f.query !== null)
					&& (!s.filters.list0 || !listFullpage)
					&& (!s.filters.list1 || listFullpage)
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
		formIdMap:   s => s.$store.getters['schema/formIdMap'],
		iconIdMap:   s => s.$store.getters['schema/iconIdMap'],
		modules:     s => s.$store.getters['schema/modules'],
		moduleIdMap: s => s.$store.getters['schema/moduleIdMap'],
		tagIdMap:    s => s.$store.getters['schema/tagIdMap'],
		capApp:      s => s.$store.getters.captions.builder.form,
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
		// externals
		builderOptionGet,
		builderOptionSet,
		srcBase64,

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
				? `/builder/forms/${this.module.id}/all`
				: `/builder/forms/${this.module.id}/${encodeURIComponent(parts.join('+'))}`
			);
		},
	}
};
