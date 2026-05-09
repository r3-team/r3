import {getItemTitle}     from '../shared/builder.js';
import {getFieldMap}      from '../shared/form.js';
import {openLink}         from '../shared/generic.js';
import {getCaption}       from '../shared/language.js';
import {lookupReferences} from '../shared/schemaLookup.js';
import srcBase64Icon      from '../shared/image.js';

const MyBuilderSchemaLookupModule = {
	name:'my-builder-schema-lookup-module',
	components:{},
	template:`<div class="builder-schema-lookup-module column">
		<div class="row centered gap">
			<my-label :imageBase64="srcBase64Icon(module.iconId,'images/module.png')" :large="true" />
			<my-button
				@trigger="show = !show"
				:caption="getCaption('moduleTitle',module.id,module.id,module.captions,module.name)"
				:image="show ? 'triangleDown.png' : 'triangleRight.png'"
				:large="true"
				:naked="true"
			/>
		</div>
		<div class="builder-schema-lookup-module-items" v-if="show">
			<my-button image="api.png"
				v-for="id in lookups.apiIds"
				@trigger="open('api',id,null,false)"
				@trigger-middle="open('api',id,null,true)"
				:caption="capGen.api + ': ' + apiIdMap[id].name"
				:naked="true"
			/>
			<my-button image="document.png"
				v-for="id in lookups.docIds"
				@trigger="open('doc',id,null,false)"
				@trigger-middle="open('doc',id,null,true)"
				:caption="capGen.pdf + ': ' + docIdMap[id].name"
				:naked="true"
			/>
			<my-button image="codeDatabase.png"
				v-for="id in lookups.pgFunctionIds"
				@trigger="open('pgFunction',id,null,false)"
				@trigger-middle="open('pgFunction',id,null,true)"
				:caption="capGen.functionBackend + ': ' + pgFunctionIdMap[id].name"
				:naked="true"
			/>
			<my-button image="databaseAsterisk.png"
				v-for="id in lookups.pgIndexIds"
				@trigger="open('pgIndex',indexIdMap[id].relationId,null,false)"
				@trigger-middle="open('pgIndex',indexIdMap[id].relationId,null,true)"
				:caption="capGen.index + ': ' + relationIdMap[indexIdMap[id].relationId].name"
				:naked="true"
			/>
			<my-button image="tray.png"
				v-for="id in lookups.collectionIds"
				@trigger="open('collection',id,null,false)"
				@trigger-middle="open('collection',id,null,true)"
				:caption="capGen.collection + ': ' + collectionIdMap[id].name"
				:naked="true"
			/>
			<my-button image="search.png"
				v-for="id in lookups.searchBarIds"
				@trigger="open('searchBar',id,null,false)"
				@trigger-middle="open('searchBar',id,null,true)"
				:caption="capGen.searchBar + ': ' + searchBarIdMap[id].name"
				:naked="true"
			/>
			<my-button image="fileText.png"
				v-for="id in lookups.formIds"
				@trigger="open('form',id,null,false)"
				@trigger-middle="open('form',id,null,true)"
				:caption="capGen.form + ': ' + formIdMap[id].name"
				:naked="true"
			/>
			<template v-for="(fieldIds,formId) in lookups.formIdMapFieldIds">
				<my-button image="fileText.png"
					v-for="id in fieldIds"
					@trigger="open('field',formId,id,false)"
					@trigger-middle="open('field',formId,id,true)"
					:caption="capGen.form + ': ' + formIdMap[formId].name + ', ' + getFieldLabel(id)"
					:naked="true"
				/>
			</template>
		</div>
	</div>`,
	props:{
		moduleId:{ type:String, required:true },
		lookups: { type:Object, required:true }
	},
	data() {
		return {
			show:true
		};
	},
	computed:{
		fieldIdMap:s => {
			let out = {};
			for(const formId in s.lookups.formIdMapFieldIds) {
				out = { ...out, ...s.getFieldMap(s.formIdMap[formId].fields)};
			}
			return out;
		},
		module:s => s.moduleIdMap[s.moduleId],

		// stores
		apiIdMap:       s => s.$store.getters['schema/apiIdMap'],
		collectionIdMap:s => s.$store.getters['schema/collectionIdMap'],
		docIdMap:       s => s.$store.getters['schema/docIdMap'],
		formIdMap:      s => s.$store.getters['schema/formIdMap'],
		indexIdMap:     s => s.$store.getters['schema/indexIdMap'],
		moduleIdMap:    s => s.$store.getters['schema/moduleIdMap'],
		pgFunctionIdMap:s => s.$store.getters['schema/pgFunctionIdMap'],
		relationIdMap:  s => s.$store.getters['schema/relationIdMap'],
		searchBarIdMap: s => s.$store.getters['schema/searchBarIdMap'],
		capGen:         s => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getCaption,
		getFieldMap,
		getItemTitle,
		openLink,
		srcBase64Icon,

		// presentation
		getFieldLabel(fieldId) {
			const field = this.fieldIdMap[fieldId];
			if(field === undefined)
				return '';

			return field.content !== 'data' ? field.content : this.getItemTitle(field.attributeId,field.index,false,field.attribute_id_nm);
		},

		// actions
		open(entity,entityId,entityIdSub,middle) {
			let url = '';
			switch(entity) {
				case 'api':        url = `/builder/api/${entityId}`; break;
				case 'collection': url = `/builder/collection/${entityId}`; break;
				case 'doc':        url = `/builder/doc/${entityId}`; break;
				case 'form':       url = `/builder/form/${entityId}`; break;
				case 'field':      url = `/builder/form/${entityId}?fieldIdShow=${entityIdSub}`; break;
				case 'pgFunction': url = `/builder/pg-function/${entityId}`; break;
				case 'pgIndex':    url = `/builder/relation/${entityId}`; break;
				case 'searchBar':  url = `/builder/search-bar/${entityId}`; break;
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
		<div class="contentBox builder-schema-lookup float" :class="{ fullscreen }">
			<div class="top lower">
				<div class="area nowrap">
					<img class="icon" src="images/builderLookup.png" />
					<h1 class="title">{{ title }}</h1>
				</div>
				<div class="area">
					<my-button image="refresh.png"
						@trigger="refresh"
						:caption="capGen.button.refresh"
					/>
					<my-button
						@trigger="fullscreen = !fullscreen"
						:captionTitle="capGen.fullscreenSwitchTo"
						:image="fullscreen ? 'shrink.png' : 'expand.png'"
					/>
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
		entity:    { type:String, required:true },
		entityId:  { type:String, required:true },
		entityName:{ type:String, required:true },
		module:    { type:Object, required:true }
	},
	emits:['close'],
	data() {
		return {
			fullscreen:false,
			moduleIdMapLookups:{},
			ready:false
		};
	},
	computed:{
		title:s => {
			let contentName = '';
			switch(s.entity) {
				case 'attribute': contentName = s.capGen.attribute; break;
			}
			return `${s.capApp.title.replace('{NAME}',contentName)} '${s.entityName}'`;
		},
		
		// stores
		capApp:s => s.$store.getters.captions.builder.schemaLookup,
		capGen:s => s.$store.getters.captions.generic
	},
	mounted() {
		this.refresh();
	},
	methods:{
		// externals
		lookupReferences,

		// actions
		refresh() {
			this.ready = false;
			this.moduleIdMapLookups = this.lookupReferences(this.module,this.entity,this.entityId);
			this.ready = true;
		}
	}
};