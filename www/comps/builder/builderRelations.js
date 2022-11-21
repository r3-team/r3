export {MyBuilderRelations as default};

let MyBuilderRelations = {
	name:'my-builder-relations',
	template:`<div class="contentBox grow builder-relations">
		<div class="top lower">
			<div class="area nowrap">
				<img class="icon" src="images/database.png" />
				<h1 class="title">{{ capApp.title }}</h1>
			</div>
			<div class="area default-inputs">
				<input v-model="filter" placeholder="..." />
			</div>
		</div>
		
		<div class="content default-inputs" v-if="module">
			<div class="builder-entry-list">
			
				<div class="entry"
					@click="$emit('createNew',readonly ? null : 'relation')"
					:class="{ clickable:!readonly, off:readonly }"
				>
					<div class="row gap centered">
						<img class="icon" src="images/add.png" />
						<span>{{ capGen.button.new }}</span>
					</div>
				</div>
				
				<router-link class="entry clickable"
					v-for="r in module.relations.filter(v => filter === '' || v.name.includes(filter))"
					:key="r.id"
					:to="'/builder/relation/'+r.id" 
				>
					<span>{{ r.name }}</span>
					<div class="row">
						
						<my-button image="lock.png"
							v-if="r.encryption"
							:active="false"
							:captionTitle="capApp.encryptionHint"
							:naked="true"
							:tight="true"
						/>
						<my-button image="time.png"
							v-if="r.retentionCount !== null || r.retentionDays !== null"
							:active="false"
							:caption="displayRetention(r)"
							:captionTitle="capApp.retentionHint"
							:naked="true"
							:tight="true"
						/>
						<my-button image="files_list2.png"
							v-if="r.attributes.length !== 0"
							:active="false"
							:caption="String(r.attributes.length)"
							:captionTitle="capApp.attributes.replace('{CNT}',r.attributes.length)"
							:naked="true"
							:tight="true"
						/>
					</div>
				</router-link>
			</div>
		</div>
	</div>`,
	data:function() {
		return {
			filter:'',
		};
	},
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
	},
	methods:{
		// presentation
		displayRetention(rel) {
			let count = rel.retentionCount !== null ? rel.retentionCount : 0;
			let days  = rel.retentionDays  !== null ? rel.retentionDays  : 0;
			return `${count} / ${days}`;
		}
	}
};