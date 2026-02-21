export default {
	name:'my-builder-docs',
	template:`<div class="builder-docs contentBox grow">
		<div class="top lower">
			<div class="area nowrap">
				<img class="icon" src="images/document.png" />
				<h1 class="title">{{ capGen.pdfs }}</h1>
			</div>
			<div class="area default-inputs">
				<input v-model="filter" placeholder="..." />
			</div>
		</div>
		
		<div class="content default-inputs" v-if="module">
			<div class="generic-entry-list">
				
				<div class="entry"
					v-if="!readonly"
					@click="$emit('createNew','doc')"
					:class="{ clickable:!readonly }"
				>
					<div class="row gap centered">
						<img class="icon" src="images/add.png" />
						<span>{{ capGen.button.new }}</span>
					</div>
				</div>
				
				<router-link class="entry clickable"
					v-for="a in module.docs.filter(v => filter === '' || v.name.toLowerCase().includes(filter.toLowerCase()))"
					:key="a.id"
					:to="'/builder/doc/'+a.id" 
				>
					<div class="lines">
						<span>{{ a.name }}</span>
					</div>
				</router-link>
			</div>
		</div>
	</div>`,
	emits:['createNew'],
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
		module:s => s.moduleIdMap[s.id] === undefined ? false : s.moduleIdMap[s.id],
		
		// stores
		moduleIdMap:s => s.$store.getters['schema/moduleIdMap'],
		capApp:     s => s.$store.getters.captions.builder.doc,
		capGen:     s => s.$store.getters.captions.generic
	}
};