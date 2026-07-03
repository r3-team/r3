import MyBuilderTagInput from './builderTagInput.js';
import {
	builderOptionGet,
	builderOptionSet
} from '../shared/builder.js';

export default {
	name:'my-builder-relations-show',
	components:{ MyBuilderTagInput },
	template:`<div class="row grow nowrap builder-relations" v-if="module">

		<div class="contentBox grow">
			<div class="top lower">
				<div class="area nowrap">
					<img class="icon" src="images/database.png" />
					<h1 class="title">{{ capApp.title }}</h1>
				</div>
				<div class="area">
					<my-button image="open.png"
						@trigger="$router.push('/builder/relations/'+id+'/overview/1');"
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
						v-for="r in module.relations.filter(v => relationIdsShow === null || relationIdsShow.includes(v.id))"
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
						<my-builder-tag-input v-model="filterTagIds" :dynamic="true" :module :readonly="false" />
					</div>

					<div class="row gap space-between">
						<my-label image="time.png" :bold="filterRetention1 || filterRetention0" :caption="capGen.changeLogs" />
						<div class="row gap wrap">
							<my-button
								@trigger="filterRetention1 = !filterRetention1"
								:active="!filterRetention0"
								:caption="capGen.option.yes"
								:image="filterRetention1 ? 'checkbox1.png' : 'checkbox0.png'"
								:naked="true"
							/>
							<my-button
								@trigger="filterRetention0 = !filterRetention0"
								:active="!filterRetention1"
								:caption="capGen.option.no"
								:image="filterRetention0 ? 'checkbox1.png' : 'checkbox0.png'"
								:naked="true"
							/>
						</div>
					</div>
					<div class="row gap space-between">
						<my-label image="personTemplate.png" :bold="filterPolicies1 || filterPolicies0" :caption="capGen.policies" />
						<div class="row gap wrap">
							<my-button
								@trigger="filterPolicies1 = !filterPolicies1"
								:active="!filterPolicies0"
								:caption="capGen.option.yes"
								:image="filterPolicies1 ? 'checkbox1.png' : 'checkbox0.png'"
								:naked="true"
							/>
							<my-button
								@trigger="filterPolicies0 = !filterPolicies0"
								:active="!filterPolicies1"
								:caption="capGen.option.no"
								:image="filterPolicies0 ? 'checkbox1.png' : 'checkbox0.png'"
								:naked="true"
							/>
						</div>
					</div>
					<div class="row gap space-between">
						<my-label image="lock.png" :bold="filterEncryption1 || filterEncryption0" :caption="capGen.encryption" />
						<div class="row gap wrap">
							<my-button
								@trigger="filterEncryption1 = !filterEncryption1"
								:active="!filterEncryption0"
								:caption="capGen.option.yes"
								:image="filterEncryption1 ? 'checkbox1.png' : 'checkbox0.png'"
								:naked="true"
							/>
							<my-button
								@trigger="filterEncryption0 = !filterEncryption0"
								:active="!filterEncryption1"
								:caption="capGen.option.no"
								:image="filterEncryption0 ? 'checkbox1.png' : 'checkbox0.png'"
								:naked="true"
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>`,
	props:{
		filter:  { type:[String,null], required:false, default:null },
		id:      { type:String,        required:true },
		readonly:{ type:Boolean,       required:true },
		tagId:   { type:[String,null], required:false, default:null }
	},
	data() {
		return {
			filterEncryption0: false,
			filterEncryption1: false,
			filterPolicies0: false,
			filterPolicies1: false,
			filterRetention0: false,
			filterRetention1: false,
			filterText: '',
			filterTagIds: [],
			showSidebar: true
		};
	},
	computed:{
		relationIdsShow: s => {
			const filterName = s.filterText.toLowerCase();
			let out = [];
			for (const r of s.module.relations) {
				if (
					(filterName === '' || r.name.toLowerCase().includes(filterName))
					&& (!s.filterEncryption0 || !r.encryption)
					&& (!s.filterEncryption1 || r.encryption)
					&& (!s.filterPolicies0 || r.policies.length === 0)
					&& (!s.filterPolicies1 || r.policies.length !== 0)
					&& (!s.filterRetention0 || (r.retentionCount === null && r.retentionDays === null))
					&& (!s.filterRetention1 || r.retentionCount !== null || r.retentionDays !== null)
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
			get()  { return this.builderOptionGet('relationsFilterTagsAnd', true); },
			set(v) { this.builderOptionSet('relationsFilterTagsAnd', v); }
		},

		// simple
		module:s => s.moduleIdMap[s.id] === undefined ? false : s.moduleIdMap[s.id],

		// stores
		iconIdMap:   s => s.$store.getters['schema/iconIdMap'],
		moduleIdMap: s => s.$store.getters['schema/moduleIdMap'],
		capApp:      s => s.$store.getters.captions.builder.relation,
		capAppFilter:s => s.$store.getters.captions.filter,
		capGen:      s => s.$store.getters.captions.generic
	},
	mounted() {
		if (this.tagId !== null)          this.filterTagIds.push(this.tagId);
		if (this.filter === 'changelog')  this.filterRetention1  = true;
		if (this.filter === 'encryption') this.filterEncryption1 = true;
		if (this.filter === 'policies')   this.filterPolicies1   = true;
	},
	methods: {
		// externals
		builderOptionGet,
		builderOptionSet,

		// presentation
		displayRetention(rel) {
			let count = rel.retentionCount !== null ? rel.retentionCount : 0;
			let days  = rel.retentionDays  !== null ? rel.retentionDays  : 0;
			return `${count}/${days}`;
		}
	}
};
