import { getItemTitle } from '../shared/builder.js';
import { getFieldIcon } from '../shared/field.js';
import { getFieldMap } from '../shared/form.js';
import { openLink } from '../shared/generic.js';
import srcBase64Icon from '../shared/image.js';
import { getCaption } from '../shared/language.js';
import { getReferences } from '../shared/schemaLookup.js';

const MyBuilderSchemaLookupModule = {
	name: 'my-builder-schema-lookup-module',
	template: `<div class="builder-schema-lookup-module column">
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
					<tr v-if="lookups.moduleHelpArticles">
						<td class="minimum"><my-label image="question.png" :caption="capGen.helpArticles" /></td>
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
					<tr v-if="lookups.moduleStartForms">
						<td class="minimum"><my-label image="fileText.png" :caption="capGen.formsStart" /></td>
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
					<tr v-if="lookups.moduleMenus">
						<td class="minimum"><my-label image="menu.png" :caption="capGen.menus" /></td>
						<td>
							<div class="row gap wrap">
								<my-button image="open.png"
									@trigger="open('menu',moduleId,null,false)"
									@trigger-middle="open('menu',moduleId,null,true)"
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
					<tr v-if="showPolicies && lookups.relationIdsPolicies.length !== 0">
						<td class="minimum"><my-label image="database.png" :caption="capGen.policies" /></td>
						<td>
							<div class="row gap wrap">
								<my-button image="open.png"
									v-for="id in lookups.relationIdsPolicies"
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
					<tr v-if="showJsFunctions && lookups.jsFunctionIds.length !== 0">
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
					<tr v-if="showPgFunctions && lookups.pgFunctionIds.length !== 0">
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
					<tr v-if="showForms && lookups.formIds.length !== 0">
						<td class="minimum"><my-label image="fileText.png" :caption="capGen.forms" /></td>
						<td>
							<div class="row gap wrap">
								<my-button image="open.png"
									v-for="id in lookups.formIds"
									@trigger="open('form',id,null,false)"
									@trigger-middle="open('form',id,null,true)"
									:caption="formIdMap[id].name"
								/>
							</div>
						</td>
					</tr>
					<tr v-if="showFormQueries && lookups.formIdsQuery.length !== 0">
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
					<tr v-if="showFormActions && lookups.formIdsActions.length !== 0">
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
					<tr v-if="showFormFunctions && lookups.formIdsFunctions.length !== 0">
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
					<tr v-if="showFormFields" v-for="(fieldIds,formId) in lookups.formIdMapFieldIds">
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
					<tr v-if="showFormStates && lookups.formIdsStates.length !== 0">
						<td class="minimum"><my-label image="fileText.png" :caption="capGen.formStates" /></td>
						<td>
							<div class="row gap wrap">
								<my-button image="open.png"
									v-for="id in lookups.formIdsStates"
									@trigger="open('form',id,null,false)"
									@trigger-middle="open('form',id,null,true)"
									:caption="formIdMap[id].name"
								/>
							</div>
						</td>
					</tr>
					<tr v-if="showWidgets && lookups.widgetIds.length !== 0">
						<td class="minimum"><my-label image="tiles.png" :caption="capGen.widgets" /></td>
						<td>
							<div class="row gap wrap">
								<my-button image="open.png"
									v-for="id in lookups.widgetIds"
									@trigger="open('widget',moduleId,id,false)"
									@trigger-middle="open('widget',moduleId,id,true)"
									:caption="widgetIdMap[id].name"
								/>
							</div>
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>`,
	props: {
		moduleId: { type: String, required: true },
		lookups: { type: Object, required: true },
		showApis: { type: Boolean, required: true },
		showCollections: { type: Boolean, required: true },
		showDocs: { type: Boolean, required: true },
		showForms: { type: Boolean, required: true },
		showFormActions: { type: Boolean, required: true },
		showFormFields: { type: Boolean, required: true },
		showFormFunctions: { type: Boolean, required: true },
		showFormQueries: { type: Boolean, required: true },
		showFormStates: { type: Boolean, required: true },
		showJsFunctions: { type: Boolean, required: true },
		showPgFunctions: { type: Boolean, required: true },
		showPgIndex: { type: Boolean, required: true },
		showPgTriggers: { type: Boolean, required: true },
		showPolicies: { type: Boolean, required: true },
		showRelationships: { type: Boolean, required: true },
		showSearchBars: { type: Boolean, required: true },
		showWidgets: { type: Boolean, required: true },
	},
	emits: ['close'],
	data() {
		return {
			show: true
		};
	},
	computed: {
		fieldIdMap: s => {
			let out = {};
			for (const formId in s.lookups.formIdMapFieldIds) {
				out = { ...out, ...s.getFieldMap(s.formIdMap[formId].fields) };
			}
			return out;
		},
		module: s => s.moduleIdMap[s.moduleId],

		// stores
		apiIdMap: s => s.$store.getters['schema/apiIdMap'],
		collectionIdMap: s => s.$store.getters['schema/collectionIdMap'],
		docIdMap: s => s.$store.getters['schema/docIdMap'],
		formIdMap: s => s.$store.getters['schema/formIdMap'],
		indexIdMap: s => s.$store.getters['schema/indexIdMap'],
		jsFunctionIdMap: s => s.$store.getters['schema/jsFunctionIdMap'],
		moduleIdMap: s => s.$store.getters['schema/moduleIdMap'],
		pgFunctionIdMap: s => s.$store.getters['schema/pgFunctionIdMap'],
		pgTriggerIdMap: s => s.$store.getters['schema/pgTriggerIdMap'],
		relationIdMap: s => s.$store.getters['schema/relationIdMap'],
		searchBarIdMap: s => s.$store.getters['schema/searchBarIdMap'],
		widgetIdMap: s => s.$store.getters['schema/widgetIdMap'],
		capGen: s => s.$store.getters.captions.generic,
	},
	methods: {
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
			if (field === undefined)
				return '';

			return field.content !== 'data' ? field.content : this.getItemTitle(field.attributeId, field.index, false, field.attribute_id_nm);
		},

		// actions
		open(entity, entityId, entityIdSub, middle) {
			let url = '';
			switch (entity) {
				case 'api': url = `/builder/api/${entityId}`; break;
				case 'collection': url = `/builder/collection/${entityId}`; break;
				case 'doc': url = `/builder/doc/${entityId}`; break;
				case 'form': url = `/builder/form/${entityId}`; break;
				case 'field': url = `/builder/form/${entityId}?fieldIdShow=${entityIdSub}`; break;
				case 'jsFunction': url = `/builder/js-function/${entityId}`; break;
				case 'menu': url = `/builder/menu/${entityId}`; break;
				case 'module': url = `/builder/module/${entityId}`; break;
				case 'pgFunction': url = `/builder/pg-function/${entityId}`; break;
				case 'relation': url = `/builder/relation/${entityId}`; break;
				case 'searchBar': url = `/builder/search-bar/${entityId}`; break;
				case 'widget': url = `/builder/widgets/${entityId}?widgetIdEdit=${entityIdSub}`; break;
			}
			if (middle)
				return this.openLink(`#${url}`, true);

			this.$router.push(url);
			this.$emit('close');
		}
	}
};

