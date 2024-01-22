import {getDependentModules} from '../shared/builder.js';
import MyBuilderPgTrigger    from './builderPgTrigger.js';
export {MyBuilderPgTriggers as default};

let MyBuilderPgTriggers = {
	name:'my-builder-pg-triggers',
	components:{MyBuilderPgTrigger},
	template:`<div class="generic-entry-list height-small" :class="{ singleColumn:singleColumn }">
		<div class="entry"
			v-if="!readonly"
			@click="idEdit = null"
			:class="{ clickable:!readonly }"
		>
			<div class="row gap centered">
				<img class="icon" src="images/add.png" />
				<span>{{ capGen.button.new }}</span>
			</div>
		</div>
		
		<div class="entry clickable"
			@click="idEdit = trg.id"
			v-for="trg in triggers"
		>
			<div class="row centered gap">
				<my-button image="databasePlay.png"
					:active="false"
					:naked="true"
				/>
				<div class="lines">
					<span>{{ trg.fires }}</span>
					<span class="subtitle">
						{{ isFromRelation ? pgFunctionIdMap[trg.pgFunctionId].name + '()' : relationIdMap[trg.relationId].name }}
					</span>
				</div>
			</div>
			<div class="row centered gap">
				<my-button image="recordCreate.png"
					v-if="trg.onInsert"
					:active="false"
					:captionTitle="capApp.onInsert"
					:naked="true"
				/>
				<my-button image="recordUpdate.png"
					v-if="trg.onUpdate"
					:active="false"
					:captionTitle="capApp.onUpdate"
					:naked="true"
				/>
				<my-button image="recordDelete.png"
					v-if="trg.onDelete"
					:active="false"
					:captionTitle="capApp.onDelete"
					:naked="true"
				/>
				<my-button image="lettersZzz.png"
					v-if="trg.isDeferred"
					:active="false"
					:captionTitle="capApp.isDeferred"
					:naked="true"
				/>
			</div>
		</div>
		
		<my-builder-pg-trigger
			v-if="idEdit !== false"
			@close="idEdit = false"
			:contextEntity="contextEntity"
			:contextId="contextId"
			:id="idEdit"
			:readonly="readonly"
		/>
	</div>`,
	props:{
		contextEntity:{ type:String,  required:true }, // relation / pgFunction
		contextId:    { type:String,  required:true }, // ID of relation or pgFunction
		readonly:     { type:Boolean, required:true },
		singleColumn: { type:Boolean, required:false, default:false }
	},
	data() {
		return {
			idEdit:false
		};
	},
	computed:{
		module:(s) => {
			if(s.isFromRelation)   return s.moduleIdMap[s.relationIdMap[s.contextId].moduleId];
			if(s.isFromPgFunction) return s.moduleIdMap[s.pgFunctionIdMap[s.contextId].moduleId];
			return false;
		},
		triggers:(s) => {
			if(s.module === false) return [];
			
			let out = [];
			
			// check relevant modules
			const modules = s.isFromPgFunction ? s.getDependentModules(s.module) : s.modules;
			for(const mod of modules) {
				for(const trg of mod.pgTriggers) {
					if(
						(s.isFromRelation   && trg.relationId   === s.contextId) || 
						(s.isFromPgFunction && trg.pgFunctionId === s.contextId)
					) out.push(trg);
				}
			}
			
			// sort by execution event & deferred
			// BEFORE trigger first, then AFTER trigger, then AFTER DEFERRED trigger
			out.sort((a,b) => {
				const calcPrio = (e) => (e.fires === 'BEFORE' ? 0 : 10) + (!e.isDeferred ? 0 : 1);
				return calcPrio(a) - calcPrio(b);
			});
			return out;
		},
		
		// simple
		isFromPgFunction:(s) => s.contextEntity === 'pgFunction',
		isFromRelation:  (s) => s.contextEntity === 'relation',
		
		// stores
		modules:        (s) => s.$store.getters['schema/modules'],
		moduleIdMap:    (s) => s.$store.getters['schema/moduleIdMap'],
		pgFunctionIdMap:(s) => s.$store.getters['schema/pgFunctionIdMap'],
		relationIdMap:  (s) => s.$store.getters['schema/relationIdMap'],
		capApp:         (s) => s.$store.getters.captions.builder.pgTrigger,
		capGen:         (s) => s.$store.getters.captions.generic
	},
	methods:{
		// external
		getDependentModules
	}
};