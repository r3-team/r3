import MyBuilderTagInput from './builderTagInput.js';
import { srcBase64 } from '../shared/image.js';
import {
	builderOptionGet,
	builderOptionSet
} from '../shared/builder.js';

export default {
	name: 'my-builder-forms',
	components: {MyBuilderTagInput},
	template:`<div class="row grow nowrap builder-relations" v-if="module">
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
		<div class="contentBox sidebar" v-if="showSidebar">
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
				</div>
			</div>
		</div>
	</div>`,
	props:{
		filter:         { type:[String,null], required:false, default:null },
		builderLanguage:{ type:String,        required:true },
		id:             { type:String,        required:true },
		readonly:       { type:Boolean,       required:true }
	},
	data() {
		return {
			filterText: '',
			filterTagIds: [],
			showSidebar: true
		};
	},
	computed:{
		idsShow: s => {
			const filterName = s.filterText.toLowerCase();
			let out = [];
			for (const f of s.module.forms) {
				if (
					(filterName === '' || f.name.toLowerCase().includes(filterName))
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
		if (this.filter !== null) {
			const f = decodeURIComponent(this.filter);

			let tagIds = [];
			for (const m of f.matchAll(/t\-([0-9a-f\-]{36})/g)) {
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