export default {
	name: 'my-builder-schema-lookup',
	components: { MyBuilderSchemaLookupModule },
	template: `<div class="app-sub-window under-header" @mousedown.self="close">
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
				<my-button-check v-if="isAnyApis" v-model="showApis" :caption="capGen.apis" />
				<my-button-check v-if="isAnyCollections" v-model="showCollections" :caption="capGen.collections" />
				<my-button-check v-if="isAnyDocs" v-model="showDocs" :caption="capGen.pdfs" />
				<my-button-check v-if="isAnyForms" v-model="showForms" :caption="capGen.forms" />
				<my-button-check v-if="isAnyFormActions" v-model="showFormActions" :caption="capGen.formActions" />
				<my-button-check v-if="isAnyFormFields" v-model="showFormFields" :caption="capGen.formFields" />
				<my-button-check v-if="isAnyFormFunctions" v-model="showFormFunctions" :caption="capGen.formEvents" />
				<my-button-check v-if="isAnyFormQueries" v-model="showFormQueries" :caption="capGen.formQueries" />
				<my-button-check v-if="isAnyFormStates" v-model="showFormStates" :caption="capGen.formStates" />
				<my-button-check v-if="isAnyJsFunctions" v-model="showJsFunctions" :caption="capGen.functionsFrontend" />
				<my-button-check v-if="isAnyPgFunctions" v-model="showPgFunctions" :caption="capGen.functionsBackend" />
				<my-button-check v-if="isAnyPgIndexes" v-model="showPgIndex" :caption="capGen.indexes" />
				<my-button-check v-if="isAnyPgTriggers" v-model="showPgTriggers" :caption="capGen.triggers" />
				<my-button-check v-if="isAnyRelationPolicies" v-model="showPolicies" :caption="capGen.policies" />
				<my-button-check v-if="isAnyRelationships" v-model="showRelationships" :caption="capGen.relationships" />
				<my-button-check v-if="isAnySearchBars" v-model="showSearchBars" :caption="capGen.searchBars" />
				<my-button-check v-if="isAnyWidgets" v-model="showWidgets" :caption="capGen.widgets" />
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
						:lookups="v"
						:moduleId="k"
						:showApis
						:showCollections
						:showDocs
						:showForms
						:showFormActions
						:showFormFields
						:showFormFunctions
						:showFormQueries
						:showFormStates
						:showJsFunctions
						:showPgFunctions
						:showPgIndex
						:showPgTriggers
						:showPolicies
						:showRelationships
						:showSearchBars
						:showWidgets
					/>
				</template>
			</div>
			<div class="contentBarBottom row gap-large">
				<my-label image="question.png" :caption="capApp.hint.middleClickToTab" />
			</div>
		</div>
	</div>`,
	props: {
		entity: { type: String, required: true }, // entity for lookup (relation, attribute, jsFunction, ...)
		entityId: { type: String, required: true },
		module: { type: Object, required: true },
		noDependencies: { type: Boolean, required: false, default: false },
		warningMsg: { type: [String, null], required: true }
	},
	emits: ['close'],
	data() {
		return {
			fullscreen: false,
			moduleIdMapLookups: {},
			ready: false,
			showApis: true,
			showCollections: true,
			showDocs: true,
			showForms: true,
			showFormActions: true,
			showFormFields: true,
			showFormFunctions: true,
			showFormQueries: true,
			showFormStates: true,
			showJsFunctions: true,
			showPgFunctions: true,
			showPgIndex: true,
			showPgTriggers: true,
			showPolicies: true,
			showRelationships: true,
			showSearchBars: true,
			showWidgets: true,
		};
	},
	computed: {
		title: s => {
			let contentName = '';
			let entityName = null;
			switch (s.entity) {
				case 'article':
					contentName = s.capGen.helpArticle;
					entityName = s.articleIdMap[s.entityId].name;
					break;
				case 'attribute':
					contentName = s.capGen.attribute;
					entityName = s.attributeIdMap[s.entityId].name;
					break;
				case 'collection':
					contentName = s.capGen.collection;
					entityName = s.collectionIdMap[s.entityId].name;
					break;
				case 'doc':
					contentName = s.capGen.document;
					entityName = s.docIdMap[s.entityId].name;
					break;
				case 'form':
					contentName = s.capGen.form;
					entityName = s.formIdMap[s.entityId].name;
					break;
				case 'jsFunction':
					contentName = s.capGen.functionFrontend;
					entityName = s.jsFunctionIdMap[s.entityId].name;
					break;
				case 'pgFunction':
					contentName = s.capGen.functionBackend;
					entityName = s.pgFunctionIdMap[s.entityId].name;
					break;
				case 'pgIndex':
					contentName = s.capGen.index;
					break;
				case 'relation':
					contentName = s.capGen.relation;
					entityName = s.relationIdMap[s.entityId].name;
					break;
			}
			return entityName === null
				? `${s.capApp.title.replace('{NAME}', contentName)}`
				: `${s.capApp.title.replace('{NAME}', contentName)} '${entityName}'`;
		},

		// simple
		isAnyApis: s => Object.values(s.moduleIdMapLookups).some(v => v.apiIds.length !== 0),
		isAnyCollections: s => Object.values(s.moduleIdMapLookups).some(v => v.collectionIds.length !== 0),
		isAnyDocs: s => Object.values(s.moduleIdMapLookups).some(v => v.docIds.length !== 0),
		isAnyForms: s => Object.values(s.moduleIdMapLookups).some(v => v.formIds.length !== 0),
		isAnyFormActions: s => Object.values(s.moduleIdMapLookups).some(v => v.formIdsActions.length !== 0),
		isAnyFormFunctions: s => Object.values(s.moduleIdMapLookups).some(v => v.formIdsFunctions.length !== 0),
		isAnyFormQueries: s => Object.values(s.moduleIdMapLookups).some(v => v.formIdsQuery.length !== 0),
		isAnyFormFields: s => Object.values(s.moduleIdMapLookups).some(v => Object.keys(v.formIdMapFieldIds).length !== 0),
		isAnyFormStates: s => Object.values(s.moduleIdMapLookups).some(v => v.formIdsStates.length !== 0),
		isAnyJsFunctions: s => Object.values(s.moduleIdMapLookups).some(v => v.jsFunctionIds.length !== 0),
		isAnyPgFunctions: s => Object.values(s.moduleIdMapLookups).some(v => v.pgFunctionIds.length !== 0),
		isAnyPgIndexes: s => Object.values(s.moduleIdMapLookups).some(v => v.pgIndexIds.length !== 0),
		isAnyPgTriggers: s => Object.values(s.moduleIdMapLookups).some(v => v.pgTriggerIds.length !== 0),
		isAnyRelationPolicies: s => Object.values(s.moduleIdMapLookups).some(v => v.relationIdsPolicies.length !== 0),
		isAnyRelationships: s => Object.values(s.moduleIdMapLookups).some(v => v.relationIdsShips.length !== 0),
		isAnySearchBars: s => Object.values(s.moduleIdMapLookups).some(v => v.searchBarIds.length !== 0),
		isAnyWidgets: s => Object.values(s.moduleIdMapLookups).some(v => v.widgetIds.length !== 0),
		noResults: s => Object.keys(s.moduleIdMapLookups).length === 0,

		// stores
		capApp: s => s.$store.getters.captions.builder.schemaLookup,
		capGen: s => s.$store.getters.captions.generic,
		articleIdMap: s => s.$store.getters['schema/articleIdMap'],
		attributeIdMap: s => s.$store.getters['schema/attributeIdMap'],
		collectionIdMap: s => s.$store.getters['schema/collectionIdMap'],
		docIdMap: s => s.$store.getters['schema/docIdMap'],
		formIdMap: s => s.$store.getters['schema/formIdMap'],
		jsFunctionIdMap: s => s.$store.getters['schema/jsFunctionIdMap'],
		pgFunctionIdMap: s => s.$store.getters['schema/pgFunctionIdMap'],
		relationIdMap: s => s.$store.getters['schema/relationIdMap'],
	},
	mounted() {
		this.refresh();

		this.$store.commit('keyDownHandlerSleep');
		this.$store.commit('keyDownHandlerAdd', { fnc: this.close, key: 'Escape' });
	},
	unmounted() {
		this.$store.commit('keyDownHandlerDel', this.close);
		this.$store.commit('keyDownHandlerWake');
	},
	methods: {
		// actions
		close() {
			this.$emit('close');
		},
		refresh() {
			this.ready = false;
			this.moduleIdMapLookups = getReferences(this.module, this.entity, this.entityId, this.noDependencies);
			this.ready = true;
		}
	}
};
