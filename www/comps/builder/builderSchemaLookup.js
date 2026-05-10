import {getItemTitle}  from '../shared/builder.js';
import {getFieldIcon}  from '../shared/field.js';
import {getFieldMap}   from '../shared/form.js';
import {openLink}      from '../shared/generic.js';
import {getCaption}    from '../shared/language.js';
import {getReferences} from '../shared/schemaLookup.js';
import srcBase64Icon   from '../shared/image.js';

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
			<table class="generic-table bright">
				<tbody>
					<tr v-if="lookups.moduleClientEvents">
						<td class="minimum"><my-label image="screen.png" :caption="capGen.clientEvents" /></td>
						<td>
							<div class="row gap wrap">
								<my-button image="open.png"
									@trigger="open('module',moduleId,null,false)"
									@trigger-middle="open('module',moduleId,null,true)"
									:caption="moduleIdMap[moduleId].name"
								/>
							</div>
						</td>
					</tr>
					<tr v-if="lookups.moduleFncOnLogin">
						<td class="minimum"><my-label image="person.png" :caption="capGen.sessionStart" /></td>
						<td>
							<div class="row gap wrap">
								<my-button image="open.png"
									@trigger="open('module',moduleId,null,false)"
									@trigger-middle="open('module',moduleId,null,true)"
									:caption="moduleIdMap[moduleId].name"
								/>
							</div>
						</td>
					</tr>
					<tr v-if="lookups.moduleFncLoginSync">
						<td class="minimum"><my-label image="personArrow.png" :caption="capGen.userSync" /></td>
						<td>
							<div class="row gap wrap">
								<my-button image="open.png"
									@trigger="open('module',moduleId,null,false)"
									@trigger-middle="open('module',moduleId,null,true)"
									:caption="moduleIdMap[moduleId].name"
								/>
							</div>
						</td>
					</tr>
					<tr v-if="showRelationships && lookups.relationIdsShips.length !== 0">
						<td class="minimum"><my-label image="database.png" :caption="capGen.relationships" /></td>
						<td>
							<div class="row gap wrap">
								<my-button image="open.png"
									v-for="id in lookups.relationIdsShips"
									@trigger="open('relation',id,null,false)"
									@trigger-middle="open('relation',id,null,true)"
									:caption="relationIdMap[id].name"
								/>
							</div>
						</td>
					</tr>
					<tr v-if="showApis && lookups.apiIds.length !== 0">
						<td class="minimum"><my-label image="api.png" :caption="capGen.apis" /></td>
						<td>
							<div class="row gap wrap">
								<my-button image="open.png"
									v-for="id in lookups.apiIds"
									@trigger="open('api',id,null,false)"
									@trigger-middle="open('api',id,null,true)"
									:caption="apiIdMap[id].name"
								/>
							</div>
						</td>
					</tr>
					<tr v-if="showDocs && lookups.docIds.length !== 0">
						<td class="minimum"><my-label image="document.png" :caption="capGen.pdfs" /></td>
						<td>
							<div class="row gap wrap">
								<my-button image="open.png"
									v-for="id in lookups.docIds"
									@trigger="open('doc',id,null,false)"
									@trigger-middle="open('doc',id,null,true)"
									:caption="docIdMap[id].name"
								/>
							</div>
						</td>
					</tr>
					<tr v-if="showFunctions && lookups.jsFunctionIds.length !== 0">
						<td class="minimum"><my-label image="codeScreen.png" :caption="capGen.functionsFrontend" /></td>
						<td>
							<div class="row gap wrap">
								<my-button image="open.png"
									v-for="id in lookups.jsFunctionIds"
									@trigger="open('jsFunction',id,null,false)"
									@trigger-middle="open('jsFunction',id,null,true)"
									:caption="jsFunctionIdMap[id].name"
								/>
							</div>
						</td>
					</tr>
					<tr v-if="showFunctions && lookups.pgFunctionIds.length !== 0">
						<td class="minimum"><my-label image="codeDatabase.png" :caption="capGen.functionsBackend" /></td>
						<td>
							<div class="row gap wrap">
								<my-button image="open.png"
									v-for="id in lookups.pgFunctionIds"
									@trigger="open('pgFunction',id,null,false)"
									@trigger-middle="open('pgFunction',id,null,true)"
									:caption="pgFunctionIdMap[id].name"
								/>
							</div>
						</td>
					</tr>
					<tr v-if="showPgIndex && lookups.pgIndexIds.length !== 0">
						<td class="minimum"><my-label image="databaseAsterisk.png" :caption="capGen.indexes" /></td>
						<td>
							<div class="row gap wrap">
								<my-button image="open.png"
									v-for="id in lookups.pgIndexIds"
									@trigger="open('relation',indexIdMap[id].relationId,null,false)"
									@trigger-middle="open('relation',indexIdMap[id].relationId,null,true)"
									:caption="relationIdMap[indexIdMap[id].relationId].name"
								/>
							</div>
						</td>
					</tr>
					<tr v-if="showPgTriggers && lookups.pgTriggerIds.length !== 0">
						<td class="minimum"><my-label image="databasePlay.png" :caption="capGen.triggers" /></td>
						<td>
							<div class="row gap wrap">
								<my-button image="open.png"
									v-for="id in lookups.pgTriggerIds"
									@trigger="open('relation',pgTriggerIdMap[id].relationId,null,false)"
									@trigger-middle="open('relation',pgTriggerIdMap[id].relationId,null,true)"
									:caption="relationIdMap[pgTriggerIdMap[id].relationId].name"
								/>
							</div>
						</td>
					</tr>
					<tr v-if="showCollections && lookups.collectionIds.length !== 0">
						<td class="minimum"><my-label image="tray.png" :caption="capGen.collections" /></td>
						<td>
							<div class="row gap wrap">
								<my-button image="open.png"
									v-for="id in lookups.collectionIds"
									@trigger="open('collection',id,null,false)"
									@trigger-middle="open('collection',id,null,true)"
									:caption="collectionIdMap[id].name"
								/>
							</div>
						</td>
					</tr>
					<tr v-if="showSearchBars && lookups.searchBarIds.length !== 0">
						<td class="minimum"><my-label image="search.png" :caption="capGen.searchBars" /></td>
						<td>
							<div class="row gap wrap">
								<my-button image="open.png"
									v-for="id in lookups.searchBarIds"
									@trigger="open('searchBar',id,null,false)"
									@trigger-middle="open('searchBar',id,null,true)"
									:caption="searchBarIdMap[id].name"
								/>
							</div>
						</td>
					</tr>
					<tr v-if="showForms && lookups.formIdsQuery.length !== 0">
						<td class="minimum"><my-label image="fileText.png" :caption="capGen.formQueries" /></td>
						<td>
							<div class="row gap wrap">
								<my-button image="open.png"
									v-for="id in lookups.formIdsQuery"
									@trigger="open('form',id,null,false)"
									@trigger-middle="open('form',id,null,true)"
									:caption="formIdMap[id].name"
								/>
							</div>
						</td>
					</tr>
					<tr v-if="showForms && lookups.formIdsActions.length !== 0">
						<td class="minimum"><my-label image="fileText.png" :caption="capGen.formActions" /></td>
						<td>
							<div class="row gap wrap">
								<my-button image="open.png"
									v-for="id in lookups.formIdsActions"
									@trigger="open('form',id,null,false)"
									@trigger-middle="open('form',id,null,true)"
									:caption="formIdMap[id].name"
								/>
							</div>
						</td>
					</tr>
					<tr v-if="showForms && lookups.formIdsFunctions.length !== 0">
						<td class="minimum"><my-label image="fileText.png" :caption="capGen.formEvents" /></td>
						<td>
							<div class="row gap wrap">
								<my-button image="open.png"
									v-for="id in lookups.formIdsFunctions"
									@trigger="open('form',id,null,false)"
									@trigger-middle="open('form',id,null,true)"
									:caption="formIdMap[id].name"
								/>
							</div>
						</td>
					</tr>
					<tr v-if="showFields" v-for="(fieldIds,formId) in lookups.formIdMapFieldIds">
						<td class="minimum"><my-label image="fileText.png" :caption="capGen.formFields + ': ' + formIdMap[formId].name" /></td>
						<td>
							<div class="row gap wrap">
								<my-button image="open.png"
									v-for="id in fieldIds"
									@trigger="open('field',formId,id,false)"
									@trigger-middle="open('field',formId,id,true)"
									:caption="getFieldLabel(id)"
									:image="getFieldImage(id)"
								/>
							</div>
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>`,
	props:{
		moduleId:         { type:String,  required:true },
		lookups:          { type:Object,  required:true },
		showApis:         { type:Boolean, required:true },
		showCollections:  { type:Boolean, required:true },
		showDocs:         { type:Boolean, required:true },
		showFields:       { type:Boolean, required:true },
		showForms:        { type:Boolean, required:true },
		showFunctions:    { type:Boolean, required:true },
		showPgIndex:      { type:Boolean, required:true },
		showPgTriggers:   { type:Boolean, required:true },
		showRelationships:{ type:Boolean, required:true },
		showSearchBars:   { type:Boolean, required:true }
	},
	emits:['close'],
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
		jsFunctionIdMap:s => s.$store.getters['schema/jsFunctionIdMap'],
		moduleIdMap:    s => s.$store.getters['schema/moduleIdMap'],
		pgFunctionIdMap:s => s.$store.getters['schema/pgFunctionIdMap'],
		pgTriggerIdMap: s => s.$store.getters['schema/pgTriggerIdMap'],
		relationIdMap:  s => s.$store.getters['schema/relationIdMap'],
		searchBarIdMap: s => s.$store.getters['schema/searchBarIdMap'],
		capGen:         s => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getCaption,
		getFieldIcon,
		getFieldMap,
		getItemTitle,
		openLink,
		srcBase64Icon,

		// presentation
		getFieldImage(fieldId) {
			const field = this.fieldIdMap[fieldId];
			return field === undefined ? '' : this.getFieldIcon(field);
		},
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
				case 'jsFunction': url = `/builder/js-function/${entityId}`; break;
				case 'module':     url = `/builder/module/${entityId}`; break;
				case 'pgFunction': url = `/builder/pg-function/${entityId}`; break;
				case 'relation':   url = `/builder/relation/${entityId}`; break;
				case 'searchBar':  url = `/builder/search-bar/${entityId}`; break;
			}
			if(middle)
				return this.openLink('#'+url,true);
			
			this.$router.push(url);
			this.$emit('close');
		}
	}
};

export default {
	name:'my-builder-schema-lookup',
	components:{ MyBuilderSchemaLookupModule },
	template:`<div class="app-sub-window under-header" @mousedown.self="close">
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
						@trigger="close"
						:cancel="true"
					/>
				</div>
			</div>
			<div class="contentBarTop row wrap gap-large justify-end">
				<my-button-check v-model="showApis"          :caption="capGen.apis" />
				<my-button-check v-model="showCollections"   :caption="capGen.collections" />
				<my-button-check v-model="showDocs"          :caption="capGen.pdfs" />
				<my-button-check v-model="showForms"         :caption="capGen.forms" />
				<my-button-check v-model="showFields"        :caption="capGen.formFields" />
				<my-button-check v-model="showFunctions"     :caption="capGen.functions" />
				<my-button-check v-model="showPgIndex"       :caption="capGen.indexes" />
				<my-button-check v-model="showPgTriggers"    :caption="capGen.triggers" />
				<my-button-check v-model="showRelationships" :caption="capGen.relationships" />
				<my-button-check v-model="showSearchBars"    :caption="capGen.searchBars" />
			</div>
			<div class="content column scroll grow default-inputs">
				<my-label image="load.gif"
					v-if="!ready"
					:caption="capGen.loading"
					:large="true"
				/>
				<template v-if="ready">
					<my-label
						v-if="noResults"
						:caption="capGen.nothingThere"
						:large="true"
					/>
					<my-label image="warning.png"
						v-if="!noResults && warningMsg !== null"
						:caption="warningMsg"
						:error="true"
						:large="true"
					/>
					<my-builder-schema-lookup-module
						v-for="(v,k) in moduleIdMapLookups"
						@close="close"
						:moduleId="k"
						:lookups="v"
						:showApis
						:showCollections
						:showDocs
						:showFields
						:showForms
						:showFunctions
						:showPgIndex
						:showPgTriggers
						:showRelationships
						:showSearchBars
					/>
				</template>
			</div>
			<div class="contentBarBottom row gap-large">
				<my-label image="question.png" :caption="capApp.hint.middleClickToTab" />
			</div>
		</div>
	</div>`,
	props:{
		entity:    { type:String,        required:true },
		entityId:  { type:String,        required:true },
		entityName:{ type:String,        required:true },
		module:    { type:Object,        required:true },
		warningMsg:{ type:[String,null], required:true }
	},
	emits:['close'],
	data() {
		return {
			fullscreen:false,
			moduleIdMapLookups:{},
			ready:false,
			showApis:true,
			showCollections:true,
			showDocs:true,
			showFields:true,
			showForms:true,
			showFunctions:true,
			showPgIndex:true,
			showPgTriggers:true,
			showRelationships:true,
			showSearchBars:true
		};
	},
	computed:{
		noResults:s => Object.keys(s.moduleIdMapLookups).length === 0,
		title:s => {
			let contentName = '';
			switch(s.entity) {
				case 'attribute':  contentName = s.capGen.attribute;        break;
				case 'jsFunction': contentName = s.capGen.functionFrontend; break;
				case 'pgFunction': contentName = s.capGen.functionBackend;  break;
				case 'relation':   contentName = s.capGen.relation;         break;
			}
			return `${s.capApp.title.replace('{NAME}',contentName)} '${s.entityName}'`;
		},
		
		// stores
		capApp:s => s.$store.getters.captions.builder.schemaLookup,
		capGen:s => s.$store.getters.captions.generic
	},
	mounted() {
		this.refresh();
		
		this.$store.commit('keyDownHandlerSleep');
		this.$store.commit('keyDownHandlerAdd',{fnc:this.close,key:'Escape'});
	},
	unmounted() {
		this.$store.commit('keyDownHandlerDel',this.close);
		this.$store.commit('keyDownHandlerWake');
	},
	methods:{
		// externals
		getReferences,

		// actions
		close() {
			this.$emit('close');
		},
		refresh() {
			this.ready = false;
			this.moduleIdMapLookups = this.getReferences(this.module,this.entity,this.entityId);
			this.ready = true;
		}
	}
};