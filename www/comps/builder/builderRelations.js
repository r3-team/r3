export {MyBuilderRelations as default};

let MyBuilderRelations = {
	name:'my-builder-relations',
	template:`<div class="contentBox grow builder-relations">
		<div class="top lower">
			<div class="area nowrap">
				<img class="icon" src="images/database.png" />
				
				<div class="row gap">
					<h1 class="title">{{ capApp.title }}</h1>
					<my-button image="add.png"
						@trigger="$emit('createNew','relation')"
						:caption="capGen.button.add"
					/>
				</div>
			</div>
		</div>
		
		<div class="content default-inputs" v-if="module">
			<div class="builder-entry-list">
				<router-link class="entry clickable"
					v-for="r in module.relations"
					:key="r.id"
					:to="'/builder/relation/'+r.id" 
				>{{ r.name }}</router-link>
			</div>
		</div>
	</div>`,
	props:{
		id:      { type:String,  required:true },
		readonly:{ type:Boolean, required:true }
	},
	computed:{
		module:(s) => typeof s.moduleIdMap[s.id] === 'undefined' ? false : s.moduleIdMap[s.id],
		
		// stores
		moduleIdMap:(s) => s.$store.getters['schema/moduleIdMap'],
		capApp:     (s) => s.$store.getters.captions.builder.relation,
		capGen:     (s) => s.$store.getters.captions.generic
	}
};