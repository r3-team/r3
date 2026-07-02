import MyBuilderTagInput from './builderTagInput.js';

const MyBuilderRelationsFilter = {
	name: 'my-builder-relations-filter',
	components: { MyBuilderTagInput },
	template:`<div class="contentBox builder-filter-sidebar" :class="{ fullscreen:isStartscreen }">
		<div class="top lower">
			<div class="area nowrap">
				<template v-if="isStartscreen">
					<img class="icon" src="images/database.png" />
					<h1 class="title">{{ capGen.relations }}</h1>
				</template>
				<template v-if="!isStartscreen">
					<img class="icon" src="images/filter.png" />
					<h1 class="title">{{ capGen.filters }}</h1>
				</template>
			</div>
		</div>
		<div class="content default-inputs">
			<div class="column gap-large">
				<div class="column gap">
					<my-label image="editBox.png" :caption="capGen.name" />
					<input class="dynamic" v-model="filterText" :placeholder="capGen.threeDots" />
				</div>

				<div class="column gap">
					<div class="row gap centered space-between">
						<my-label image="tag.png" :caption="capGen.tags" />
						<my-button
							@trigger="filterTagsAnd = !filterTagsAnd"
							:caption="capApp.option.connector.OR"
							:image="filterTagsAnd ? 'checkbox0.png' : 'checkbox1.png'"
							:naked="true"
						/>
					</div>
					<my-builder-tag-input v-model="filterTagIds" :dynamic="true" :module :readonly="false" />
				</div>

				<div class="row gap space-between">
					<my-label image="time.png" :caption="capGen.changeLogs" />
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
					<my-label image="lock.png" :caption="capGen.encryption" />
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
	</div>`,
	props:{
		isStartscreen:{ type:Boolean, required:true },
		module:       { type:Object,  required:true }
	},
	emits:['setFullscreen','setRelationIdsShow'],
	data() {
		return {
			filterEncryption0: false,
			filterEncryption1: false,
			filterRetention0: false,
			filterRetention1: false,
			filterText: '',
			filterTagIds: [],
			filterTagsAnd: true,
		};
	},
	watch: {
		relationIdsShow(v) {
			this.$emit('setRelationIdsShow', this.anyFilterActive ? v : null);
		},
	},
	computed: {
		anyFilterActive: s => s.filterText !== ''
			|| s.filterEncryption0
			|| s.filterEncryption1
			|| s.filterRetention0
			|| s.filterRetention1
			|| s.filterTagIds.length !== 0,
		relationIdsShow: s => {
			const filterName = s.filterText.toLowerCase();
			let out = [];
			for (const r of s.module.relations) {
				if (
					(filterName === '' || r.name.toLowerCase().includes(filterName))
					&& (!s.filterEncryption0 || !r.encryption)
					&& (!s.filterEncryption1 || r.encryption)
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

		// stores
		capApp:s => s.$store.getters.captions.filter,
		capGen:s => s.$store.getters.captions.generic
	}
};


export default {
	name:'my-builder-relations',
	components:{ MyBuilderRelationsFilter },
	template:`<div class="row grow nowrap builder-relations" v-if="module">

		<div class="contentBox grow" v-if="!showSidebarStartscreen">
			<div class="top lower">
				<div class="area nowrap">
					<img class="icon" src="images/database.png" />
					<h1 class="title">{{ capApp.title }}</h1>
				</div>
				<div class="area">
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
		<my-builder-relations-filter
			v-if="showSidebar"
			@setRelationIdsShow="relationIdsShow = $event"
			:isStartscreen="showSidebarStartscreen"
			:module
		/>
	</div>`,
	props:{
		id:      { type:String,  required:true },
		readonly:{ type:Boolean, required:true }
	},
	data() {
		return {
			relationIdsShow: null,
			showSidebar: true,
			showSidebarStartscreen: false
		};
	},
	computed:{
		module:s => s.moduleIdMap[s.id] === undefined ? false : s.moduleIdMap[s.id],

		// stores
		moduleIdMap:s => s.$store.getters['schema/moduleIdMap'],
		capApp:     s => s.$store.getters.captions.builder.relation,
		capGen:     s => s.$store.getters.captions.generic
	},
	methods:{
		displayRetention(rel) {
			let count = rel.retentionCount !== null ? rel.retentionCount : 0;
			let days  = rel.retentionDays  !== null ? rel.retentionDays  : 0;
			return `${count}/${days}`;
		}
	}
};
