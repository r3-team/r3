import MyBuilderAttribute    from './builderAttribute.js';
import MyBuilderPreset       from './builderPreset.js';
import MyBuilderPgTrigger    from './builderPgTrigger.js';
import MyBuilderPgIndex      from './builderPgIndex.js';
import {getDependentModules} from '../shared/builder.js';
import {
	copyValueDialog,
	getNilUuid
} from '../shared/generic.js';
import {
	isAttributeFiles,
	isAttributeRelationship,
	isAttributeRelationship11
} from '../shared/attribute.js';

export {MyBuilderRelation as default};

let MyBuilderRelationsItemPolicy = {
	name:'my-builder-relations-item-policy',
	template:`<tr>
		<td><img v-if="!readonly" class="action dragAnchor" src="images/drag.png" /></td>
		<td>
			<select v-model="roleId" :disabled="readonly">
				<optgroup
					v-for="mod in getDependentModules(module,modules)"
					:label="mod.name"
				>
					<option v-for="r in mod.roles" :value="r.id">
						{{ r.name }}
					</option>
				</optgroup>
			</select>
		</td>
		<td><my-bool v-model="actionSelect" :readonly="readonly" /></td>
		<td><my-bool v-model="actionUpdate" :readonly="readonly" /></td>
		<td><my-bool v-model="actionDelete" :readonly="readonly" /></td>
		<td>
			<select v-model="pgFunctionIdExcl" :disabled="readonly">
				<option :value="null">[{{ capApp.policyNotSet }}]</option>
				<option v-for="f in filterFunctions" :value="f.id">
					{{ f.name }}
				</option>
			</select>
		</td>
		<td>
			<select v-model="pgFunctionIdIncl" :disabled="readonly">
				<option :value="null">[{{ capApp.policyNotSet }}]</option>
				<option v-for="f in filterFunctions" :value="f.id">
					{{ f.name }}
				</option>
			</select>
		</td>
		<td>
			<my-button image="cancel.png"
				@trigger="$emit('remove')"
				:active="!readonly"
				:naked="true"
				:tight="true"
			/>
		</td>
	</tr>`,
	props:{
		modelValue:{ type:Object,  required:true },
		moduleId:  { type:String,  required:true },
		readonly:  { type:Boolean, required:true }
	},
	emits:['moveDown','moveUp','remove','update:modelValue'],
	computed:{
		filterFunctions() {
			// limit to integer array returns, as in: INTEGER[], bigint[], INT [] or integer ARRAY
			let pat = /^(integer|bigint|int)(\s?\[\]|\sarray)$/i;
			let out = [];
			for(let i = 0, j = this.module.pgFunctions.length; i < j; i++) {
				let f = this.module.pgFunctions[i];
				
				if(pat.test(f.codeReturns))
					out.push(f);
			}
			return out;
		},
		
		// inputs
		actionDelete:{
			get()  { return this.modelValue.actionDelete; },
			set(v) { this.update('actionDelete',v); }
		},
		actionSelect:{
			get()  { return this.modelValue.actionSelect; },
			set(v) { this.update('actionSelect',v); }
		},
		actionUpdate:{
			get()  { return this.modelValue.actionUpdate; },
			set(v) { this.update('actionUpdate',v); }
		},
		pgFunctionIdExcl:{
			get()  { return this.modelValue.pgFunctionIdExcl; },
			set(v) { this.update('pgFunctionIdExcl',v); }
		},
		pgFunctionIdIncl:{
			get()  { return this.modelValue.pgFunctionIdIncl; },
			set(v) { this.update('pgFunctionIdIncl',v); }
		},
		roleId:{
			get()  { return this.modelValue.roleId; },
			set(v) { this.update('roleId',v); }
		},
		
		// stores
		module: (s) => s.$store.getters['schema/moduleIdMap'][s.moduleId],
		modules:(s) => s.$store.getters['schema/modules'],
		capApp: (s) => s.$store.getters.captions.builder.relation
	},
	methods:{
		// external
		getDependentModules,
		
		update(name,value) {
			let v = JSON.parse(JSON.stringify(this.modelValue));
			v[name] = value;
			
			this.$emit('update:modelValue',v);
		}
	}
};

