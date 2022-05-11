import MyBuilderAttribute from './builderAttribute.js';
import MyBuilderPreset    from './builderPreset.js';
import MyBuilderPgTrigger from './builderPgTrigger.js';
import MyBuilderPgIndex   from './builderPgIndex.js';
import {
	isAttributeRelationship,
	isAttributeRelationship11
} from '../shared/attribute.js';

export {MyBuilderRelation as default};

let MyBuilderRelation = {
	name:'my-builder-relation',
	components:{
		echarts:VueECharts,
		MyBuilderAttribute,
		MyBuilderPreset,
		MyBuilderPgTrigger,
		MyBuilderPgIndex
	},
	template:`<div class="contentBox builder-relation" v-if="relation">
		<div class="top nowrap clickable">
			<div class="area">
				{{ capApp.titleOne.replace('{NAME}',relation.name) }}
			</div>
		</div>
		
		<div class="content no-padding">
			
			<!-- attributes -->
			<div class="contentPart full">
				<div class="contentPartHeader clickable" @click="showAttributes = !showAttributes">
					<img class="icon" :src="displayArrow(showAttributes)" />
					<h1>{{ capApp.attributes.replace('{CNT}',relation.attributes.length) }}</h1>
				</div>
				
				<table class="default-inputs" v-if="showAttributes">
					<thead>
						<tr>
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
							<th></th>
						</tr>
					</thead>
					<tbody>
						<!-- new record -->
						<my-builder-attribute
							:builder-language="builderLanguage"
							:foreign="false"
							:relation="relation"
						/>
						
						<!-- existing records -->
						<my-builder-attribute
							v-for="atr in relation.attributes"
							:attribute="atr"
							:builder-language="builderLanguage"
							:foreign="false"
							:key="atr.id"
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
							<th>{{ capApp.indexAttributes }}</th>
							<th>{{ capApp.indexAutoFki }}</th>
							<th>{{ capApp.indexUnique }}</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						<!-- new index -->
						<my-builder-pg-index
							:relation="relation"
						/>
						
						<!-- existing indexes -->
						<my-builder-pg-index
							v-for="ind in relation.indexes"
							:key="ind.id"
							:index="ind"
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
							<th>{{ capApp.fires }}</th>
							<th>{{ capGen.id }}</th>
							<th>{{ capApp.onInsert }}</th>
							<th>{{ capApp.onUpdate }}</th>
							<th>{{ capApp.onDelete }}</th>
							<th>{{ capApp.perRow }}</th>
							<th>{{ capApp.isConstraint }}</th>
							<th>{{ capApp.isDeferrable }}</th>
							<th>{{ capApp.isDeferred }}</th>
							<th>{{ capApp.codeCondition }}</th>
							<th>{{ capGen.button.open }}</th>
							<th>{{ capApp.execute }}</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						<!-- new record -->
						<my-builder-pg-trigger
							:relation="relation"
						/>
						
						<!-- existing records -->
						<my-builder-pg-trigger
							v-for="trg in relation.triggers"
							:key="trg.id"
							:relation="relation"
							:pg-trigger="trg"
						/>
					</tbody>
				</table>
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
							<th>{{ capGen.name }}</th>
							<th>{{ capApp.presetProtected }}</th>
							<th>{{ capApp.presetValues }}</th>
							<th>{{ capApp.presetValuesPreview }}</th>
							<th></th>
						</tr>
					</thead>
					
					<!-- new record -->
					<my-builder-preset
						:builder-language="builderLanguage"
						:relation="relation"
					/>
					
					<!-- existing records -->
					<my-builder-preset
						v-for="p in relation.presets"
						:builder-language="builderLanguage"
						:key="p.id"
						:preset="p"
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
								<th v-for="a in relation.attributes">{{ a.name }}</th>
							</tr>
						</thead>
						<tbody>
							<tr v-for="r in previewRows">
								<td v-for="v in r">{{ v }}</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</div>`,
	watch:{
		id:function() {
			if(this.showPreview)
				this.previewReload();
		}
	},
	props:{
		builderLanguage:{ type:String, required:true },
		id:             { type:String, required:true }
	},
	data:function() {
		return {
			previewLimit:10,
			previewOffset:0,
			previewRows:[],
			previewRowCount:0,
			showAttributes:true,
			showExternal:false,
			showGraph:false,
			showIndexes:false,
			showPresets:false,
			showPreview:false,
			showTriggers:false
		};
	},
	computed:{
		relation:function() {
			return typeof this.relationIdMap[this.id] === 'undefined'
				? false : this.relationIdMap[this.id];
		},
		relationshipAttributes:function() {
			let atrs = [];
			for(let key in this.attributeIdMap) {
				let atr = this.attributeIdMap[key];
				
				if(atr.relationId !== this.id && atr.relationshipId === this.id)
					atrs.push(atr);
			}
			return atrs;
		},
		
		// relationship graph
		graphOption:function() {
			let edges = [];
			let nodes = [{ // base relation
				id:this.relation.id,
				name:this.relation.name,
				category:0,
				label:{
					show:true
				},
				symbolSize:50,
				value:''
			}];
			
			// relationships to and from base relation (from all attributes)
			for(let k in this.attributeIdMap) {
				let a = this.attributeIdMap[k];
				
				if(!this.isAttributeRelationship(a.content))
					continue;
				
				// relationship to or from base relation
				if(a.relationshipId !== this.relation.id && a.relationId !== this.relation.id)
					continue;
				
				let relIn = a.relationshipId === this.relation.id;
				let rSource = relIn ? this.relationIdMap[a.relationshipId] : this.relationIdMap[a.relationId];
				let rTarget = relIn ? this.relationIdMap[a.relationId] : this.relationIdMap[a.relationshipId];
				
				let category = 1;
				if(!this.isAttributeRelationship11(a.content))
					category = relIn ? 3 : 2;
				
				let external = rTarget.moduleId !== this.relation.moduleId;
				
				nodes.push({
					id:relIn ? `${rTarget.id}.${a.id}` : `${rSource.id}.${a.id}`,
					name:external ? `${this.moduleIdMap[rTarget.moduleId].name}.${rTarget.name}` : rTarget.name,
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
				{name:this.capApp.graphBase},
				{name:'1:1'},
				{name:'n:1'},
				{name:'1:n'}
			];
			
			return {
				backgroundColor:'transparent',
				label: {
					position:'right'
				},
				legend:[{
					data:categories.map(function(a) {
						return a.name;
					})
				}],
				series:[{
					categories:categories,
					data:nodes,
					edges:edges,
					edgeSymbol:['none','arrow'],
					emphasis: {
						focus:'adjacency'
					},
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
		
		// stores
		moduleIdMap:   function() { return this.$store.getters['schema/moduleIdMap']; },
		attributeIdMap:function() { return this.$store.getters['schema/attributeIdMap']; },
		relationIdMap: function() { return this.$store.getters['schema/relationIdMap']; },
		capApp:        function() { return this.$store.getters.captions.builder.relation; },
		capGen:        function() { return this.$store.getters.captions.generic; },
		settings:      function() { return this.$store.getters.settings; }
	},
	methods:{
		// externals
		isAttributeRelationship,
		isAttributeRelationship11,
		
		// presentation
		displayArrow:function(state) {
			return state ? 'images/triangleDown.png' : 'images/triangleRight.png';
		},
		
		// actions
		previewPage:function(next) {
			if(next) this.previewOffset += this.previewLimit;
			else     this.previewOffset -= this.previewLimit;
			
			this.getPreview();
		},
		previewReload:function() {
			this.previewOffset = 0;
			this.getPreview();
		},
		togglePreview:function() {
			this.showPreview = !this.showPreview;
			
			if(this.showPreview)
				this.getPreview();
		},
		
		// backend calls
		getPreview:function() {
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
		}
	}
};