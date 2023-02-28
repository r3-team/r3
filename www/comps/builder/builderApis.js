export {MyBuilderApis as default};

let MyBuilderApis = {
	name:'my-builder-apis',
	template:`<div class="builder-apis contentBox grow">
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
			<div class="builder-entry-list">
				
				<div class="entry"
					v-if="!readonly"
					@click="$emit('createNew','api')"
					:class="{ clickable:!readonly }"
				>
					<div class="row gap centered">
						<img class="icon" src="images/add.png" />
						<span>{{ capGen.button.new }}</span>
					</div>
				</div>
				
				<router-link class="entry clickable"
					v-for="a in module.apis.filter(v => filter === '' || v.name.toLowerCase().includes(filter.toLowerCase()))"
					:key="a.id"
					:to="'/builder/api/'+a.id" 
				>
					<div class="lines">
						<span>{{ a.name }}</span>
					</div>
					<div class="row">
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
		capApp:     (s) => s.$store.getters.captions.builder.api,
		capGen:     (s) => s.$store.getters.captions.generic
	}
};