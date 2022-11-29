export {MyBuilderPgFunctions as default};

let MyBuilderPgFunctions = {
	name:'my-builder-pg-functions',
	template:`<div class="contentBox grow builder-functions">
		
		<div class="top lower">
			<div class="area nowrap">
				<img class="icon" src="images/codeDatabase.png" />
				<h1 class="title">{{ capApp.titlePg }}</h1>
			</div>
			<div class="area default-inputs">
				<input v-model="filter" placeholder="..." />
			</div>
		</div>
		
		<div class="content" v-if="module">
			<div class="builder-entry-list">
				<div class="entry"
					@click="$emit('createNew',readonly ? null : 'pgFunction')"
					:class="{ clickable:!readonly, off:readonly }"
				>
					<div class="row gap centered">
						<img class="icon" src="images/add.png" />
						<span>{{ capGen.button.new }}</span>
					</div>
				</div>
				
				<router-link class="entry clickable"
					v-for="f in module.pgFunctions.filter(v => filter === '' || v.name.toLowerCase().includes(filter.toLowerCase()))"
					:key="f.id"
					:to="'/builder/pg-function/'+f.id" 
				>
					<div class="lines">
						<span>{{ f.name }}</span>
						<span class="subtitle" v-if="typeof f.captions.pgFunctionTitle[builderLanguage] !== 'undefined'">
							[{{ f.captions.pgFunctionTitle[builderLanguage] }}]
						</span>
					</div>
					<div class="row">
						<my-button image="databaseCog.png"
							v-if="f.isTrigger"
							:active="false"
							:captionTitle="capApp.isTrigger"
							:naked="true"
							:tight="true"
						/>
						<my-button image="screen.png"
							v-if="f.isFrontendExec"
							:active="false"
							:captionTitle="capApp.isFrontendExec"
							:naked="true"
							:tight="true"
						/>
						<my-button image="time.png"
							v-if="f.schedules.length !== 0"
							:active="false"
							:captionTitle="capApp.schedules"
							:naked="true"
							:tight="true"
						/>
					</div>
				</router-link>
			</div>
		</div>
	</div>`,
	emits:['createNew'],
	props:{
		builderLanguage:{ type:String,  required:true },
		id:             { type:String,  required:true },
		readonly:       { type:Boolean, required:true }
	},
	data:function() {
		return {
			filter:''
		};
	},
	computed:{
		// stores
		module:     (s) => typeof s.moduleIdMap[s.id] === 'undefined' ? false : s.moduleIdMap[s.id],
		moduleIdMap:(s) => s.$store.getters['schema/moduleIdMap'],
		capApp:     (s) => s.$store.getters.captions.builder.function,
		capGen:     (s) => s.$store.getters.captions.generic
	}
};