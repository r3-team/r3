export default {
	name:'my-builder-history',
	template:`<div class="builder-history contentBox grow">
		<div class="top lower">
			<div class="area nowrap">
				<img class="icon" src="images/versionHistory.png" />
				<h1 class="title">{{ capGen.versionHistory }}</h1>
			</div>
			<div class="area default-inputs">
				<input v-model="filter" placeholder="..." />
			</div>
		</div>
		
		<div class="content default-inputs" v-if="module">
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
		module:s => s.moduleIdMap[s.id] === undefined ? false : s.moduleIdMap[s.id],
		
		// stores
		moduleIdMap:s => s.$store.getters['schema/moduleIdMap'],
		capApp:     s => s.$store.getters.captions.builder.history,
		capGen:     s => s.$store.getters.captions.generic
	}
};