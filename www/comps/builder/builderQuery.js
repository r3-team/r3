import MyBuilderCaption       from './builderCaption.js';
import {getItemTitleRelation} from '../shared/builder.js';
import {getNilUuid}           from '../shared/generic.js';
import {
	getCaptionByIndexAttributeId,
	getQueryFilterNew
} from '../shared/query.js';
import {
	getIndexAttributeIdsByJoins,
	isAttributeRelationship,
	isAttributeRelationship11
} from '../shared/attribute.js';
import {
	getDependentModules,
	getDependentAttributes
} from '../shared/builder.js';
export {MyBuilderQuery as default};

let MyBuilderQueryFilter = {
	name:'my-builder-query-filter',
	template:`<div class="query-title">
		<my-button
			@trigger="show = !show"
			:active="modelValue.length !== 0"
			:caption="capApp.filters.replace('{COUNT}',modelValue.length)"
			:image="displayArrow(show,modelValue.length)"
			:large="true"
			:naked="true"
		/>
		<div class="row gap default-inputs">
			<select v-model.number="joinIndex" class="dynamic">
				<option v-for="j in joins" :value="j.index">{{ j.index }}</option>
			</select>
			<my-button image="add.png"
				@trigger="add"
				:caption="capGen.button.add"
				:naked="true"
			/>
		</div>
	</div>
	<div class="column" v-show="show">
		<template v-for="(filters,index) in filtersByIndexMap">
			<my-button
				v-if="parseInt(index) !== 0 && relationLabel(parseInt(index)) !== ''"
				:active="false"
				:caption="relationLabel(parseInt(index))"
				:naked="true"
			/>
			<my-filters
				@update:modelValue="set($event,parseInt(index))"
				:builderMode="true"
				:disableContent="filtersDisable"
				:entityIdMapRef="entityIdMapRef"
				:fieldIdMap="fieldIdMap"
				:formId="formId"
				:joins="joins"
				:joinsParents="joinsParents"
				:modelValue="filters"
				:moduleId="moduleId"
			/>
		</template>
	</div>`,
	props:{
		entityIdMapRef: { type:Object,  required:true },
		fieldIdMap:     { type:Object,  required:true },
		filtersDisable: { type:Array,   required:false, default:() => [] },
		formId:         { type:String,  required:true },
		joins:          { type:Array,   required:true },
		joinsParents:   { type:Array,   required:true },
		modelValue:     { type:Array,   required:true },
		moduleId:       { type:String,  required:true }
	},
	data() {
		return {
			joinIndex:0,
			show:false
		};
	},
	emits:['update:modelValue'],
	computed:{
		filtersByIndexMap:(s) => {
			let out = {};
			for(const f of s.modelValue) {
				if(out[f.index] === undefined)
					out[f.index] = []

				out[f.index].push(f);
			}
			return out;
		},

		// stores
		capApp:(s) => s.$store.getters.captions.builder.query,
		capGen:(s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getQueryFilterNew,
		getItemTitleRelation,

		// presentation
		displayArrow(state,count) {
			return state && count !== 0 ? 'triangleDown.png' : 'triangleRight.png';
		},
		relationLabel(index) {
			for(const j of this.joins) {
				if(j.index === index)
					return this.getItemTitleRelation(j.relationId,index);
			}
			return '';
		},

		// actions
		add() {
			let f = this.getQueryFilterNew();
			f.index = this.joinIndex;
			
			let v = JSON.parse(JSON.stringify(this.modelValue));
			v.push(f);
			this.$emit('update:modelValue',v);
			this.show = true;
		},
		set(filters,index) {
			const filtersOtherIndexes = this.modelValue.filter(v => v.index !== index);
			this.$emit('update:modelValue',filtersOtherIndexes.concat(filters));
		}
	}
};

let MyBuilderQueryChoice = {
	name:'my-builder-query-choice',
	components:{
		MyBuilderCaption,
		MyBuilderQueryFilter
	},
	template:`<div class="query-choice">
		<div class="query-choice-details">
			
			<my-button
				:active="false"
				:caption="capApp.choice"
				:naked="true"
			/>
			<input v-model="nameInput" :placeholder="capGen.name" />
			
			<my-builder-caption
				@update:modelValue="updateCaption('queryChoiceTitle',$event)"
				:contentName="capGen.title"
				:language="builderLanguage"
				:modelValue="choice.captions.queryChoiceTitle"
			/>
			
			<my-button image="arrowDown.png"
				v-if="moveDown"
				@trigger="$emit('move-down')"
				:naked="true"
			/>
			<my-button image="arrowUp.png"
				v-if="moveUp"
				@trigger="$emit('move-up')"
				:naked="true"
			/>
			<my-button image="cancel.png"
				@trigger="$emit('remove')"
				:naked="true"
			/>
		</div>
		
		<my-builder-query-filter
			v-model="filtersInput"
			:entityIdMapRef="entityIdMapRef"
			:fieldIdMap="fieldIdMap"
			:formId="formId"
			:joins="joins"
			:joinsParents="joinsParents"
			:moduleId="moduleId"
		/>
	</div>`,
	props:{
		builderLanguage:{ type:String, required:true },
		choice:         { type:Object, required:true },
		entityIdMapRef: { type:Object, required:true },
		fieldIdMap:     { type:Object, required:true },
		formId:         { type:String, required:true },
		joins:          { type:Array,  required:true },
		joinsParents:   { type:Array,  required:true },
		moduleId:       { type:String, required:true },
		moveDown:       { type:Boolean,required:true },
		moveUp:         { type:Boolean,required:true }
	},
	emits:['move-down','move-up','remove','update'],
	computed:{
		filtersInput:{
			get()  { return JSON.parse(JSON.stringify(this.choice.filters)); },
			set(v) { this.update('filters',v); }
		},
		nameInput:{
			get()  { return this.choice.name; },
			set(v) { this.update('name',v); }
		},
		
		// stores
		capApp:(s) => s.$store.getters.captions.builder.query,
		capGen:(s) => s.$store.getters.captions.generic
	},
	methods:{
		updateCaption(content,value) {
			let captionsInput = JSON.parse(JSON.stringify(this.choice.captions));
			captionsInput[content] = value;
			this.update('captions',captionsInput);
		},
		update(content,value) {
			let choice = JSON.parse(JSON.stringify(this.choice));
			choice[content] = value;
			this.$emit('update',choice);
		}
	}
};

let MyBuilderQueryLookupItem = {
	name:'my-builder-query-lookup-item',
	template:`<div class="query-lookup-item">
		<span>{{ join.index + ') ' + relationIdMap[join.relationId].name }}</span>
		<select v-model="value">
			<option :value="null">-</option>
			<option v-for="pgIndex in pgIndexCandidates" :value="pgIndex.id">
				{{ displayPgIndexDesc(pgIndex) }}
			</option>
		</select>
	</div>`,
	props:{
		join:      { type:Object, required:true },
		modelValue:{ required:true }
	},
	emits:['update:modelValue'],
	computed:{
		value:{
			get()  { return this.modelValue; },
			set(v) { this.$emit('update:modelValue',v); }
		},
		pgIndexCandidates:(s) => {
			let out = [];
			let rel = s.relationIdMap[s.join.relationId];
			for(let index of rel.indexes) {
				if(index.noDuplicates)
					out.push(index);
			}
			return out;
		},
		
		// stores
		relationIdMap: (s) => s.$store.getters['schema/relationIdMap'],
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap']
	},
	methods:{
		displayPgIndexDesc(pgIndex) {
			let out = [];
			for(let a of pgIndex.attributes) {
				let atr = this.attributeIdMap[a.attributeId];
				out.push(`${atr.name} (${atr.content})`);
			}
			return out.join(' + ');
		}
	}
};

let MyBuilderQueryLookups = {
	name:'my-builder-query-lookups',
	components:{MyBuilderQueryLookupItem},
	template:`<div class="query-lookups">
		<my-builder-query-lookup-item
			v-for="j in joins"
			@update:modelValue="setValueForJoin(j,$event)"
			:join="j"
			:key="j.index"
			:modelValue="getValueForJoin(j)"
		/>
	</div>`,
	props:{
		joins:  { type:Array, required:true },
		lookups:{ type:Array, required:true } // [{pgIndexId:123,index:0},{...}]
	},
	emits:['update'],
	computed:{
		// stores
		capApp:(s) => s.$store.getters.captions.builder.query
	},
	methods:{
		getValueForJoin(join) {
			for(let lookup of this.lookups) {
				if(lookup.index === join.index)
					return lookup.pgIndexId;
			}
			return null;
		},
		setValueForJoin(join,pgIndexId) {
			let lookups = JSON.parse(JSON.stringify(this.lookups));
			for(let i = 0, j = lookups.length; i < j; i++) {
				if(lookups[i].index === join.index) {
					lookups.splice(i,1);
					break;
				}
			}
			
			if(pgIndexId !== null)
				lookups.push({
					pgIndexId:pgIndexId,
					index:join.index
				});
			
			this.$emit('update',lookups);
		}
	}
};

let MyBuilderQueryOrderItem = {
	name:'my-builder-query-order-item',
	template:`<div class="query-order-item">
	
		<!-- index attribute -->
		<select
			@change="setIndexAttribute($event.target.value)"
			:value="indexInput+'_'+attributeIdInput"
		>
			<option value="0_null">-</option>
			<option v-for="ia in indexAttributeIds" :value="ia">
				{{ getCaptionByIndexAttributeId(ia) }}
			</option>
		</select>
		
		<!-- direction -->
		<select v-model="ascendingInput">
			<option :value="true">{{ capGen.option.sortAsc }}</option>
			<option :value="false">{{ capGen.option.sortDesc }}</option>
		</select>
		
		<!-- delete -->
		<my-button image="cancel.png"
			@trigger="$emit('remove')"
			:naked="true"
		/>
	</div>`,
	props:{
		ascending:  { type:Boolean, required:true },
		attributeId:{ required:true },
		index:      { type:Number,  required:true },
		joins:      { type:Array,   required:true }
	},
	emits:['remove','set-ascending','set-attribute-id','set-index'],
	computed:{
		// inputs
		ascendingInput:{
			get()  { return this.ascending; },
			set(v) { this.$emit('set-ascending',v); }
		},
		attributeIdInput:{
			get()  { return this.attributeId; },
			set(v) { this.$emit('set-attribute-id',v); }
		},
		indexInput:{
			get()  { return this.index; },
			set(v) { this.$emit('set-index',v); }
		},
		
		// simple
		indexAttributeIds:(s) => s.getIndexAttributeIdsByJoins(s.joins),
		
		// stores
		relationIdMap: (s) => s.$store.getters['schema/relationIdMap'],
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		capGen:        (s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getCaptionByIndexAttributeId,
		getIndexAttributeIdsByJoins,
		
		// actions
		setIndexAttribute(indexAttributeId) {
			let v = indexAttributeId.split('_');
			
			if(v[1] === 'null') {
				this.indexInput       = 0;
				this.attributeIdInput = null;
				return;
			}
			
			this.indexInput       = parseInt(v[0]);
			this.attributeIdInput = v[1];
		}
	}
};

let MyBuilderQueryOrders = {
	name:'my-builder-query-orders',
	components:{MyBuilderQueryOrderItem},
	template:`<div>
		<my-builder-query-order-item
			v-for="(o,i) in ordersInput"
			@remove="remove(i)"
			@set-ascending="update(i,'ascending',$event)"
			@set-attribute-id="update(i,'attributeId',$event)"
			@set-index="update(i,'index',$event)"
			:ascending="o.ascending"
			:attributeId="o.attributeId"
			:index="o.index"
			:joins="joins"
			:key="i"
		/>
	</div>`,
	props:{
		joins: { type:Array, required:true },
		orders:{ type:Array, required:true }
	},
	emits:['update'],
	computed:{
		ordersInput:{
			get()  { return JSON.parse(JSON.stringify(this.orders)); },
			set(v) { this.$emit('update',v); }
		}
	},
	methods:{
		remove(i) {
			this.ordersInput.splice(i,1);
			this.ordersInput = this.ordersInput;
		},
		update(i,name,value) {
			this.ordersInput[i][name] = value;
			this.ordersInput = this.ordersInput;
		}
	}
};

let MyBuilderQueryNestedJoin = {
	name:'my-builder-query-nested-join',
	template:`<div class="nested-join" :class="{ nested:index !== 0 }">
	
		<!-- descriptive summary line with relation options -->
		<div class="summary">
			<img class="relationship" :src="'images/'+iconRelationship" :title="iconRelationshipTitle" />
			
			<span>{{ index }}</span>
			<span>{{ joinRelation.name }}</span>
			<span v-if="!isBaseRelation" :title="joinReferenceFull">({{ joinReference }})</span>
		
			<!-- relation options -->
			<div class="options" v-if="!readonly">
				<img v-if="index !== 0" class="option clickable" :src="iconJoin" :title="iconJoinTitle" @click="toggleConnector" />
				
				<img class="option clickable" src="images/databaseAdd.png"
					@click="relationAddShow = !relationAddShow"
					:title="capApp.joinAddHint"
				/>
				
				<img class="option clickable toggle" src="images/recordCreate.png"
					@click="toggleApply('create')"
					:class="{ off:!applyCreate }"
					:title="capApp.joinApplyCreateHint"
				/>
				<img class="option clickable toggle" src="images/recordUpdate.png"
					@click="toggleApply('update')"
					:class="{ off:!applyUpdate }"
					:title="capApp.joinApplyUpdateHint"
				/>
				<img class="option clickable toggle" src="images/recordDelete.png"
					@click="toggleApply('delete')"
					:class="{ off:!applyDelete }"
					:title="capApp.joinApplyDeleteHint"
				/>
				
				<!-- delete only if last relation in chain -->
				<img v-if="joins.length === 0" class="option clickable" src="images/cancel.png" @click="$emit('relation-remove',index)" />
				<img v-else class="option" src="images/clear.png" />
			</div>
		</div>
		
		<!-- candidates for joined relations -->
		<select class="default"
			v-if="relationAddShow"
			@change="relationAdd"
			v-model="relationAddId"
		>
			<option :value="null">{{ capApp.select }}</option>
			<option v-for="atr in attributesUnused" :value="atr.id">
				{{ displayJoinOption(atr) }}
			</option>
		</select>
		
		<!-- child joins -->
		<div class="children">
			<my-builder-query-nested-join
				v-for="j in joins"
				@relation-add="(...args) => $emit('relation-add',...args)"
				@relation-remove="(...args) => $emit('relation-remove',...args)"
				@relation-apply-toggle="(...args) => $emit('relation-apply-toggle',...args)"
				@relation-connector-set="(...args) => $emit('relation-connector-set',...args)"
				:applyCreate="j.applyCreate"
				:applyUpdate="j.applyUpdate"
				:applyDelete="j.applyDelete"
				:connector="j.connector"
				:key="j.index"
				:index="j.index"
				:joins="j.joins"
				:joinAttributeId="j.joinAttributeId"
				:joinRelationId="j.joinRelationId"
				:module="module"
				:readonly="readonly"
				:relationIdParent="joinRelationId"
			/>
		</div>
	</div>`,
	data() {
		return {
			relationAddId:null,
			relationAddShow:false
		};
	},
	props:{
		applyCreate:     { type:Boolean,required:true },
		applyUpdate:     { type:Boolean,required:true },
		applyDelete:     { type:Boolean,required:true },
		connector:       { type:String, required:true },
		index:           { type:Number, required:true },
		joins:           { type:Array,  required:true },
		joinAttributeId: { type:String, required:true },
		joinRelationId:  { type:String, required:true },
		module:          { type:Object, required:true },
		readonly:        { type:Boolean,required:true },
		relationIdParent:{ type:String, required:false, default: null}
	},
	emits:[
		'relation-add','relation-apply-toggle',
		'relation-connector-set','relation-remove'
	],
	computed:{
		attributesUnused:(s) => {
			let atrs = [];
			for(const atr of s.getDependentAttributes(s.module)) {
				if(!s.isAttributeRelationship(atr.content))
					continue;
				
				// relationship attribute is from current relation or pointing to it
				if(atr.relationId === s.joinRelationId || atr.relationshipId === s.joinRelationId)
					atrs.push(atr);
			}
			return atrs;
		},
		
		// simple
		hasNoJoinOptions:(s) => s.attributesUnused.length === 0,
		iconJoin:        (s) => {
			switch(s.connector) {
				case 'INNER': return 'images/joinInner.png'; break;
				case 'LEFT':  return 'images/joinLeft.png';  break;
				case 'RIGHT': return 'images/joinRight.png'; break;
				case 'FULL':  return 'images/joinOuter.png'; break;
			}
			return 'images/clear.png';
		},
		iconJoinTitle:   (s) => s.capApp.join.replace('{NAME}',s.connector),
		iconRelationship:(s) => {
			if(s.isBaseRelation) return 'link0.png';
			if(s.isRelation11)   return 'link1.png';
			if(s.isRelation1N)   return 'link2.png';
			if(s.isRelationN1)   return 'link3.png';
			return 'noPic.png';
		},
		iconRelationshipTitle:(s) => {
			if(s.isBaseRelation) return '';
			if(s.isRelation11)   return '1:1';
			if(s.isRelation1N)   return '1:n';
			if(s.isRelationN1)   return 'n:1';
			return '';
		},
		isBaseRelation:   (s) => s.index === 0,
		isOutsideIn:      (s) => !s.isBaseRelation && (s.joinRelationId !== s.joinAttribute.relationId || s.joinRelationId === s.relationIdParent),
		isRelation11:     (s) => !s.isBaseRelation && s.isAttributeRelationship11(s.joinAttribute.content),
		isRelationN1:     (s) => !s.isBaseRelation && !s.isRelation11 && s.isOutsideIn,
		isRelation1N:     (s) => !s.isBaseRelation && !s.isRelation11 && !s.isOutsideIn,
		joinAttribute:    (s) => !s.isBaseRelation ? s.attributeIdMap[s.joinAttributeId] : false,
		joinReference:    (s) => !s.isOutsideIn ? s.joinAttribute.name : s.joinReferenceFull,
		joinReferenceFull:(s) => `${s.relationIdMap[s.joinAttribute.relationId].name}.${s.joinAttribute.name}`,
		joinRelation:     (s) => s.relationIdMap[s.joinRelationId],
		
		// stores
		moduleIdMap:   (s) => s.$store.getters['schema/moduleIdMap'],
		relationIdMap: (s) => s.$store.getters['schema/relationIdMap'],
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		capApp:        (s) => s.$store.getters.captions.builder.query
	},
	methods:{
		// externals
		getDependentAttributes,
		isAttributeRelationship,
		isAttributeRelationship11,
		
		// actions
		relationAdd(event) {
			this.$emit('relation-add',this.index,this.joinRelationId,this.relationAddId,'LEFT');
			this.relationAddId   = null;
			this.relationAddShow = false;
		},
		toggleApply(content) {
			this.$emit('relation-apply-toggle',this.index,content);
		},
		toggleConnector() {
			switch(this.connector) {
				case 'INNER': this.$emit('relation-connector-set',this.index,'LEFT');  break;
				case 'LEFT':  this.$emit('relation-connector-set',this.index,'RIGHT'); break;
				case 'RIGHT': this.$emit('relation-connector-set',this.index,'FULL'); break;
				case 'FULL':  this.$emit('relation-connector-set',this.index,'INNER'); break;
			}
		},
		
		// presentation
		displayApply(content) {
			switch(content) {
				case 'create': return this.applyCreate ? 'C' : 'c'; break;
				case 'update': return this.applyUpdate ? 'U' : 'u'; break;
				case 'delete': return this.applyDelete ? 'D' : 'd'; break;
			}
			return '?';
		},
		displayJoinOption(atr) {
			let outsideIn    = atr.relationId !== this.joinRelationId;
			let relIdPartner = !outsideIn ? atr.relationshipId : atr.relationId;
			let atrRel       = this.relationIdMap[atr.relationId];
			let relType      = outsideIn ? '1:n' : 'n:1';
			
			if(this.isAttributeRelationship11(atr.content))
				relType = '1:1';
			
			return `[${relType}] ${this.relationIdMap[relIdPartner].name} (${atrRel.name}.${atr.name})`;
		},
		displayCheck(state) {
			return `images/${state ? 'checkbox1' : 'checkbox0'}.png`;
		}
	}
};

let MyBuilderQuery = {
	name:'my-builder-query',
	components:{
		MyBuilderQueryChoice,
		MyBuilderQueryFilter,
		MyBuilderQueryLookups,
		MyBuilderQueryNestedJoin,
		MyBuilderQueryOrders
	},
	template:`<div class="builder-query default-inputs">
	
		<div class="query-component">
			<div class="query-title">
				<my-button
					@trigger="showRelations = !showRelations"
					:active="joins.length !== 0"
					:caption="capApp.relations.replace('{COUNT}',joins.length)"
					:image="displayArrow(showRelations,joins.length)"
					:large="true"
					:naked="true"
				/>
			</div>
			
			<select
				v-show="showRelations"
				v-if="relationIdInput === null"
				v-model="relationIdInput"
			>
				<option :value="null">-</option>
				<option v-for="rel in module.relations" :value="rel.id">{{ rel.name }}</option>
				<optgroup
					v-for="mod in getDependentModules(module).filter(v => v.id !== module.id)"
					:label="mod.name"
				>
					<option v-for="rel in mod.relations" :value="rel.id">
						{{ rel.name }}
					</option>
				</optgroup>
			</select>
			
			<!-- all joined relations, starting with source relation -->
			<my-builder-query-nested-join
				v-show="showRelations"
				v-if="relationsNested !== false"
				@relation-add="relationAdd"
				@relation-remove="relationRemove"
				@relation-connector-set="relationConnectorSet"
				@relation-apply-toggle="relationApplyToggle"
				:applyCreate="relationsNested.applyCreate"
				:applyUpdate="relationsNested.applyUpdate"
				:applyDelete="relationsNested.applyDelete"
				:connector="relationsNested.connector"
				:index="relationsNested.index"
				:joins="relationsNested.joins"
				:joinAttributeId="relationsNested.joinAttributeId"
				:joinRelationId="relationsNested.joinRelationId"
				:key="relationsNested.index"
				:module="module"
				:readonly="!allowJoinEdit"
			/>
		</div>
		
		<!-- orders -->
		<div class="query-component" v-if="allowOrders && joins.length !== 0">
			<div class="query-title">
				<my-button
					@trigger="showOrders = !showOrders"
					:active="orders.length !== 0"
					:caption="capApp.orders.replace('{COUNT}',orders.length)"
					:image="displayArrow(showOrders,orders.length)"
					:large="true"
					:naked="true"
				/>
				<my-button image="add.png"
					@trigger="orderAdd"
					:caption="capGen.button.add"
					:naked="true"
				/>
			</div>
			<my-builder-query-orders
				v-show="showOrders"
				@update="ordersInput = $event"
				:joins="joins"
				:orders="orders"
			/>
		</div>
		
		<!-- filters -->
		<div class="query-component" v-if="allowFilters && joins.length !== 0">
			<my-builder-query-filter
				v-model="filtersInput"
				:entityIdMapRef="entityIdMapRef"
				:fieldIdMap="fieldIdMap"
				:filtersDisable="filtersDisable"
				:formId="formId"
				:joins="joins"
				:joinsParents="joinsParents"
				:moduleId="moduleId"
			/>
		</div>
		
		<!-- choice filters -->
		<div class="query-component" v-if="allowChoices && allowFilters && joins.length !== 0">
			<div class="query-title">
				<my-button
					@trigger="showChoices = !showChoices"
					:active="choices.length !== 0"
					:caption="capApp.choices.replace('{COUNT}',choices.length)"
					:image="displayArrow(showChoices,choices.length)"
					:large="true"
					:naked="true"
				/>
				<my-button image="add.png"
					@trigger="choiceAdd"
					:caption="capGen.button.add"
					:naked="true"
				/>
			</div>
			
			<template v-if="showChoices && choicesInput.length > 0">
				<span><i>{{ capApp.choicesHint }}</i></span>
				<br /><br />
			</template>
			
			<my-builder-query-choice
				v-show="showChoices"
				v-for="(c,i) in choicesInput"
				@move-down="choiceMove(i,true)"
				@move-up="choiceMove(i,false)"
				@remove="choiceRemove(i)"
				@update="choiceApply(i,$event)"
				:builderLanguage="builderLanguage"
				:choice="choicesInput[i]"
				:entityIdMapRef="entityIdMapRef"
				:fieldIdMap="fieldIdMap"
				:formId="formId"
				:joins="joins"
				:joinsParents="joinsParents"
				:key="i+'_'+c.id"
				:moduleId="moduleId"
				:moveDown="i < choicesInput.length - 1"
				:moveUp="i !== 0"
			/>
		</div>
		
		<!-- lookups -->
		<div class="query-component" v-if="allowLookups && joins.length !== 0">
			<div class="query-title">
				<my-button
					@trigger="showLookups = !showLookups"
					:active="joins.length !== 0"
					:caption="capApp.lookups.replace('{COUNT}',lookups.length)"
					:image="displayArrow(showLookups,joins.length)"
					:large="true"
					:naked="true"
				/>
				<my-button image="question.png"
					@trigger="showLookupHelp"
					:caption="capGen.help"
					:naked="true"
				/>
			</div>
			<my-builder-query-lookups
				v-show="showLookups"
				@update="lookupsInput = $event"
				:joins="joins"
				:lookups="lookups"
			/>
		</div>
		
		<!-- fixed limit -->
		<div class="fixed-limit" v-if="allowFixedLimit && joins.length !== 0">
			<my-button
				:active="false"
				:caption="capApp.fixedLimit"
				:large="true"
				:naked="true"
			/>
			<my-button
				v-if="fixedLimitInput === 0"
				@trigger="fixedLimitInput = 10"
				:caption="capApp.fixedLimit0"
				:naked="true"
			/>
			<input class="short"
				v-if="fixedLimitInput !== 0"
				v-model.number="fixedLimitInput"
			/>
		</div>
	</div>`,
	props:{
		allowChoices:   { type:Boolean, required:false, default:true },
		allowFilters:   { type:Boolean, required:false, default:true },
		allowFixedLimit:{ type:Boolean, required:false, default:true },
		allowJoinEdit:  { type:Boolean, required:false, default:true },
		allowLookups:   { type:Boolean, required:false, default:false },
		allowOrders:    { type:Boolean, required:false, default:false },
		builderLanguage:{ type:String,  required:false, default:'' },
		choices:        { type:Array,   required:false, default:() => [] },          // choices for optional query filters (selectable by users)
		entityIdMapRef: { type:Object,  required:false, default:() => {return {}} },
		fieldIdMap:     { type:Object,  required:false, default:() => {return {}} }, // form field map, key: field ID
		filters:        { type:Array,   required:true },
		filtersDisable: { type:Array,   required:false, default:() => [] }, // filter content to disable (attribute, javascript, collection, preset, ...)
		fixedLimit:     { type:Number,  required:true },
		formId:         { type:String,  required:false, default:'' },       // ID of form in which context the query is used
		lookups:        { type:Array,   required:false, default:() => [] },
		joins:          { type:Array,   required:true },                    // available relations, incl. source relation
		joinsParents:   { type:Array,   required:false, default:() => [] }, // each item is an array of joins from a parent query
		orders:         { type:Array,   required:false, default:() => [] },
		moduleId:       { type:String,  required:true },
		relationId:     { required:true },                                  // source relation
		relationIdStart:{ required:false, default:null }                    // when query starts with a defined relation
	},
	emits:[
		'index-removed','set-choices','set-filters','set-fixed-limit',
		'set-joins','set-lookups','set-orders','set-relation-id'
	],
	data() {
		return {
			showChoices:false,
			showLookups:false,
			showOrders:false,
			showRelations:true
		};
	},
	computed:{
		// inputs
		choicesInput:{
			get()  { return this.choices; },
			set(v) { this.$emit('set-choices',v); }
		},
		filtersInput:{
			get()  { return this.filters; },
			set(v) { this.$emit('set-filters',v); }
		},
		fixedLimitInput:{
			get()  { return this.fixedLimit; },
			set(v) { this.$emit('set-fixed-limit',v === '' ? 0 : v); }
		},
		joinsInput:{
			get()  { return this.joins; },
			set(v) { this.$emit('set-joins',v); }
		},
		lookupsInput:{
			get()  { return this.lookups; },
			set(v) { this.$emit('set-lookups',v); }
		},
		ordersInput:{
			get()  { return this.orders; },
			set(v) { this.$emit('set-orders',v); }
		},
		relationIdInput:{
			get() {
				let relId = this.relationId;
				if(relId === null && this.relationIdStart !== null) {
					
					// if source relation not set, but default given: set
					this.$emit('set-relation-id',this.relationIdStart);
					return null;
				}
				
				if(relId !== null && this.joins.length === 0) {
					
					// if source relation set, but not added as join yet: add
					this.relationAdd(-1,relId,null,'INNER');
				}
				return relId;
			},
			set(v) { this.$emit('set-relation-id',v); }
		},
		
		// entities
		relationNextIndex:(s) => {
			let indexCandidate = 0;
			for(let join of s.joinsInput) {
				if(join.index >= indexCandidate)
					indexCandidate = join.index + 1;
			}
			return indexCandidate;
		},
		relationsNested:(s) => {
			let getChildRelationsByIndex = function(indexFrom) {
				let rels = [];
				for(let i = 0, j = s.joinsInput.length; i < j; i++) {
					if(s.joinsInput[i].indexFrom !== indexFrom)
						continue;
					
					let join = JSON.parse(JSON.stringify(s.joinsInput[i]));
					let atr  = s.attributeIdMap[join.attributeId];
					let rel  = s.relationIdMap[join.relationId];
					
					rels.push({
						applyCreate:join.applyCreate,
						applyUpdate:join.applyUpdate,
						applyDelete:join.applyDelete,
						connector:join.connector,
						index:join.index,
						joins:getChildRelationsByIndex(join.index),
						joinAttributeId:atr.id,
						joinRelationId:rel.id
					});
				}
				return rels;
			};
			
			if(!s.module || !s.relation)
				return false;
			
			// source relation with all relations deep-nested
			return {
				applyCreate:s.joinsInput[0].applyCreate,
				applyUpdate:s.joinsInput[0].applyUpdate,
				applyDelete:s.joinsInput[0].applyDelete,
				connector:'INNER',
				index:0,
				joins:getChildRelationsByIndex(0),
				joinAttributeId:s.getNilUuid(),
				joinRelationId:s.relation.id,
				name:s.relation.name
			};
		},
		
		// entities, simple
		module:  (s) => s.moduleIdMap[s.moduleId]     === undefined ? false : s.moduleIdMap[s.moduleId],
		relation:(s) => s.relationIdMap[s.relationId] === undefined ? false : s.relationIdMap[s.relationId],
		
		// stores
		moduleIdMap:   (s) => s.$store.getters['schema/moduleIdMap'],
		relationIdMap: (s) => s.$store.getters['schema/relationIdMap'],
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		capApp:        (s) => s.$store.getters.captions.builder.query,
		capGen:        (s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getDependentModules,
		getNilUuid,
		
		// presentation
		displayArrow(state,count) {
			return state && count !== 0 ? 'triangleDown.png' : 'triangleRight.png';
		},
		
		getRelationByIndex(index) {
			for(let i = 0, j = this.joinsInput.length; i < j; i++) {
				if(this.joinsInput[i].index === index)
					return this.joinsInput[i];
			}
			return false;
		},
		
		// actions
		choiceAdd() {
			this.choicesInput.push({
				id:this.getNilUuid(),
				name:'',
				filters:[],
				captions:{
					queryChoiceTitle:{}
				}
			});
			
			if(!this.showChoices)
				this.showChoices = true;
		},
		choiceApply(i,value) {
			this.choicesInput[i] = value;
			this.choicesInput = this.choicesInput;
		},
		choiceMove(i,down) {
			let c = this.choicesInput[i];
			this.choicesInput.splice(i,1);
			this.choicesInput.splice((down ? i + 1 : i - 1),0,c);
		},
		choiceRemove(i) {
			this.choicesInput.splice(i,1);
			this.choicesInput = this.choicesInput;
		},
		orderAdd() {
			this.ordersInput.push({
				ascending:true,
				attributeId:null,
				index:0
			});
			this.ordersInput = this.ordersInput;
			
			if(!this.showOrders)
				this.showOrders = true;
		},
		showLookupHelp() {
			this.$store.commit('dialog',{
				captionBody:this.capApp.lookupsHelp,
				captionTop:this.capGen.help,
				image:'question.png'
			});
		},
		
		// relation manipulation
		relationAdd(indexFrom,relationIdFrom,attributeId,connector) {
			let isSource = indexFrom === -1;
			let relId    = '';
			if(!isSource) {
				let atr = this.attributeIdMap[attributeId];
				relId = relationIdFrom !== atr.relationId ? atr.relationId : atr.relationshipId;
			} else {
				relId = relationIdFrom;
			}
			
			this.joinsInput.push({
				applyCreate:isSource ? true : false,
				applyUpdate:isSource ? true : false,
				applyDelete:isSource ? true : false,
				connector:connector,
				relationId:relId,
				attributeId:attributeId,
				index:this.relationNextIndex,
				indexFrom:indexFrom
			});
			this.joinsInput = this.joinsInput;
		},
		relationRemove(index) {
			// remove relation & lookup
			this.joinsInput   = this.joinsInput.filter(v => v.index !== index);
			this.lookupsInput = this.lookupsInput.filter(v => v.index !== index);
			
			if(index === 0) {
				// source relation has changed
				this.relationIdInput = null;
				this.filtersInput    = [];
			}

			// inform parent about removed index, to remove affected fields/columns/etc.
			this.$emit('index-removed',index);
		},
		relationApplyToggle(index,content) {
			let r = this.getRelationByIndex(index);
			if(r === false) return;
			
			switch(content) {
				case 'create': r.applyCreate = !r.applyCreate; break;
				case 'update': r.applyUpdate = !r.applyUpdate; break;
				case 'delete': r.applyDelete = !r.applyDelete; break;
			}
			this.joinsInput = this.joinsInput;
		},
		relationConnectorSet(index,connector) {
			let r = this.getRelationByIndex(index);
			if(r === false) return;
			
			r.connector = connector;
			this.joinsInput = this.joinsInput;
		}
	}
};