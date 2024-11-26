import MyBuilderAttribute    from './builderAttribute.js';
import MyBuilderPreset       from './builderPreset.js';
import MyBuilderPgIndex      from './builderPgIndex.js';
import MyBuilderPgTriggers   from './builderPgTriggers.js';
import MyBuilderPresets      from './builderPresets.js';
import MyTabs                from '../tabs.js';
import {srcBase64}           from '../shared/image.js';
import {
	copyValueDialog,
	getNilUuid
} from '../shared/generic.js';
import {
	getAttributeIcon,
	isAttributeFiles,
	isAttributeRelationship,
	isAttributeRelationship11,
	isAttributeWithLength
} from '../shared/attribute.js';
import {
	getDependentModules,
	getDependentAttributes
} from '../shared/builder.js';

export {MyBuilderRelation as default};

let MyBuilderRelationsItemPolicy = {
	name:'my-builder-relations-item-policy',
	template:`<tr>
		<td><img v-if="!readonly" class="action dragAnchor" src="images/drag.png" /></td>
		<td>
			<select v-model="roleId" :disabled="readonly">
				<option v-for="r in module.roles" :value="r.id">{{ r.name }}</option>
				<optgroup
					v-for="mod in getDependentModules(module).filter(v => v.id !== module.id)"
					:label="mod.name"
				>
					<option v-for="r in mod.roles" :value="r.id">{{ r.name }}</option>
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
		module:(s) => s.$store.getters['schema/moduleIdMap'][s.moduleId],
		capApp:(s) => s.$store.getters.captions.builder.relation
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
		MyBuilderPgIndex,
		MyBuilderPgTriggers,
		MyBuilderPresets,
		MyBuilderRelationsItemPolicy,
		MyTabs
	},
	template:`<div class="contentBox grow scroll">
		<div class="top lower nowrap">
			<div class="area">
				<img class="icon" src="images/database.png" />
				<h1 class="title">{{ capApp.titleOne.replace('{NAME}',name) }}</h1>
			</div>
			<div class="area">
				<div class="row gap default-inputs" v-if="['attributes','presets'].includes(tabTarget)">
					<input v-model="nameFilter" :placeholder="capGen.threeDots" />
				</div>
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
		
		<div class="content no-padding builder-relation">
			<my-tabs
				v-model="tabTarget"
				:entries="['attributes','indexes','triggers','presets','policies','properties','relationships','data']"
				:entriesText="tabCaptions"
			/>
			
			<!-- attributes -->
			<div class="generic-entry-list tab-content" v-if="tabTarget === 'attributes'">
				<div class="entry"
					v-if="!readonly"
					@click="attributeIdEdit = null"
					:class="{ clickable:!readonly }"
				>
					<div class="row gap centered">
						<img class="icon" src="images/add.png" />
						<span>{{ capGen.button.new }}</span>
					</div>
				</div>
				
				<div class="entry clickable"
					@click="attributeIdEdit = atr.id"
					v-for="atr in relation.attributes.filter(v => nameFilter === '' || v.name.includes(nameFilter.toLowerCase()))"
				>
					<my-button
						:active="false"
						:captionTitle="capApp.attributeContent"
						:image="getAttributeIcon(atr.content,atr.contentUse,false,false)"
						:naked="true"
					/>
					<div class="lines">
						<span>{{ atr.name }}</span>
						<span class="subtitle" v-if="typeof atr.captions.attributeTitle[builderLanguage] !== 'undefined'">
							[{{ atr.captions.attributeTitle[builderLanguage] }}]
						</span>
					</div>
					<my-button image="lock.png"
						v-if="atr.encrypted"
						:active="false"
						:captionTitle="capApp.attributeEncrypted"
						:naked="true"
					/>
					<my-button
						v-if="isAttributeWithLength(atr.content) && atr.length !== 0"
						:active="false"
						:caption="'['+String(atr.length)+']'"
						:captionTitle="capApp.attributeLength"
						:naked="true"
					/>
					<my-button image="asterisk.png"
						v-if="!atr.nullable"
						:active="false"
						:captionTitle="capApp.attributeNotNullable"
						:naked="true"
					/>
					<my-button
						:active="false"
						:captionTitle="atr.iconId === null ? capApp.attributeNoIcon : capGen.icon"
						:image="atr.iconId === null ? 'icon_missing.png' : ''"
						:imageBase64="atr.iconId !== null ? srcBase64(iconIdMap[atr.iconId].file) : ''"
						:naked="true"
					/>
				</div>
				
				<!-- attribute dialog -->
				<my-builder-attribute
					v-if="attributeIdEdit !== false"
					@close="attributeIdEdit = false"
					@nextLanguage="$emit('nextLanguage')"
					@new-record="attributeIdEdit = null"
					:attributeId="attributeIdEdit"
					:builderLanguage="builderLanguage"
					:readonly="readonly"
					:relation="relation"
				/>
			</div>
			
			<!-- indexes -->
			<div class="generic-entry-list tab-content" v-if="tabTarget === 'indexes'">
				<div class="entry"
					v-if="!readonly"
					@click="indexIdEdit = null"
					:class="{ clickable:!readonly }"
				>
					<div class="row gap centered">
						<img class="icon" src="images/add.png" />
						<span>{{ capGen.button.new }}</span>
					</div>
				</div>
				
				<div class="entry clickable"
					@click="indexIdEdit = ind.id"
					v-for="ind in relation.indexes"
				>
					<my-button image="databaseAsterisk.png"
						:active="false"
						:naked="true"
					/>
					<div class="lines"><span>{{ displayIndexName(ind) }}</span></div>
					<my-button image="asterisk.png"
						v-if="ind.noDuplicates"
						:active="false"
						:captionTitle="capApp.indexUnique"
						:naked="true"
					/>
					<my-button image="cogMultiple.png"
						v-if="ind.primaryKey || ind.autoFki"
						:active="false"
						:captionTitle="capApp.indexSystem"
						:naked="true"
					/>
					<my-button image="key.png"
						v-if="ind.primaryKey"
						:active="false"
						:captionTitle="capApp.indexPrimaryKey"
						:naked="true"
					/>
					<my-button
						v-if="ind.autoFki"
						:active="false"
						:captionTitle="capApp.indexAutoFki"
						:image="attributeIdMap[ind.attributes[0].attributeId].content === '1:1' ? 'link1.png' : 'link3.png'"
						:naked="true"
					/>
					<my-button image="languages.png"
						v-if="ind.method === 'GIN'"
						:active="false"
						:captionTitle="capApp.indexText"
						:naked="true"
					/>
				</div>
				
				<!-- index dialog -->
				<my-builder-pg-index
					v-if="indexIdEdit !== false"
					@close="indexIdEdit = false"
					:pgIndexId="indexIdEdit"
					:builderLanguage="builderLanguage"
					:readonly="readonly"
					:relation="relation"
				/>
			</div>
			
			<!-- triggers -->
			<div class="tab-content" v-if="tabTarget === 'triggers'">
				<my-builder-pg-triggers
					:contextEntity="'relation'"
					:contextId="relation.id"
					:readonly="readonly"
				/>
			</div>
			
			<!-- presets -->
			<div class="tab-content" v-if="tabTarget === 'presets'">
				<my-builder-presets
					:filter="nameFilter"
					:relation="relation"
					:readonly="readonly"
				/>
			</div>
			
			<!-- policies -->
			<div class="tab-content" v-if="tabTarget === 'policies'">
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
				
				<div class="row gap">
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
			</div>
			
			<!-- relation properties -->
			<div class="tab-content" v-if="tabTarget === 'properties'">
				<table class="generic-table-vertical default-inputs">
					<tbody>
						<tr>
							<td>{{ capGen.name }}</td>
							<td><input class="long" v-model="name" :disabled="readonly" /></td>
							<td>{{ capApp.nameHint }}</td>
						</tr>
						<tr>
							<td>{{ capGen.comments }}</td>
							<td colspan="2"><textarea class="dynamic" v-model="comment" :disabled="readonly"></textarea></td>
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
									<tbody>
										<tr>
											<td>{{ capApp.retentionCount }}</td>
											<td><input v-model.number="retentionCount" :disabled="readonly" /></td>
										</tr>
										<tr>
											<td>{{ capApp.retentionDays }}</td>
											<td><input v-model.number="retentionDays" :disabled="readonly" /></td>
										</tr>
									</tbody>
								</table>
							</td>
							<td>{{ capApp.retentionHint }}</td>
						</tr>
					</tbody>
				</table>
				
				<div class="row">
					<my-button image="save.png"
						@trigger="set"
						:active="canSave"
						:caption="capGen.button.save"
						:captionTitle="capGen.button.save"
					/>
				</div>
			</div>

			<!-- relationship graph -->
			<div class="tab-content graph" v-if="tabTarget === 'relationships'">
				<echarts
					:option="graphOption"
					:theme="settings.dark ? 'dark' : ''"
				/>
			</div>
			
			<!-- data view -->
			<div class="tab-content builder-relation-preview default-inputs" v-if="tabTarget === 'data'">
				<div class="row gap centered space-between">
					<div class="row gap centered">
						<my-button image="pagePrev.png"
							@trigger="previewPage(false)"
							:active="previewOffset > 0"
						/>
						<input class="short" disabled="true" :title="capApp.previewPage" :value="(previewOffset / previewLimit) + 1" />
						<my-button image="pageNext.png"
							@trigger="previewPage(true)"
							:active="previewRows.length === previewLimit"
						/>
					</div>
					
					<div class="row gap centered">
						<span>{{ capApp.previewLimit }}</span>
						<select class="short"
							v-model.number="previewLimit"
							@change="previewReload"
						>
							<option v-for="i in 10" :value="i*10">{{ i*10 }}</option>
						</select>
					</div>
					
					<div class="row gap centered">
						<span>{{ capApp.previewRowCount }}</span>
						<input class="short" disabled="true" :value="previewRowCount" />
					</div>
				</div>
				
				<div class="builder-relation-preview-data shade">
					<table>
						<thead>
							<tr><th v-for="a in attributesNotFiles">{{ a.name }}</th></tr>
						</thead>
						<tbody>
							<tr v-for="r in previewRows">
								<td v-for="v in r" :title="v">{{ displayDataValue(v) }}</td>
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
	emits:['createNew','nextLanguage'],
	watch:{
		relation:{
			handler() { this.reset(); },
			immediate:true
		},
		tabTarget(vNew,vOld) {
			if(vNew === 'data')
				this.getPreview();
		}
	},
	data() {
		return {
			// inputs
			attributeIdEdit:false,
			comment:null,
			encryption:false,
			indexIdEdit:false,
			name:'',
			policies:[],
			retentionCount:null,
			retentionDays:null,
			
			// states
			nameFilter:'',
			previewLimit:50,
			previewOffset:0,
			previewRows:[],
			previewRowCount:0,
			previewValueLength:50,
			tabTarget:'attributes'
		};
	},
	computed:{
		tabCaptions:(s) => {
			let triggerCnt = 0;
			for(const mod of s.modules) {
				triggerCnt += mod.pgTriggers.filter(trg => trg.relationId === s.id).length;
			}

			return [
				s.capApp.attributes.replace('{CNT}',s.relation.attributes.length),
				s.capApp.indexes.replace('{CNT}',s.relation.indexes.length),
				s.capApp.triggers.replace('{CNT}',triggerCnt),
				s.capApp.presets.replace('{CNT}',s.relation.presets.length),
				s.capApp.policies.replace('{CNT}',s.relation.policies.length),
				s.capGen.properties,
				s.capApp.graph,
				s.capApp.preview
			];
		},

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
			
			// relationships to and from base relation
			for(const a of s.getDependentAttributes(s.moduleIdMap[s.relation.moduleId])) {
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
			|| s.comment                  !== s.relation.comment
			|| s.encryption               !== s.relation.encryption
			|| s.retentionCount           !== s.relation.retentionCount
			|| s.retentionDays            !== s.relation.retentionDays
			|| JSON.stringify(s.policies) !== JSON.stringify(s.relation.policies),
		
		// simple
		attributesNotFiles:(s) => s.relation === false ? [] : s.relation.attributes.filter(v => !s.isAttributeFiles(v.content)),
		canSave:           (s) => s.name !== '' && !s.readonly && s.hasChanges,
		relation:          (s) => typeof s.relationIdMap[s.id] === 'undefined' ? false : s.relationIdMap[s.id],
		
		// stores
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		modules:       (s) => s.$store.getters['schema/modules'],
		moduleIdMap:   (s) => s.$store.getters['schema/moduleIdMap'],
		relationIdMap: (s) => s.$store.getters['schema/relationIdMap'],
		iconIdMap:     (s) => s.$store.getters['schema/iconIdMap'],
		capApp:        (s) => s.$store.getters.captions.builder.relation,
		capGen:        (s) => s.$store.getters.captions.generic,
		settings:      (s) => s.$store.getters.settings
	},
	methods:{
		// externals
		copyValueDialog,
		getAttributeIcon,
		getDependentAttributes,
		getNilUuid,
		isAttributeFiles,
		isAttributeRelationship,
		isAttributeRelationship11,
		isAttributeWithLength,
		srcBase64,
		
		// presentation
		displayDataValue(v) {
			return typeof v !== 'string' || v.length < this.previewValueLength
				? v : v.substring(0, this.previewValueLength-3) + '...';
		},
		displayIndexName(ind) {
			if(ind.method === 'GIN')
				return `${this.attributeIdMap[ind.attributes[0].attributeId].name}`;
			
			let atrs = [];
			for(let indAtr of ind.attributes) {
				atrs.push(`${this.attributeIdMap[indAtr.attributeId].name} (${indAtr.orderAsc ? 'ASC' : 'DESC'})`);
			}
			return atrs.join(', ');
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
			this.comment        = this.relation.comment;
			this.encryption     = this.relation.encryption;
			this.retentionCount = this.relation.retentionCount;
			this.retentionDays  = this.relation.retentionDays;
			this.policies       = JSON.parse(JSON.stringify(this.relation.policies));
			
			if(this.tabTarget === 'data')
				this.previewReload();
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
				comment:this.comment === '' ? null : this.comment,
				encryption:this.relation.encryption,
				retentionCount:this.retentionCount === '' ? null : this.retentionCount,
				retentionDays:this.retentionDays === '' ? null : this.retentionDays,
				policies:this.policies
			},true).then(
				() => this.$root.schemaReload(this.relation.moduleId),
				this.$root.genericError
			);
		}
	}
};