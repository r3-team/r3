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

					<my-builder-filter-pair-input image="time.png"
						@update="updateFilterArgs"
						v-model:value0="filterRetention0"
						v-model:value1="filterRetention1"
						:caption="capGen.changeLogs"
					/>
					<my-builder-filter-pair-input image="databaseText.png"
						@update="updateFilterArgs"
						v-model:value0="filterRecordTitle0"
						v-model:value1="filterRecordTitle1"
						:caption="capGen.recordTitle"
					/>
					<my-builder-filter-pair-input image="databaseCircle.png"
						@update="updateFilterArgs"
						v-model:value0="filterPresets0"
						v-model:value1="filterPresets1"
						:caption="capGen.presets"
					/>
					<my-builder-filter-pair-input image="databasePlay.png"
						@update="updateFilterArgs"
						v-model:value0="filterTriggers0"
						v-model:value1="filterTriggers1"
						:caption="capGen.triggers"
					/>
					<my-builder-filter-pair-input image="personTemplate.png"
						@update="updateFilterArgs"
						v-model:value0="filterPolicies0"
						v-model:value1="filterPolicies1"
						:caption="capGen.policies"
					/>
					<my-builder-filter-pair-input image="lock.png"
						@update="updateFilterArgs"
						v-model:value0="filterEncryption0"
						v-model:value1="filterEncryption1"
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
			filterEncryption0: false,
			filterEncryption1: false,
			filterPolicies0: false,
			filterPolicies1: false,
			filterPresets0: false,
			filterPresets1: false,
			filterRecordTitle0: false,
			filterRecordTitle1: false,
			filterRetention0: false,
			filterRetention1: false,
			filterTriggers0: false,
			filterTriggers1: false,
			filterText: '',
			filterTagIds: [],
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
					&& (!s.filterEncryption0 || !r.encryption)
					&& (!s.filterEncryption1 || r.encryption)
					&& (!s.filterPolicies0 || r.policies.length === 0)
					&& (!s.filterPolicies1 || r.policies.length !== 0)
					&& (!s.filterPresets0 || r.presets.length === 0)
					&& (!s.filterPresets1 || r.presets.length !== 0)
					&& (!s.filterRecordTitle0 || r.attributeIdsTitle.length === 0)
					&& (!s.filterRecordTitle1 || r.attributeIdsTitle.length !== 0)
					&& (!s.filterRetention0 || (r.retentionCount === null && r.retentionDays === null))
					&& (!s.filterRetention1 || r.retentionCount !== null || r.retentionDays !== null)
					&& (!s.filterTriggers0 || !s.module.pgTriggers.some(t => t.relationId === r.id))
					&& (!s.filterTriggers1 || s.module.pgTriggers.some(t => t.relationId === r.id))
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
			const f = decodeURIComponent(this.filter);
			if (f.includes('encryption0')) this.filterEncryption0 = true;
			if (f.includes('encryption1')) this.filterEncryption1 = true;
			if (f.includes('policies0')) this.filterPolicies0 = true;
			if (f.includes('policies1')) this.filterPolicies1 = true;
			if (f.includes('presets0')) this.filterPresets0 = true;
			if (f.includes('presets1')) this.filterPresets1 = true;
			if (f.includes('recordtitle0')) this.filterRecordTitle0 = true;
			if (f.includes('recordtitle1')) this.filterRecordTitle1 = true;
			if (f.includes('retention0')) this.filterRetention0 = true;
			if (f.includes('retention1')) this.filterRetention1 = true;
			if (f.includes('triggers0')) this.filterTriggers0 = true;
			if (f.includes('triggers1')) this.filterTriggers1 = true;

			let tagIds = [];
			for (const m of f.matchAll(/t\-([0-9a-f\-]{36})/g)) {
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
			if (this.filterEncryption0) parts.push('encryption0');
			if (this.filterEncryption1) parts.push('encryption1');
			if (this.filterPolicies0) parts.push('policies0');
			if (this.filterPolicies1) parts.push('policies1');
			if (this.filterPresets0) parts.push('presets0');
			if (this.filterPresets1) parts.push('presets1');
			if (this.filterRecordTitle0) parts.push('recordtitle0');
			if (this.filterRecordTitle1) parts.push('recordtitle1');
			if (this.filterRetention0) parts.push('retention0');
			if (this.filterRetention1) parts.push('retention1');
			if (this.filterTriggers0) parts.push('triggers0');
			if (this.filterTriggers1) parts.push('triggers1');
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
