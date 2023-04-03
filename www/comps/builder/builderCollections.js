import {srcBase64} from '../shared/image.js';
export {MyBuilderCollections as default};

let MyBuilderCollections = {
	name:'my-builder-collections',
	template:`<div class="builder-collections contentBox grow">
		<div class="top lower">
			<div class="area nowrap">
				<img class="icon" src="images/tray.png" />
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
					@click="$emit('createNew','collection')"
					:class="{ clickable:!readonly }"
				>
					<div class="row gap centered">
						<img class="icon" src="images/add.png" />
						<span>{{ capGen.button.new }}</span>
					</div>
				</div>
				
				<router-link class="entry clickable"
					v-for="c in module.collections.filter(v => filter === '' || v.name.toLowerCase().includes(filter.toLowerCase()))"
					:key="c.id"
					:to="'/builder/collection/'+c.id" 
				>
					<div class="lines">
						<span>{{ c.name }}</span>
					</div>
					<div class="row">
						<my-button image="menu.png"
							v-if="c.inHeader.length !== 0"
							:active="false"
							:captionTitle="capApp.inHeader"
							:naked="true"
							:tight="true"
						/>
						<my-button
							v-if="c.iconId !== null"
							:active="false"
							:captionTitle="capGen.icon"
							:imageBase64="srcBase64(iconIdMap[c.iconId].file)"
							:naked="true"
							:tight="true"
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
		module:(s) => typeof s.moduleIdMap[s.id] === 'undefined' ? false : s.moduleIdMap[s.id],
		
		// stores
		moduleIdMap:(s) => s.$store.getters['schema/moduleIdMap'],
		iconIdMap:  (s) => s.$store.getters['schema/iconIdMap'],
		capApp:     (s) => s.$store.getters.captions.builder.collection,
		capGen:     (s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		srcBase64
	}
};