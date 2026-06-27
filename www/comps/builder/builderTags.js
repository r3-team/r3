import MyBuilderTag from './builderTag.js';
import {srcBase64}  from '../shared/image.js';

export default {
	name: 'my-builder-tags',
	components:{ MyBuilderTag },
	template:`<div class="builder-tags contentBox grow">
		<div class="top lower">
			<div class="area nowrap">
				<img class="icon" src="images/tag.png" />
				<h1 class="title">{{ capGen.tags }}</h1>
			</div>
			<div class="area default-inputs">
				<input v-model="filter" placeholder="..." />
			</div>
		</div>

		<div class="content default-inputs" v-if="module">
			<div class="generic-entry-list">

				<div class="entry"
					v-if="!readonly"
					@click="$emit('createNew','tag')"
					:class="{ clickable:!readonly }"
				>
					<div class="row gap centered">
						<img class="icon" src="images/add.png" />
						<span>{{ capGen.button.new }}</span>
					</div>
				</div>

				<div class="entry clickable"
					v-for="t in module.tags.filter(v => filter === '' || v.name.toLowerCase().includes(filter.toLowerCase()))"
					:key="t.id"
					@click="tagIdEdit = t.id"
				>
					<div class="lines">
						<span>{{ t.name }}</span>
					</div>
					<div class="row gap">
						<my-button
							v-if="t.iconId !== null"
							:active="false"
							:captionTitle="capGen.icon"
							:imageBase64="srcBase64(iconIdMap[t.iconId].file)"
							:naked="true"
						/>
					</div>
				</div>
			</div>
		</div>

		<!-- tag dialog -->
		<my-builder-tag
			v-if="module && tagIdEdit !== null"
			@close="tagIdEdit = null"
			:id="tagIdEdit"
			:module
			:readonly
		/>
	</div>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		id:             { type:String,  required:true },
		readonly:       { type:Boolean, required:true }
	},
	data() {
		return {
			filter:'',
			tagIdEdit:null
		};
	},
	computed:{
		module:s => s.moduleIdMap[s.id] === undefined ? false : s.moduleIdMap[s.id],

		// stores
		iconIdMap:  s => s.$store.getters['schema/iconIdMap'],
		moduleIdMap:s => s.$store.getters['schema/moduleIdMap'],
		capGen:     s => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		srcBase64
	}
};
