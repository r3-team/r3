import MyBuilderCaption               from './builderCaption.js';
import {getNilUuid}                   from '../shared/generic.js';
import {getCaptionByIndexAttributeId} from '../shared/query.js';
import {
	getIndexAttributeIdsByJoins,
	isAttributeRelationship
} from '../shared/attribute.js';
import {
	getDependentModules,
	getItemTitle
} from '../shared/builder.js';
export {MyBuilderQuery as default};

let MyBuilderQueryCollection = {
	name:'my-builder-query-collection',
	template:`<div class="query-collection">
		<table>
			<tbody>
				<!-- used collection -->
				<tr>
					<td>{{ capApp.collection }}</td>
					<td>
						<select v-model="collectionId">
							<option :value="null"></option>
							<optgroup
								v-for="m in getDependentModules(module,modules).filter(v => v.collections.length !== 0)"
								:label="m.name"
							>
								<option v-for="c in m.collections" :value="c.id">
									{{ c.name }}
								</option>
							</optgroup>
						</select>
					</td>
					<td>
						<my-button image="cancel.png"
							@trigger="$emit('remove')"
							:naked="true"
						/>
					</td>
				</tr>
				
				<template v-if="collectionId !== null">
					
					<!-- query attribute to filter -->
					<tr>
						<td>{{ capApp.collectionAttribute }}</td>
						<td colspan="2">
							<select 
								@change="updateIndexAttribute($event.target.value)"
								:value="attributeIndex+'_'+attributeId"
							>
								<option value="0_null">-</option>
								<option v-for="ia in indexAttributeIds" :value="ia">
									{{ getCaptionByIndexAttributeId(ia) }}
								</option>
							</select>
						</td>
					</tr>
					
					<!-- collection columns -->
					<tr>
						<td>{{ capApp.collectionValue }}</td>
						<td colspan="2">
							<select v-model="columnIdCollectionValue">
								<option :value="null">-</option>
								<option v-for="c in columns" :value="c.id">
									{{ getTitle(c) }}
								</option>
							</select>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.collectionDisplay }}</td>
						<td colspan="2">
							<select v-model="columnIdCollectionDisplay">
								<option :value="null">-</option>
								<option v-for="c in columns" :value="c.id">
									{{ getTitle(c) }}
								</option>
							</select>
						</td>
					</tr>
				</template>
			</tbody>
		</table>
	</div>`,
	props:{
		collection:{ type:Object, required:true },
		joins:     { type:Array,  required:true },
		module:    { type:Object, required:true }
	},
	emits:['remove','update'],
	computed:{
		// inputs
		attributeId:{
			get:function()  { return this.collection.attributeId; },
			set:function(v) { this.update('attributeId',v); }
		},
		attributeIndex:{
			get:function()  { return this.collection.attributeIndex; },
			set:function(v) { this.update('attributeIndex',v); }
		},
		collectionId:{
			get:function()  { return this.collection.collectionId; },
			set:function(v) { this.update('collectionId',v); }
		},
		columnIdCollectionDisplay:{
			get:function()  { return this.collection.columnIdCollectionDisplay; },
			set:function(v) { this.update('columnIdCollectionDisplay',v); }
		},
		columnIdCollectionValue:{
			get:function()  { return this.collection.columnIdCollectionValue; },
			set:function(v) { this.update('columnIdCollectionValue',v); }
		},
		
		// entities
		columns:function() {
			if(this.collectionId === null) return [];
			
			return this.collectionIdMap[this.collectionId]
				.columns.filter(v => !v.subQuery);
		},
		indexAttributeIds:function() {
			return this.getIndexAttributeIdsByJoins(this.joins);
		},
		
		// stores
		modules:        function() { return this.$store.getters['schema/modules']; },
		moduleIdMap:    function() { return this.$store.getters['schema/moduleIdMap']; },
		relationIdMap:  function() { return this.$store.getters['schema/relationIdMap']; },
		attributeIdMap: function() { return this.$store.getters['schema/attributeIdMap']; },
		collectionIdMap:function() { return this.$store.getters['schema/collectionIdMap']; },
		capApp:         function() { return this.$store.getters.captions.builder.query; },
		capGen:         function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		// externals
		getCaptionByIndexAttributeId,
		getDependentModules,
		getIndexAttributeIdsByJoins,
		getItemTitle,
		
		// presentation
		getTitle:function(column) {
			let a = this.attributeIdMap[column.attributeId];
			let r = this.relationIdMap[a.relationId];
			return getItemTitle(r,a,column.index,false,false);
		},
		
		// actions
		updateIndexAttribute:function(ia) {
			let v     = ia.split('_');
			let index = v[1] === 'null' ? 0    : parseInt(v[0]);
			let id    = v[1] === 'null' ? null : v[1];
			
			v = JSON.parse(JSON.stringify(this.collection));
			v.attributeIndex = index;
			v.attributeId    = id;
			this.$emit('update',v);
		},
		update:function(content,value) {
			let v = JSON.parse(JSON.stringify(this.collection));
			v[content] = value;
			this.$emit('update',v);
		}
	}
};

