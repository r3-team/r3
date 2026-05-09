import {openLink}         from '../shared/generic.js';
import {getCaption}       from '../shared/language.js';
import {lookupReferences} from '../shared/schemaLookup.js';
import srcBase64Icon      from '../shared/image.js';

const MyBuilderSchemaLookupModule = {
	name:'my-builder-schema-lookup-module',
	components:{},
	template:`<div class="builder-schema-lookup-module column">
		<my-label
			:caption="getCaption('moduleTitle',module.id,module.id,module.captions,module.name)"
			:imageBase64="srcBase64Icon(module.iconId,'images/module.png')"
			:large="true"
		/>
		<div class="builder-schema-lookup-module-items">
			<my-button image="api.png"
				v-for="id in lookups.apiIds"
				@trigger="open('api',id,false)"
				@trigger-middle="open('api',id,true)"
				:caption="capGen.api + ': ' + apiIdMap[id].name"
				:naked="true"
			/>
			<my-button image="document.png"
				v-for="id in lookups.docIds"
				@trigger="open('doc',id,false)"
				@trigger-middle="open('doc',id,true)"
				:caption="capGen.pdf + ': ' + docIdMap[id].name"
				:naked="true"
			/>
			<my-button image="codeDatabase.png"
				v-for="id in lookups.pgFunctionIds"
				@trigger="open('pgFunction',id,false)"
				@trigger-middle="open('pgFunction',id,true)"
				:caption="capGen.functionBackend + ': ' + pgFunctionIdMap[id].name"
				:naked="true"
			/>
			<my-button image="search.png"
				v-for="id in lookups.searchBarIds"
				@trigger="open('searchBar',id,false)"
				@trigger-middle="open('searchBar',id,true)"
				:caption="capGen.searchBar + ': ' + searchBarIdMap[id].name"
				:naked="true"
			/>
		</div>
	</div>`,
	props:{
		moduleId:{ type:String, required:true },
		lookups: { type:Object, required:true }
	},
	computed:{
		module:s => s.moduleIdMap[s.moduleId],

		// stores
		apiIdMap:       s => s.$store.getters['schema/apiIdMap'],
		docIdMap:       s => s.$store.getters['schema/docIdMap'],
		moduleIdMap:    s => s.$store.getters['schema/moduleIdMap'],
		pgFunctionIdMap:s => s.$store.getters['schema/pgFunctionIdMap'],
		searchBarIdMap: s => s.$store.getters['schema/searchBarIdMap'],
		capGen:         s => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getCaption,
		openLink,
		srcBase64Icon,

		// actions
		open(entity,entityId,middle) {
			let url = '';
			switch(entity) {
				case 'api':        url = `/builder/api/${entityId}`;         break;
				case 'doc':        url = `/builder/doc/${entityId}`;         break;
				case 'pgFunction': url = `/builder/pg-function/${entityId}`; break;
				case 'searchBar':  url = `/builder/search-bar/${entityId}`;  break;
			}
			if(middle)
				return this.openLink('#'+url,true);
			
			this.$router.push(url);
		}
	}
};

export default {
	name:'my-builder-schema-lookup',
	components:{ MyBuilderSchemaLookupModule },
	template:`<div class="app-sub-window under-header" @mousedown.self="$emit('close')">
		<div class="contentBox builder-schema-lookup float">
			<div class="top lower">
				<div class="area nowrap">
					<img class="icon" src="images/builderLookup.png" />
					<h1 class="title">{{ title }}</h1>
				</div>
				<div class="area">
					<my-button image="cancel.png"
						@trigger="$emit('close')"
						:cancel="true"
					/>
				</div>
			</div>
			<div class="content column gap default-inputs">
				<my-label image="warning.png"
					v-if="!ready"
					:caption="capGen.loading"
					:image="load.gif"
					:large="true"
				/>
				<my-builder-schema-lookup-module
					v-if="ready"
					v-for="(v,k) in moduleIdMapLookups"
					:moduleId="k"
					:lookups="v"
				/>
				<br />
				<br />
				<my-label image="question.png" :caption="capApp.hint.middleClickToTab" />
			</div>
		</div>
	</div>`,
	props:{
		entity:  { type:String, required:true },
		entityId:{ type:String, required:true },
		module:  { type:Object, required:true }
	},
	emits:['close'],
	data() {
		return {
			moduleIdMapLookups:{},
			ready:false
		};
	},
	computed:{
		title:s => {
			switch(s.entity) {
				case 'attribute': return s.capApp.title.replace('{NAME}',s.capGen.attribute); break;
			}
			return '';
		},
		
		// stores
		capApp:s => s.$store.getters.captions.builder.schemaLookup,
		capGen:s => s.$store.getters.captions.generic
	},
	mounted() {
		this.moduleIdMapLookups = this.lookupReferences(this.module,this.entity,this.entityId);
		this.ready = true;
	},
	methods:{
		// externals
		lookupReferences
	}
};