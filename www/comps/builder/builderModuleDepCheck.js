import { getHasAnyReferences } from '../shared/schemaLookup.js';
import MyBuilderSchemaLookup from './builderSchemaLookup.js';

export default {
	name: 'my-builder-module-dep-check',
	components: { MyBuilderSchemaLookup },
	template: `<div class="app-sub-window under-header" @mousedown.self="$emit('close')">
		<div class="contentBox builder-module-dep-check float">
			<div class="top lower">
				<div class="area nowrap">
					<img class="icon" src="images/builderLookup.png" />
					<h1 class="title">{{ capApp.referenceCheck }}</h1>
				</div>
				<div class="area">
					<my-button image="refresh.png"
						@trigger="exec"
						:active="!isRunning"
						:caption="capGen.button.refresh"
					/>
					<my-button image="cancel.png"
						@trigger="$emit('close')"
						:cancel="true"
					/>
				</div>
			</div>

			<div class="content flex column gap default-inputs">
				<!-- progress -->
				<my-label
					v-if="isRunning || entityIdFinding !== null"
					:caption="progressMsg"
					:image="isRunning ? 'load.gif' : 'circle_question.png'"
				/>

				<!-- results -->
				<div class="row gap centered" v-if="!isRunning && !isNoDependencies">
					<my-label image="warning.png"
						:caption="capApp.referencesFound"
					/>
					<my-button image="open.png"
						@trigger="isShowLookup = true"
						:caption="capGen.button.show"
					/>
				</div>
				<my-label image="ok.png"
					v-if="isNoDependencies"
					:caption="capApp.referencesNone"
				/>

				<!-- actions -->
				<div class="row space-between gap-large">
					<my-button image="delete.png"
						v-if="!isRunning && isNoDependencies"
						@trigger="$emit('confirm')"
						:caption="capApp.button.dependencyRemove"
					/>
				</div>
			</div>
		</div>

		<my-builder-schema-lookup
			v-if="isShowLookup && entityIdFinding !== null"
			@close="isShowLookup = false"
			:entity="entityCheck"
			:entityId="entityIdFinding"
			:module="moduleSource"
			:noDependencies="true"
			:warningMsg="null"
		/>
	</div>`,
	props: {
		moduleIdParent: { type: String, required: true }, // ID of parent module, to be checked for dependencies of source module
		moduleIdSource: { type: String, required: true }, // ID of source module, to be checked for dependencies in parent
	},
	emits: ['close', 'confirm'],
	data() {
		return {
			entityIdFinding: null, // ID of entity found to still have dependency
			entityCheck: null, // entity being checked ('relation', 'attribute', ...)
			entityTitle: '', // name of entity being checked
			entityList: [], // list of entity elements in parent module (relations, attributes, ...)
			entitiesCheck: [  // list of entities to be checked in order
				'relation', 'attribute', 'pgFunction', 'pgIndex', 'jsFunction', 'doc'
			],

			// progress
			countChecked: 0,
			isRunning: false,
			isShowLookup: false,
		};
	},
	computed: {
		isNoDependencies: s => s.entityIdFinding === null,
		progressMsg: s => `${s.capGen.checking}: ${s.entityTitle} (${s.countChecked}/${s.entityList.length})`,
		moduleParent: s => s.moduleIdMap[s.moduleIdParent],
		moduleSource: s => s.moduleIdMap[s.moduleIdSource],

		// stores
		moduleIdMap: s => s.$store.getters['schema/moduleIdMap'],
		capApp: s => s.$store.getters.captions.builder.module,
		capGen: s => s.$store.getters.captions.generic
	},
	mounted() {
		this.exec();
	},
	methods: {
		// externals
		getHasAnyReferences,

		// actions
		exec() {
			this.entityIdFinding = null;
			this.isRunning = true;

			for (const entity of this.entitiesCheck) {
				this.entityCheck = entity;
				this.countChecked = 0;

				switch (entity) {
					case 'attribute':
						this.entityTitle = this.capGen.attribute;
						this.entityList = [];
						for (const r of this.moduleParent.relations) {
							this.entityList = this.entityList.concat(r.attributes);
						}
						break;
					case 'doc':
						this.entityTitle = this.capGen.document;
						this.entityList = this.moduleParent.docs;
						break;
					case 'jsFunction':
						this.entityTitle = this.capGen.functionFrontend;
						this.entityList = this.moduleParent.jsFunctions;
						break;
					case 'pgFunction':
						this.entityTitle = this.capGen.functionBackend;
						this.entityList = this.moduleParent.pgFunctions;
						break;
					case 'pgIndex':
						this.entityTitle = this.capGen.index;
						this.entityList = [];
						for (const r of this.moduleParent.relations) {
							this.entityList = this.entityList.concat(r.indexes);
						}
						break;
					case 'relation':
						this.entityTitle = this.capGen.relation;
						this.entityList = this.moduleParent.relations;
						break;
				}
				for (const l of this.entityList) {
					this.countChecked++;

					if (this.getHasAnyReferences(this.moduleSource, entity, l.id, true)) {
						this.entityIdFinding = l.id;
						this.isRunning = false;
						return;
					}
				}
			}
			this.isRunning = false;
		}
	}
};