let MyBuilderQueryChoice = {
	name:'my-builder-query-choice',
	components:{
		MyBuilderCaption
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
		
		<my-filters
			v-model="filtersInput"
			:allowSubQuery="true"
			:builderMode="true"
			:dataFields="dataFields"
			:joins="joins"
			:joinsParents="joinsParents"
			:moduleId="moduleId"
			:showMove="true"
		>
			<template #title>
				<div class="query-title">
					<span>{{ capGen.filters }}</span>
				</div>
			</template>
		</my-filters>
	</div>`,
	props:{
		builderLanguage:{ type:String, required:true },
		choice:         { type:Object, required:true },
		dataFields:     { type:Array,  required:true },
		joins:          { type:Array,  required:true },
		joinsParents:   { type:Array,  required:true },
		moduleId:       { type:String, required:true },
		moveDown:       { type:Boolean,required:true },
		moveUp:         { type:Boolean,required:true }
	},
	emits:['move-down','move-up','remove','update'],
	computed:{
		filtersInput:{
			get:function()  { return JSON.parse(JSON.stringify(this.choice.filters)); },
			set:function(v) { this.update('filters',v); }
		},
		nameInput:{
			get:function()  { return this.choice.name; },
			set:function(v) { this.update('name',v); }
		},
		
		// stores
		capApp:function() { return this.$store.getters.captions.builder.query; },
		capGen:function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		updateCaption:function(content,value) {
			let captionsInput = JSON.parse(JSON.stringify(this.choice.captions));
			captionsInput[content] = value;
			this.update('captions',captionsInput);
		},
		update:function(content,value) {
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
			get:function()  { return this.modelValue; },
			set:function(v) { this.$emit('update:modelValue',v); }
		},
		pgIndexCandidates:function() {
			let out = [];
			let rel = this.relationIdMap[this.join.relationId];
			
			for(let i = 0, j = rel.indexes.length; i < j; i++) {
				let index = rel.indexes[i];
				
				if(index.noDuplicates)
					out.push(index);
			}
			return out;
		},
		
		// stores
		relationIdMap: function() { return this.$store.getters['schema/relationIdMap']; },
		attributeIdMap:function() { return this.$store.getters['schema/attributeIdMap']; }
	},
	methods:{
		displayPgIndexDesc:function(pgIndex) {
			let out = [];
			
			for(let i = 0, j = pgIndex.attributes.length; i < j; i++) {
				
				let atr = this.attributeIdMap[pgIndex.attributes[i].attributeId];
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
		<span v-html="capApp.lookupWarning"></span>
	</div>`,
	props:{
		joins:  { type:Array, required:true },
		lookups:{ type:Array, required:true }
	},
	emits:['update'],
	computed:{
		lookupsInput:{
			get:function()  { return JSON.parse(JSON.stringify(this.lookups)); },
			set:function(v) { this.$emit('update',v); }
		},
		
		// stores
		capApp:function() { return this.$store.getters.captions.builder.query; }
	},
	methods:{
		getValueForJoin:function(join) {
			for(let i = 0, j = this.lookupsInput.length; i < j; i++) {
				if(this.lookupsInput[i].index === join.index)
					return this.lookupsInput[i].pgIndexId;
			}
			return null;
		},
		setValueForJoin:function(join,pgIndexId) {
			let pos = -1;
			for(let i = 0, j = this.lookupsInput.length; i < j; i++) {
				if(this.lookupsInput[i].index === join.index) {
					pos = i;
					break;
				}
			}
			
			if(pgIndexId === null && pos !== -1)
				this.lookupsInput.splice(pos,1);
			
			if(pgIndexId !== null && pos === -1)
				this.lookupsInput.push({
					pgIndexId:pgIndexId,
					index:join.index
				});
			
			this.lookupsInput = this.lookupsInput;
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
		indexAttributeIds:function() {
			return this.getIndexAttributeIdsByJoins(this.joins);
		},
		
		// inputs
		ascendingInput:{
			get:function()  { return this.ascending; },
			set:function(v) { this.$emit('set-ascending',v); }
		},
		attributeIdInput:{
			get:function()  { return this.attributeId; },
			set:function(v) { this.$emit('set-attribute-id',v); }
		},
		indexInput:{
			get:function()  { return this.index; },
			set:function(v) { this.$emit('set-index',v); }
		},
		
		// stores
		relationIdMap: function() { return this.$store.getters['schema/relationIdMap']; },
		attributeIdMap:function() { return this.$store.getters['schema/attributeIdMap']; },
		capGen:        function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		// externals
		getCaptionByIndexAttributeId,
		getIndexAttributeIdsByJoins,
		
		// actions
		setIndexAttribute:function(indexAttributeId) {
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
			get:function()  { return JSON.parse(JSON.stringify(this.orders)); },
			set:function(v) { this.$emit('update',v); }
		}
	},
	methods:{
		remove:function(i) {
			this.ordersInput.splice(i,1);
			this.ordersInput = this.ordersInput;
		},
		update:function(i,name,value) {
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
			
			<div v-html="displayName()" />
		
			<!-- relation options -->
			<div class="options" v-if="!readonly">
				<div class="option clickable"
					@click="relationAddShow = !relationAddShow"
					:title="capApp.joinAddHint"
				>{{ displayJoin() }}</div>
				
				<div class="option clickable"
					@click="toggleConnector"
					:title="capApp.joinConnectorHint"
				>{{ displayConnector(index) }}</div>
				
				<div class="option clickable"
					@click="toggleApply('create')"
					:title="capApp.joinApplyCreateHint"
				>{{ displayApply('create') }}</div>
				
				<div class="option clickable"
					@click="toggleApply('update')"
					:title="capApp.joinApplyUpdateHint"
				>{{ displayApply('update') }}</div>
				
				<div class="option clickable"
					@click="toggleApply('delete')"
					:title="capApp.joinApplyDeleteHint"
				>{{ displayApply('delete') }}</div>
				
				<!-- delete only if last relation in chain -->
				<div v-if="joins.length === 0" class="option clickable" @click="$emit('relation-remove',index)">X</div>
				<div v-if="joins.length !== 0" class="option">-</div>
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
				:name="j.name"
				:readonly="readonly"
			/>
		</div>
	</div>`,
	data:function() {
		return {
			relationAddId:null,
			relationAddShow:false
		};
	},
	props:{
		applyCreate:    { type:Boolean,required:true },
		applyUpdate:    { type:Boolean,required:true },
		applyDelete:    { type:Boolean,required:true },
		connector:      { type:String, required:true },
		index:          { type:Number, required:true },
		joins:          { type:Array,  required:true },
		joinAttributeId:{ type:String, required:true },
		joinRelationId: { type:String, required:true },
		module:         { type:Object, required:true },
		name:           { type:String, required:true },
		readonly:       { type:Boolean,required:true }
	},
	emits:[
		'relation-add','relation-apply-toggle',
		'relation-connector-set','relation-remove'
	],
	computed:{
		attributesUnused:function() {
			let atrs = [];
			
			// get attributes of this relation and in relationship with this relation
			for(let key in this.attributeIdMap) {
				let atr = this.attributeIdMap[key];
				
				if(!this.isAttributeRelationship(atr.content))
					continue;
				
				// relationship attribute is from current relation, add
				if(atr.relationId === this.joinRelationId) {
					atrs.push(atr);
					continue;
				}
				
				// relationship attribute is not pointing to us, ignore
				if(atr.relationshipId !== this.joinRelationId)
					continue;
				
				// if attribute is from other relation, check module dependency first
				let rel = this.relationIdMap[atr.relationId];
				let mod = this.moduleIdMap[rel.moduleId];
				
				if(mod.id !== this.module.id && !this.module.dependsOn.includes(mod.id))
					continue;
				
				atrs.push(atr);
			}
			return atrs;
		},
		
		// stores
		moduleIdMap:   function() { return this.$store.getters['schema/moduleIdMap']; },
		relationIdMap: function() { return this.$store.getters['schema/relationIdMap']; },
		attributeIdMap:function() { return this.$store.getters['schema/attributeIdMap']; },
		capApp:        function() { return this.$store.getters.captions.builder.query; }
	},
	methods:{
		// externals
		isAttributeRelationship,
		
		// actions
		relationAdd:function(event) {
			this.$emit('relation-add',this.index,this.joinRelationId,this.relationAddId,'LEFT');
			this.relationAddId   = null;
			this.relationAddShow = false;
		},
		toggleApply:function(content) {
			this.$emit('relation-apply-toggle',this.index,content);
		},
		toggleConnector:function() {
			switch(this.connector) {
				case 'INNER': this.$emit('relation-connector-set',this.index,'LEFT');  break;
				case 'LEFT':  this.$emit('relation-connector-set',this.index,'RIGHT'); break;
				case 'RIGHT': this.$emit('relation-connector-set',this.index,'FULL'); break;
				case 'FULL':  this.$emit('relation-connector-set',this.index,'INNER'); break;
			}
		},
		
		// presentation
		displayApply:function(content) {
			switch(content) {
				case 'create': return this.applyCreate ? 'C' : 'c'; break;
				case 'update': return this.applyUpdate ? 'U' : 'u'; break;
				case 'delete': return this.applyDelete ? 'D' : 'd'; break;
			}
			return '?';
		},
		displayName:function() {
			return `${this.index}) ${this.name}`;
		},
		displayJoin:function() {
			return this.attributesUnused.length !== 0 ? 'A' : '-';
		},
		displayJoinOption:function(atr) {
			let relIdResolve = atr.relationId === this.joinRelationId ? atr.relationshipId : atr.relationId;
			let atrRel       = this.relationIdMap[atr.relationId];
			
			return `+ ${this.relationIdMap[relIdResolve].name} via ${atrRel.name}.${atr.name}`;
		},
		displayConnector:function(index) {
			if(index === 0) return '-';
			
			switch(this.connector) {
				case 'INNER': return 'I'; break;
				case 'LEFT':  return 'L'; break;
				case 'RIGHT': return 'R'; break;
				case 'FULL':  return 'F'; break;
			}
			return '?';
		}
	}
};

let MyBuilderQuery = {
	name:'my-builder-query',
	components:{
		MyBuilderQueryChoice,
		MyBuilderQueryCollection,
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
				<optgroup
					v-for="mod in getDependentModules(module,modules)"
					:label="mod.name"
				>
					<option v-for="rel in mod.relations"
						:value="rel.id"
					>
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
				:name="relationsNested.name"
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
			<div class="query-title">
				<my-button
					@trigger="showFilters = !showFilters"
					:active="filters.length !== 0"
					:caption="capApp.filters.replace('{COUNT}',filters.length)"
					:image="displayArrow(showFilters,filters.length)"
					:large="true"
					:naked="true"
				/>
				<my-button image="add.png"
					@trigger="filterAdd"
					:caption="capGen.button.add"
					:naked="true"
				/>
			</div>
			<my-filters
				v-model="filtersInput"
				v-show="showFilters"
				:allowSubQuery="true"
				:builderMode="true"
				:dataFields="dataFields"
				:filterAddCnt="filterAddCnt"
				:joins="joins"
				:joinsParents="joinsParents"
				:moduleId="moduleId"
				:showAdd="false"
				:showMove="true"
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
				:dataFields="dataFields"
				:joins="joins"
				:joinsParents="joinsParents"
				:key="i+'_'+c.id"
				:moduleId="moduleId"
				:moveDown="i < choicesInput.length - 1"
				:moveUp="i !== 0"
			/>
		</div>
		
		<!-- collections -->
		<div class="query-component" v-if="joins.length !== 0">
			<div class="query-title">
				<my-button
					@trigger="showCollections = !showCollections"
					:active="collections.length !== 0"
					:caption="capApp.collections.replace('{COUNT}',collections.length)"
					:image="displayArrow(showCollections,collections.length)"
					:large="true"
					:naked="true"
				/>
				<my-button image="add.png"
					@trigger="collectionAdd"
					:caption="capGen.button.add"
					:naked="true"
				/>
			</div>
			
			<my-builder-query-collection
				v-show="showCollections"
				v-for="(c,i) in collectionsInput"
				@remove="collectionRemove(i)"
				@update="collectionApply(i,$event)"
				:collection="collectionsInput[i]"
				:joins="joins"
				:key="i+'_'+c.id"
				:module="module"
			/>
		</div>
		
		<!-- lookups -->
		<div class="query-component" v-if="allowLookups && joins.length !== 0">
			<div class="query-title">
				<my-button
					@trigger="showLookups = !showLookups"
					:active="joins.length !== 0"
					:caption="capApp.lookups.replace('{COUNT}',joins.length)"
					:image="displayArrow(showLookups,joins.length)"
					:large="true"
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
		choices:        { type:Array,   required:true },                    // choices for optional query filters (selectable by users)
		collections:    { type:Array,   required:true },                    // filter by collection values with optional input
		dataFields:     { type:Array,   required:false, default:() => [] }, // form fields for filter candidates
		filters:        { type:Array,   required:true },
		fixedLimit:     { type:Number,  required:true },
		lookups:        { type:Array,   required:true },
		joins:          { type:Array,   required:true },                    // available relations, incl. source relation
		joinsParents:   { type:Array,   required:false, default:() => [] }, // each item is an array of joins from a parent query
		orders:         { type:Array,   required:true },
		moduleId:       { type:String,  required:true },
		relationId:     { required:true },                                  // source relation
		relationIdStart:{ required:false, default:null }                    // when query starts with a defined relation
	},
	emits:[
		'index-removed','set-choices','set-collections','set-filters',
		'set-fixed-limit','set-joins','set-lookups','set-orders',
		'set-relation-id'
	],
	data:function() {
		return {
			filterAddCnt:0, // ugly hack to add filter
			showChoices:false,
			showCollections:false,
			showFilters:false,
			showLookups:false,
			showOrders:false,
			showRelations:true
		};
	},
	computed:{
		// entities
		module:function() {
			return typeof this.moduleIdMap[this.moduleId] === 'undefined'
				? false : this.moduleIdMap[this.moduleId];
		},
		relation:function() {
			return typeof this.relationIdMap[this.relationId] === 'undefined'
				? false : this.relationIdMap[this.relationId];
		},
		relationNextIndex:function() {
			let indexCandidate = 0;
			for(let i = 0, j = this.joinsInput.length; i < j; i++) {
				if(this.joinsInput[i].index >= indexCandidate)
					indexCandidate = this.joinsInput[i].index + 1;
			}
			return indexCandidate;
		},
		relationsNested:function() {
			let that = this;
			
			let getChildRelationsByIndex = function(indexFrom) {
				let rels = [];
				
				for(let i = 0, j = that.joinsInput.length; i < j; i++) {
					if(that.joinsInput[i].indexFrom !== indexFrom)
						continue;
					
					let join   = JSON.parse(JSON.stringify(that.joinsInput[i]));
					let atr    = that.attributeIdMap[join.attributeId];
					let atrRel = that.relationIdMap[atr.relationId];
					let rel    = that.relationIdMap[join.relationId];
					
					rels.push({
						applyCreate:join.applyCreate,
						applyUpdate:join.applyUpdate,
						applyDelete:join.applyDelete,
						connector:join.connector,
						index:join.index,
						joins:getChildRelationsByIndex(join.index),
						joinAttributeId:atr.id,
						joinRelationId:rel.id,
						name:`${rel.name} <b>via</b> ${atrRel.name}.${atr.name}`
					});
				}
				return rels;
			};
			
			if(!this.module || !this.relation)
				return false;
			
			// source relation with all relations deep-nested
			return {
				applyCreate:this.joinsInput[0].applyCreate,
				applyUpdate:this.joinsInput[0].applyUpdate,
				applyDelete:this.joinsInput[0].applyDelete,
				connector:'INNER',
				index:0,
				joins:getChildRelationsByIndex(0),
				joinAttributeId:this.getNilUuid(),
				joinRelationId:this.relation.id,
				name:this.relation.name
			};
		},
		
		// inputs
		choicesInput:{
			get:function()  { return this.choices; },
			set:function(v) { this.$emit('set-choices',v); }
		},
		collectionsInput:{
			get:function()  { return this.collections; },
			set:function(v) { this.$emit('set-collections',v); }
		},
		filtersInput:{
			get:function()  { return this.filters; },
			set:function(v) { this.$emit('set-filters',v); }
		},
		fixedLimitInput:{
			get:function()  { return this.fixedLimit; },
			set:function(v) { this.$emit('set-fixed-limit',v === '' ? 0 : v); }
		},
		joinsInput:{
			get:function()  { return this.joins; },
			set:function(v) { this.$emit('set-joins',v); }
		},
		lookupsInput:{
			get:function()  { return this.lookups; },
			set:function(v) { this.$emit('set-lookups',v); }
		},
		ordersInput:{
			get:function()  { return this.orders; },
			set:function(v) { this.$emit('set-orders',v); }
		},
		relationIdInput:{
			get:function() {
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
			set:function(newVal) {
				this.$emit('set-relation-id',newVal);
			}
		},
		
		// stores
		module:        function() { return this.moduleIdMap[this.moduleId]; },
		modules:       function() { return this.$store.getters['schema/modules']; },
		moduleIdMap:   function() { return this.$store.getters['schema/moduleIdMap']; },
		relationIdMap: function() { return this.$store.getters['schema/relationIdMap']; },
		attributeIdMap:function() { return this.$store.getters['schema/attributeIdMap']; },
		capApp:        function() { return this.$store.getters.captions.builder.query; },
		capGen:        function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		// externals
		getDependentModules,
		getNilUuid,
		
		// presentation
		displayArrow:function(state,count) {
			return state && count !== 0 ? 'triangleDown.png' : 'triangleRight.png';
		},
		
		getRelationByIndex:function(index) {
			for(let i = 0, j = this.joinsInput.length; i < j; i++) {
				if(this.joinsInput[i].index === index)
					return this.joinsInput[i];
			}
			return false;
		},
		choiceAdd:function() {
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
		choiceApply:function(i,value) {
			this.choicesInput[i] = value;
			this.choicesInput = this.choicesInput;
		},
		choiceMove:function(i,down) {
			let c = this.choicesInput[i];
			this.choicesInput.splice(i,1);
			this.choicesInput.splice((down ? i + 1 : i - 1),0,c);
		},
		choiceRemove:function(i) {
			this.choicesInput.splice(i,1);
			this.choicesInput = this.choicesInput;
		},
		collectionAdd:function() {
			this.collectionsInput.push({
				collectionId:null,
				columnIdCollectionDisplay:null,
				columnIdCollectionValue:null,
				attributeId:null,
				attributeIndex:0
			});
			this.collectionsInput = this.collectionsInput;
			
			if(!this.showCollections)
				this.showCollections = true;
		},
		collectionApply:function(i,value) {
			this.collectionsInput[i] = value;
			this.collectionsInput = this.collectionsInput;
		},
		collectionRemove:function(i) {
			this.collectionsInput.splice(i,1);
			this.collectionsInput = this.collectionsInput;
		},
		filterAdd:function() {
			this.filterAddCnt++;
			
			if(!this.showFilters)
				this.showFilters = true;
		},
		orderAdd:function() {
			this.ordersInput.push({
				ascending:true,
				attributeId:null,
				index:0
			});
			this.ordersInput = this.ordersInput;
			
			if(!this.showOrders)
				this.showOrders = true;
		},
		
		// relation manipulation
		relationAdd:function(indexFrom,relationIdFrom,attributeId,connector) {
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
		relationRemove:function(index) {
			for(let i = 0, j = this.joinsInput.length; i < j; i++) {
				if(this.joinsInput[i].index !== index)
					continue;
				
				this.joinsInput.splice(i,1);
				break;
			}
			
			if(index === 0) {
				// source relation has changed
				this.relationIdInput = null;
				this.filtersInput    = [];
			}
			this.$emit('index-removed',index);
		},
		relationApplyToggle:function(index,content) {
			let r = this.getRelationByIndex(index);
			if(r === false) return;
			
			switch(content) {
				case 'create': r.applyCreate = !r.applyCreate; break;
				case 'update': r.applyUpdate = !r.applyUpdate; break;
				case 'delete': r.applyDelete = !r.applyDelete; break;
			}
			this.joinsInput = this.joinsInput;
		},
		relationConnectorSet:function(index,connector) {
			let r = this.getRelationByIndex(index);
			if(r === false) return;
			
			r.connector = connector;
			this.joinsInput = this.joinsInput;
		}
	}
};