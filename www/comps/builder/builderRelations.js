import MyBuilderTagInput        from './builderTagInput.js';
import MyBuilderFilterPairInput from './builderFilterPairInput.js';
import {
	builderOptionGet,
	builderOptionSet
} from '../shared/builder.js';

export default {
	name:'my-builder-relations',
	components:{ MyBuilderFilterPairInput, MyBuilderTagInput },
	template:`<div class="row grow nowrap builder-relations" v-if="module">

		<div class="contentBox grow">
			<div class="top lower">
				<div class="area nowrap">
					<img class="icon" src="images/database.png" />
					<h1 class="title">{{ capApp.title }} ({{ idsShow.length + '/' + module.relations.length }})</h1>
				</div>
				<div class="area">
					<my-button image="open.png"
						@trigger="$router.push('/builder/overview/relations/'+id+'/1');"
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
						@click="$emit('createNew','relation')"
						:class="{ clickable:!readonly }"
					>
						<div class="row gap centered">
							<img class="icon" src="images/add.png" />
							<span>{{ capGen.button.new }}</span>
						</div>
					</div>

					<router-link class="entry clickable"
						v-for="r in module.relations.filter(v => idsShow.includes(v.id))"
						:key="r.id"
						:title="r.comment"
						:to="'/builder/relation/'+r.id"
					>
						<div class="lines">
							<span>{{ r.name }}</span>
							<span class="subtitle" v-if="r.comment !== null">{{ r.comment }}</span>
						</div>
						<my-button image="lock.png"
							v-if="r.encryption"
							:active="false"
							:captionTitle="capApp.encryptionHint"
							:naked="true"
						/>
						<my-button image="time.png"
							v-if="r.retentionCount !== null || r.retentionDays !== null"
							:active="false"
							:caption="displayRetention(r)"
							:captionTitle="capApp.retentionHint"
							:naked="true"
						/>
						<my-button image="files_list2.png"
							v-if="r.attributes.length !== 0"
							:active="false"
							:caption="String(r.attributes.length)"
							:captionTitle="capApp.attributes.replace('{CNT}',r.attributes.length)"
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

					<my-builder-filter-pair-input image="time.png"
						@update="updateFilterArgs"
						v-model:value0="filters.retention0"
						v-model:value1="filters.retention1"
						:caption="capGen.changeLogs"
					/>
					<my-builder-filter-pair-input image="databaseText.png"
						@update="updateFilterArgs"
						v-model:value0="filters.recordtitle0"
						v-model:value1="filters.recordtitle1"
						:caption="capGen.recordTitle"
					/>
					<my-builder-filter-pair-input image="databaseCircle.png"
						@update="updateFilterArgs"
						v-model:value0="filters.presets0"
						v-model:value1="filters.presets1"
						:caption="capGen.presets"
					/>
					<my-builder-filter-pair-input image="databasePlay.png"
						@update="updateFilterArgs"
						v-model:value0="filters.triggers0"
						v-model:value1="filters.triggers1"
						:caption="capGen.triggers"
					/>
					<my-builder-filter-pair-input image="personTemplate.png"
						@update="updateFilterArgs"
						v-model:value0="filters.policies0"
						v-model:value1="filters.policies1"
						:caption="capGen.policies"
					/>
					<my-builder-filter-pair-input image="lock.png"
						@update="updateFilterArgs"
						v-model:value0="filters.encryption0"
						v-model:value1="filters.encryption1"
						:caption="capGen.encryption"
					/>
				</div>
			</div>
		</div>
	</div>`,
	props:{
		filter:  { type:String,  required:true },
		id:      { type:String,  required:true },
		readonly:{ type:Boolean, required:true }
	},
	data() {
		return {
			filterText: '',
			filterTagIds: [],
			filters: {
				encryption0: false,
				encryption1: false,
				policies0: false,
				policies1: false,
				presets0: false,
				presets1: false,
				recordtitle0: false,
				recordtitle1: false,
				retention0: false,
				retention1: false,
				triggers0: false,
				triggers1: false
			},
			showSidebar: true
		};
	},
	computed:{
		idsShow: s => {
			const filterName = s.filterText.toLowerCase();
			let out = [];
			for (const r of s.module.relations) {
				if (
					(filterName === '' || r.name.toLowerCase().includes(filterName))
					&& (!s.filters.encryption0 || !r.encryption)
					&& (!s.filters.encryption1 || r.encryption)
					&& (!s.filters.policies0 || r.policies.length === 0)
					&& (!s.filters.policies1 || r.policies.length !== 0)
					&& (!s.filters.presets0 || r.presets.length === 0)
					&& (!s.filters.presets1 || r.presets.length !== 0)
					&& (!s.filters.recordtitle0 || r.attributeIdsTitle.length === 0)
					&& (!s.filters.recordtitle1 || r.attributeIdsTitle.length !== 0)
					&& (!s.filters.retention0 || (r.retentionCount === null && r.retentionDays === null))
					&& (!s.filters.retention1 || r.retentionCount !== null || r.retentionDays !== null)
					&& (!s.filters.triggers0 || !s.module.pgTriggers.some(t => t.relationId === r.id))
					&& (!s.filters.triggers1 || s.module.pgTriggers.some(t => t.relationId === r.id))
					&& (s.filterTagIds.length === 0 || (
						(s.filterTagsAnd && s.filterTagIds.every(v => r.tagIds.includes(v)))
						|| (!s.filterTagsAnd && s.filterTagIds.some(v => r.tagIds.includes(v)))
					))
				) {
					out.push(r.id);
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
		iconIdMap:   s => s.$store.getters['schema/iconIdMap'],
		moduleIdMap: s => s.$store.getters['schema/moduleIdMap'],
		tagIdMap:    s => s.$store.getters['schema/tagIdMap'],
		capApp:      s => s.$store.getters.captions.builder.relation,
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
				? `/builder/relations/${this.module.id}/all`
				: `/builder/relations/${this.module.id}/${encodeURIComponent(parts.join('+'))}`
			);
		},

		// presentation
		displayRetention(rel) {
			let count = rel.retentionCount !== null ? rel.retentionCount : 0;
			let days  = rel.retentionDays  !== null ? rel.retentionDays  : 0;
			return `${count}/${days}`;
		}
	}
};
