import {getJsFunctionsProcessed} from '../shared/builder.js';
export {MyBuilderJsFunctions as default};

let MyBuilderJsFunctions = {
	name:'my-builder-js-functions',
	template:`<div class="contentBox grow builder-functions">
		
		<div class="top lower">
			<div class="area nowrap">
				<img class="icon" src="images/codeScreen.png" />
				<h1 class="title">{{ capApp.titleJs }}</h1>
			</div>
			<div class="area default-inputs">
				<input v-model="filter" placeholder="..." />
			</div>
		</div>
		
		<div class="content" v-if="module">
			<div class="generic-entry-list">
				<div class="entry"
					v-if="!readonly"
					@click="$emit('createNew','jsFunction')"
					:class="{ clickable:!readonly }"
				>
					<div class="row gap centered">
						<img class="icon" src="images/add.png" />
						<span>{{ capGen.button.new }}</span>
					</div>
				</div>
				
				<router-link class="entry clickable"
					v-for="f in jsFunctions"
					:key="f.id"
					:to="'/builder/js-function/'+f.id" 
				>
					<div class="lines">
						<span v-if="f.formId === null">{{ f.name }}</span>
						<span v-if="f.formId !== null"><b>{{ formIdMap[f.formId].name }}:</b> {{ f.name }}</span>
						<span class="subtitle" v-if="typeof f.captions.jsFunctionTitle[builderLanguage] !== 'undefined'">
							[{{ f.captions.jsFunctionTitle[builderLanguage] }}]
						</span>
					</div>
					<div class="row">
						<my-button image="fileText.png"
							v-if="f.formId !== null"
							:active="false"
							:captionTitle="capApp.form"
							:naked="true"
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
	data() {
		return {
			filter:''
		};
	},
	computed:{
		jsFunctions:(s) => s.getJsFunctionsProcessed(s.module.jsFunctions,s.filter),
		
		// stores
		module:     (s) => typeof s.moduleIdMap[s.id] === 'undefined' ? false : s.moduleIdMap[s.id],
		moduleIdMap:(s) => s.$store.getters['schema/moduleIdMap'],
		formIdMap:  (s) => s.$store.getters['schema/formIdMap'],
		capApp:     (s) => s.$store.getters.captions.builder.function,
		capGen:     (s) => s.$store.getters.captions.generic
	},
	methods:{
		// external
		getJsFunctionsProcessed
	}
};