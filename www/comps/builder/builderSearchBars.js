import {srcBase64} from '../shared/image.js';
export {MyBuilderSearchBars as default};

let MyBuilderSearchBars = {
	name:'my-builder-search-bars',
	template:`<div class="builder-search-bars contentBox grow">
		<div class="top lower">
			<div class="area nowrap">
				<img class="icon" src="images/search.png" />
				<h1 class="title">{{ capApp.title }}</h1>
			</div>
			<div class="area default-inputs">
				<input v-model="filter" placeholder="..." />
			</div>
		</div>
		
		<div class="content default-inputs" v-if="module">
			<div class="generic-entry-list">
				
				<div class="entry"
					v-if="!readonly"
					@click="$emit('createNew','searchBar')"
					:class="{ clickable:!readonly }"
				>
					<div class="row gap centered">
						<img class="icon" src="images/add.png" />
						<span>{{ capGen.button.new }}</span>
					</div>
				</div>
				
				<router-link class="entry clickable"
					v-for="b in module.searchBars.filter(v => filter === '' || v.name.toLowerCase().includes(filter.toLowerCase()))"
					:key="b.id"
					:to="'/builder/search-bar/'+b.id" 
				>
					<div class="lines">
						<span>{{ b.name }}</span>
					</div>
					<div class="row gap">
						<my-button
							v-if="b.iconId !== null"
							:active="false"
							:captionTitle="capGen.icon"
							:imageBase64="srcBase64(iconIdMap[b.iconId].file)"
							:naked="true"
						/>
					</div>
				</router-link>
			</div>
		</div>
	</div>`,
	props:{
		id:      { type:String,  required:true },
		readonly:{ type:Boolean, required:true }
	},
	data() {
		return {
			filter:'',
		};
	},
	computed:{
		module:(s) => s.moduleIdMap[s.id] === undefined ? false : s.moduleIdMap[s.id],
		
		// stores
		moduleIdMap:(s) => s.$store.getters['schema/moduleIdMap'],
		iconIdMap:  (s) => s.$store.getters['schema/iconIdMap'],
		capApp:     (s) => s.$store.getters.captions.builder.searchBar,
		capGen:     (s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		srcBase64
	}
};