let MyBuilderRelation = {
	name:'my-builder-relation',
	components:{
		echarts:VueECharts,
		MyBuilderAttribute,
		MyBuilderPreset,
		MyBuilderPgTrigger,
		MyBuilderPgIndex,
		MyBuilderRelationsItemPolicy
	},
	template:`<div class="contentBox builder-relation">
		<div class="top lower nowrap">
			<div class="area">
				<img class="icon" src="images/database.png" />
				<h1 class="title">{{ capApp.titleOne.replace('{NAME}',name) }}</h1>
			</div>
			<div class="area">
				<my-button image="visible1.png"
					@trigger="copyValueDialog(relation.name,relation.id,relation.id)"
					:caption="capGen.id"
				/>
				<my-button image="delete.png"
					@trigger="delAsk"
					:active="!readonly"
					:cancel="true"
					:caption="capGen.button.delete"
					:captionTitle="capGen.button.delete"
				/>
			</div>
		</div>
		
		<div class="content no-padding">
			
			<!-- relation properties -->
			<div class="contentPart full">
				<div class="contentPartHeader clickable" @click="showRelation = !showRelation">
					<img class="icon" :src="displayArrow(showRelation)" />
					<h1>{{ capGen.properties }}</h1>
				</div>
				
				<template v-if="showRelation">
					<table class="builder-table-vertical default-inputs">
						<tr>
							<td>{{ capGen.name }}</td>
							<td><input class="long" v-model="name" :disabled="readonly" /></td>
							<td>{{ capApp.nameHint }}</td>
						</tr>
						<tr>
							<td>{{ capApp.encryption }}</td>
							<td><my-bool v-model="encryption" :readonly="true" /></td>
							<td>{{ capApp.encryptionHint }}</td>
						</tr>
						<tr>
							<td>{{ capApp.retention }}</td>
							<td>
								<table>
									<tr>
										<td>{{ capApp.retentionCount }}</td>
										<td><input v-model.number="retentionCount" :disabled="readonly" /></td>
									</tr>
									<tr>
										<td>{{ capApp.retentionDays }}</td>
										<td><input v-model.number="retentionDays" :disabled="readonly" /></td>
									</tr>
								</table>
							</td>
							<td>{{ capApp.retentionHint }}</td>
						</tr>
					</table>
					
					<div class="row">
						<my-button image="save.png"
							@trigger="set"
							:active="canSave"
							:caption="capGen.button.save"
							:captionTitle="capGen.button.save"
						/>
					</div>
				</template>
			</div>
			
			<!-- attributes -->
			<div class="contentPart full">
				<div class="contentPartHeader clickable" @click="showAttributes = !showAttributes">
					<img class="icon" :src="displayArrow(showAttributes)" />
					<h1>{{ capApp.attributes.replace('{CNT}',relation.attributes.length) }}</h1>
				</div>
				
				<table class="default-inputs" v-if="showAttributes">
					<thead>
						<tr>
							<th>{{ capGen.actions }}</th>
							<th>{{ capGen.icon }}</th>
							<th>{{ capGen.name }}</th>
							<th>{{ capGen.id }}</th>
							<th>{{ capGen.title }}</th>
							<th>{{ capApp.content }}</th>
							<th>{{ capApp.relationship }}</th>
							<th>{{ capApp.length }}</th>
							<th>{{ capApp.nullable }}</th>
							<th v-if="relation.encryption">{{ capApp.encrypted }}</th>
							<th>{{ capApp.def }}</th>
							<th>{{ capApp.onUpdate }}</th>
							<th>{{ capApp.onDelete }}</th>
						</tr>
					</thead>
					<tbody>
						<!-- new record -->
						<my-builder-attribute
							:builder-language="builderLanguage"
							:foreign="false"
							:readonly="readonly"
							:relation="relation"
						/>
						
						<!-- existing records -->
						<my-builder-attribute
							v-for="atr in relation.attributes"
							:attribute="atr"
							:builder-language="builderLanguage"
							:foreign="false"
							:key="atr.id"
							:readonly="readonly"
							:relation="relation"
						/>
						
						<!-- existing records by relationship (different key is important!) -->
						<template v-if="relationshipAttributes.length !== 0">
							<tr>
								<td colspan="999" class="clickable" @click="showExternal = !showExternal">
									<div class="references">
										<img :src="displayArrow(showExternal)" />
										<span>{{ capApp.external.replace('{CNT}',relationshipAttributes.length) }}</span>
									</div>
								</td>
							</tr>
							<my-builder-attribute
								v-if="showExternal"
								v-for="atr in relationshipAttributes"
								:attribute="atr"
								:builder-language="builderLanguage"
								:foreign="true"
								:key="atr.id+'_outsideIn'"
								:readonly="true"
								:relation="relationIdMap[atr.relationId]"
							/>
						</template>
					</tbody>
				</table>
			</div>
			
			<!-- indexes -->
			<div class="contentPart full" v-if="relation.attributes.length !== 0">
				<div class="contentPartHeader clickable" @click="showIndexes = !showIndexes">
					<img class="icon" :src="displayArrow(showIndexes)" />
					<h1>{{ capApp.indexes.replace('{CNT}',relation.indexes.length) }}</h1>
				</div>
				
				<table class="indexes default-inputs" v-if="showIndexes">
					<thead>
						<tr>
							<th>{{ capGen.actions }}</th>
							<th>{{ capApp.indexAttributes }}</th>
							<th>{{ capApp.indexAutoFki }}</th>
							<th>{{ capApp.indexUnique }}</th>
						</tr>
					</thead>
					<tbody>
						<!-- new index -->
						<my-builder-pg-index
							:readonly="readonly"
							:relation="relation"
						/>
						
						<!-- existing indexes -->
						<my-builder-pg-index
							v-for="ind in relation.indexes"
							:key="ind.id"
							:index="ind"
							:readonly="readonly"
							:relation="relation"
						/>
					</tbody>
				</table>
			</div>
			
			<!-- triggers -->
			<div class="contentPart full">
				<div class="contentPartHeader clickable" @click="showTriggers = !showTriggers">
					<img class="icon" :src="displayArrow(showTriggers)" />
					<h1>{{ capApp.triggers.replace('{CNT}',relation.triggers.length) }}</h1>
				</div>
				
				<table class="default-inputs" v-if="showTriggers">
					<thead>
						<tr>
							<th>{{ capGen.actions }}</th>
							<th>{{ capApp.fires }}</th>
							<th>{{ capGen.id }}</th>
							<th>{{ capApp.onInsert }}</th>
							<th>{{ capApp.onUpdate }}</th>
							<th>{{ capApp.onDelete }}</th>
							<th>{{ capApp.perRow }}</th>
							<th>{{ capApp.isDeferred }}</th>
							<th colspan="2">{{ capApp.execute }}</th>
						</tr>
					</thead>
					<tbody>
						<!-- new record -->
						<my-builder-pg-trigger
							:readonly="readonly"
							:relation="relation"
						/>
						
						<!-- existing records -->
						<my-builder-pg-trigger
							v-for="trg in relation.triggers"
							:key="trg.id"
							:readonly="readonly"
							:relation="relation"
							:pg-trigger="trg"
						/>
					</tbody>
				</table>
			</div>
			
			<!-- policies -->
			<div class="contentPart full">
				<div class="contentPartHeader clickable" @click="showPolicies = !showPolicies">
					<img class="icon" :src="displayArrow(showPolicies)" />
					<h1>{{ capApp.policies.replace('{CNT}',relation.policies.length) }}</h1>
				</div>
				
				<template v-if="showPolicies">
					<table class="default-inputs">
						<thead v-if="policies.length !== 0">
							<tr>
								<td></td>
								<td></td>
								<td colspan="3">{{ capApp.policyActions }}</td>
								<td colspan="2">{{ capApp.policyFunctions }}</td>
								<td colspan="2"></td>
							</tr>
							<tr>
								<td>{{ capGen.order }}</td>
								<td>{{ capGen.role }}</td>
								<td>{{ capApp.policyActionSelect }}</td>
								<td>{{ capApp.policyActionUpdate }}</td>
								<td>{{ capApp.policyActionDelete }}</td>
								<td>{{ capApp.policyFunctionExcl }}</td>
								<td>{{ capApp.policyFunctionIncl }}</td>
								<td colspan="2"></td>
							</tr>
						</thead>
						<draggable handle=".dragAnchor" tag="tbody" group="policies" itemKey="id" animation="100"
							:fallbackOnBody="true"
							:list="policies"
						>
							<template #item="{element,index}">
								<my-builder-relations-item-policy
									@remove="policies.splice(index,1)"
									@update:modelValue="policies[index] = $event"
									:modelValue="element"
									:moduleId="relation.moduleId"
									:readonly="readonly"
								/>
							</template>
						</draggable>
					</table>
					<p style="width:900px;" v-if="policies.length !== 0">
						{{ capApp.policyExplanation }}
					</p>
					
					<div class="row">
						<my-button image="add.png"
							@trigger="addPolicy"
							:active="!readonly"
							:caption="capGen.button.add"
						/>
						<my-button image="save.png"
							@trigger="set"
							:active="!readonly && hasChanges"
							:caption="capGen.button.save"
							:captionTitle="capGen.button.save"
						/>
					</div>
				</template>
			</div>
			
			<!-- presets -->
			<div class="contentPart full" v-if="relation.attributes.length !== 0">
				<div class="contentPartHeader clickable" @click="showPresets = !showPresets">
					<img class="icon" :src="displayArrow(showPresets)" />
					<h1>{{ capApp.presets.replace('{CNT}',relation.presets.length) }}</h1>
				</div>
				
				<table class="preset-records default-inputs" v-if="showPresets">
					<thead>
						<tr>
							<th>{{ capGen.actions }}</th>
							<th>{{ capGen.name }}</th>
							<th>{{ capApp.presetProtected }}</th>
							<th>{{ capApp.presetValues }}</th>
							<th>{{ capApp.presetValuesPreview }}</th>
						</tr>
					</thead>
					
					<!-- new record -->
					<my-builder-preset
						:builder-language="builderLanguage"
						:readonly="readonly"
						:relation="relation"
					/>
					
					<!-- existing records -->
					<my-builder-preset
						v-for="p in relation.presets"
						:builder-language="builderLanguage"
						:key="p.id"
						:preset="p"
						:readonly="readonly"
						:relation="relation"
					/>
				</table>
			</div>
			
			<!-- relationship graph -->
			<div class="contentPart full">
				<div class="contentPartHeader clickable" @click="showGraph = !showGraph">
					<img class="icon" :src="displayArrow(showGraph)" />
					<h1>{{ capApp.graph }}</h1>
				</div>
				
				<div class="graph" v-if="showGraph">
					<echarts
						:option="graphOption"
						:theme="settings.dark ? 'dark' : ''"
					/>
				</div>
			</div>
			
			<!-- data view -->
			<div class="contentPart full">
				<div class="contentPartHeader clickable" @click="togglePreview">
					<img class="icon" :src="displayArrow(showPreview)" />
					<h1>{{ capApp.preview }}</h1>
				</div>
				
				<div class="preview default-inputs" v-if="showPreview">
					<div class="actions">
						<my-button image="pagePrev.png"
							@trigger="previewPage(false)"
							:active="previewOffset > 0"
						/>
						<my-button image="pageNext.png"
							@trigger="previewPage(true)"
							:active="previewRows.length === previewLimit"
						/>
						
						<span>{{ capApp.previewPage }}</span>
						<input class="short" disabled="true"
							:value="(previewOffset / previewLimit) + 1"
						/>
						
						<span>{{ capApp.previewLimit }}</span>
						<select class="short"
							v-model.number="previewLimit"
							@change="previewReload"
						>
							<option v-for="i in 10" :value="i*10">{{ i*10 }}</option>
						</select>
						
						<span>{{ capApp.previewRowCount }}</span>
						<input class="short" disabled="true"
							:value="previewRowCount"
						/>
					</div>
					
					<table>
						<thead>
							<tr>
								<th v-for="a in attributesNotFiles">{{ a.name }}</th>
							</tr>
						</thead>
						<tbody>
							<tr v-for="r in previewRows">
								<td v-for="v in r" :title="v">
									{{ displayDataValue(v) }}
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</div>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		id:             { type:String,  required:true },
		readonly:       { type:Boolean, required:true }
	},
	watch:{
		relation:{
			handler:function() { this.reset(); },
			immediate:true
		}
	},
	data:function() {
		return {
			// inputs
			name:'',
			encryption:false,
			retentionCount:null,
			retentionDays:null,
			policies:[],
			
			// states
			previewLimit:10,
			previewOffset:0,
			previewRows:[],
			previewRowCount:0,
			previewValueLength:50,
			showAttributes:true,
			showExternal:false,
			showGraph:false,
			showIndexes:false,
			showPolicies:false,
			showPresets:false,
			showPreview:false,
			showRelation:false,
			showTriggers:false
		};
	},
	computed:{
		// relationship graph
		graphOption:(s) => {
			let edges = [];
			let nodes = [{ // base relation
				id:s.relation.id,
				name:s.relation.name,
				category:0,
				label:{ show:true },
				symbolSize:50,
				value:''
			}];
			
			// relationships to and from base relation (from all attributes)
			for(let k in s.attributeIdMap) {
				let a = s.attributeIdMap[k];
				
				if(!s.isAttributeRelationship(a.content))
					continue;
				
				// relationship to or from base relation
				if(a.relationshipId !== s.relation.id && a.relationId !== s.relation.id)
					continue;
				
				let relIn = a.relationshipId === s.relation.id;
				let rSource = relIn ? s.relationIdMap[a.relationshipId] : s.relationIdMap[a.relationId];
				let rTarget = relIn ? s.relationIdMap[a.relationId] : s.relationIdMap[a.relationshipId];
				
				let category = 1;
				if(!s.isAttributeRelationship11(a.content))
					category = relIn ? 3 : 2;
				
				let external = rTarget.moduleId !== s.relation.moduleId;
				
				nodes.push({
					id:relIn ? `${rTarget.id}.${a.id}` : `${rSource.id}.${a.id}`,
					name:external ? `${s.moduleIdMap[rTarget.moduleId].name}.${rTarget.name}` : rTarget.name,
					category:category,
					label:{
						show:true
					},
					symbolSize:30,
					value:relIn ? a.name : `${rSource.name}: ${a.name}`
				});
				edges.push({
					'source':relIn ? `${rTarget.id}.${a.id}` : `${rSource.id}`,
					'target':relIn ? `${rSource.id}` : `${rSource.id}.${a.id}`
				});
			}
			let categories = [
				{name:s.capApp.graphBase},
				{name:'1:1'},
				{name:'n:1'},
				{name:'1:n'}
			];
			
			return {
				backgroundColor:'transparent',
				label: { position:'right' },
				legend:[{
					data:categories.map(function(a) { return a.name; })
				}],
				series:[{
					categories:categories,
					data:nodes,
					edges:edges,
					edgeSymbol:['none','arrow'],
					emphasis: { focus:'adjacency' },
					force:{
						edgeLength:150,
						gravity:0,
						layoutAnimation:true,
						repulsion:150
					},
					layout:'force',
					lineStyle:{
						color:'source',
						width:3
					},
					roam:true, // user move/zoom
					type:'graph'
				}],
				tooltip:{} // must be set
			};
		},
		hasChanges:(s) => s.name          !== s.relation.name
			|| s.encryption               !== s.relation.encryption
			|| s.retentionCount           !== s.relation.retentionCount
			|| s.retentionDays            !== s.relation.retentionDays
			|| JSON.stringify(s.policies) !== JSON.stringify(s.relation.policies),
		relationshipAttributes:(s) => {
			let atrs = [];
			for(let key in s.attributeIdMap) {
				let atr = s.attributeIdMap[key];
				
				if(atr.relationId !== s.id && atr.relationshipId === s.id)
					atrs.push(atr);
			}
			return atrs;
		},
		
		// simple
		attributesNotFiles:(s) => s.relation === false ? [] : s.relation.attributes.filter(v => !s.isAttributeFiles(v.content)),
		canSave:           (s) => s.name !== '' && !s.readonly && s.hasChanges,
		relation:          (s) => typeof s.relationIdMap[s.id] === 'undefined' ? false : s.relationIdMap[s.id],
		
		// stores
		moduleIdMap:   (s) => s.$store.getters['schema/moduleIdMap'],
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		relationIdMap: (s) => s.$store.getters['schema/relationIdMap'],
		capApp:        (s) => s.$store.getters.captions.builder.relation,
		capGen:        (s) => s.$store.getters.captions.generic,
		settings:      (s) => s.$store.getters.settings
	},
	methods:{
		// externals
		copyValueDialog,
		getNilUuid,
		isAttributeFiles,
		isAttributeRelationship,
		isAttributeRelationship11,
		
		// presentation
		displayArrow(state) {
			return state ? 'images/triangleDown.png' : 'images/triangleRight.png';
		},
		displayDataValue(v) {
			if(typeof v !== 'string')
				return v;
			
			return v.length < this.previewValueLength
				? v : v.substring(0, this.previewValueLength-3) + '...';
		},
		
		// actions
		addPolicy() {
			this.policies.push({
				roleId:null,
				pgFunctionIdExcl:null,
				pgFunctionIdIncl:null,
				actionDelete:false,
				actionSelect:false,
				actionUpdate:false
			});
		},
		previewPage(next) {
			if(next) this.previewOffset += this.previewLimit;
			else     this.previewOffset -= this.previewLimit;
			
			this.getPreview();
		},
		previewReload() {
			this.previewOffset = 0;
			this.getPreview();
		},
		reset() {
			this.name           = this.relation.name;
			this.encryption     = this.relation.encryption;
			this.retentionCount = this.relation.retentionCount;
			this.retentionDays  = this.relation.retentionDays;
			this.policies       = JSON.parse(JSON.stringify(this.relation.policies));
			
			if(this.showPreview)
				this.previewReload();
		},
		togglePreview() {
			this.showPreview = !this.showPreview;
			
			if(this.showPreview)
				this.getPreview();
		},
		
		// backend calls
		delAsk() {
			this.$store.commit('dialog',{
				captionBody:this.capApp.dialog.delete,
				buttons:[{
					cancel:true,
					caption:this.capGen.button.delete,
					exec:this.del,
					image:'delete.png'
				},{
					caption:this.capGen.button.cancel,
					image:'cancel.png'
				}]
			});
		},
		del() {
			ws.send('relation','del',{id:this.relation.id},true).then(
				() => {
					this.$root.schemaReload(this.relation.moduleId);
					this.$router.push('/builder/relations/'+this.relation.moduleId);
				},
				this.$root.genericError
			);
		},
		getPreview() {
			ws.send('relation','preview',{
				id:this.id,
				limit:this.previewLimit,
				offset:this.previewOffset
			},true).then(
				res => {
					this.previewRows     = res.payload.rows;
					this.previewRowCount = res.payload.rowCount;
				},
				this.$root.genericError
			);
		},
		set() {
			ws.send('relation','set',{
				id:this.id,
				moduleId:this.relation.moduleId,
				name:this.name,
				encryption:this.relation.encryption,
				retentionCount:this.retentionCount,
				retentionDays:this.retentionDays,
				policies:this.policies
			},true).then(
				() => this.$root.schemaReload(this.moduleId),
				this.$root.genericError
			);
		}
	}
};