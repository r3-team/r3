export {MyBuilderRoles as default};

let MyBuilderRoles = {
	name:'my-builder-roles',
	template:`<div class="builder-roles contentBox grow">
		
		<div class="top lower">
			<div class="area nowrap">
				<img class="icon" src="images/personMultiple.png" />
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
					@click="$emit('createNew','role')"
					:class="{ clickable:!readonly }"
				>
					<div class="row gap centered">
						<img class="icon" src="images/add.png" />
						<span>{{ capGen.button.new }}</span>
					</div>
				</div>
				
				<router-link class="entry clickable"
					v-for="r in module.roles.filter(v => filter === '' || v.name.toLowerCase().includes(filter.toLowerCase()))"
					:key="r.id"
					:to="'/builder/role/'+r.id" 
				>
					<div class="lines">
						<span>{{ r.name }}</span>
						<span class="subtitle" v-if="typeof r.captions.roleTitle[builderLanguage] !== 'undefined'">
							[{{ r.captions.roleTitle[builderLanguage] }}]
						</span>
					</div>
					<div class="row gap">
						<my-button image="personArrow.png"
							v-if="r.assignable && r.name !== 'everyone'"
							:active="false"
							:captionTitle="capApp.assignable"
							:naked="true"
						/>
						
						<my-button image="department.png"
							v-if="r.childrenIds.length !== 0"
							:active="false"
							:caption="String(r.childrenIds.length)"
							:captionTitle="capApp.children"
							:naked="true"
						/>
					</div>
				</router-link>
			</div>
		</div>
	</div>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		id:             { type:String,  required:true },
		readonly:       { type:Boolean, required:true }
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
		capApp:     (s) => s.$store.getters.captions.builder.role,
		capGen:     (s) => s.$store.getters.captions.generic
	}
};