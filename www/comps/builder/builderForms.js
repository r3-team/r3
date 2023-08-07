import {srcBase64} from '../shared/image.js';
export {MyBuilderForms as default};

let MyBuilderForms = {
	name:'my-builder-forms',
	template:`<div class="contentBox grow">
		
		<div class="top lower">
			<div class="area nowrap">
				<img class="icon" src="images/fileText.png" />
				<h1 class="title">{{ capApp.title }}</h1>
			</div>
			<div class="area"></div>
			<div class="area default-inputs">
				<input placeholder="..." v-model="filter" />
			</div>
		</div>
		
		<div class="content default-inputs" v-if="module">
			
			<div class="generic-entry-list">
				<div class="entry"
					v-if="!readonly"
					@click="$emit('createNew','form')"
					:class="{ clickable:!readonly }"
				>
					<div class="row gap centered">
						<img class="icon" src="images/add.png" />
						<span>{{ capGen.button.new }}</span>
					</div>
				</div>
				
				<router-link class="entry clickable"
					v-for="f in module.forms.filter(v => filter === '' || v.name.toLowerCase().includes(filter.toLowerCase()))"
					:key="f.id"
					:to="'/builder/form/'+f.id" 
				>
					<div class="lines">
						<span>{{ f.name }}</span>
						<span class="subtitle" v-if="typeof f.captions.formTitle[builderLanguage] !== 'undefined'">
							[{{ f.captions.formTitle[builderLanguage] }}]
						</span>
					</div>
					<my-button
						v-if="f.iconId !== null"
						:active="false"
						:captionTitle="capGen.icon"
						:imageBase64="srcBase64(iconIdMap[f.iconId].file)"
						:naked="true"
					/>
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
			filter:''
		};
	},
	computed:{
		// simple
		module:(s) => s.moduleIdMap[s.id] === 'undefined' ? false : s.moduleIdMap[s.id],
		
		// stores
		modules:    (s) => s.$store.getters['schema/modules'],
		moduleIdMap:(s) => s.$store.getters['schema/moduleIdMap'],
		formIdMap:  (s) => s.$store.getters['schema/formIdMap'],
		iconIdMap:  (s) => s.$store.getters['schema/iconIdMap'],
		capApp:     (s) => s.$store.getters.captions.builder.form,
		capGen:     (s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		srcBase64
	}
};