import MyBuilderAttribute          from './builderAttribute.js';
import MyBuilderCaption            from './builderCaption.js';
import MyBuilderPreset             from './builderPreset.js';
import MyBuilderPgIndex            from './builderPgIndex.js';
import MyBuilderPgTriggers         from './builderPgTriggers.js';
import MyBuilderPresets            from './builderPresets.js';
import MyInputDecimal              from '../inputDecimal.js';
import MyInputOffset               from '../inputOffset.js';
import {getTemplateRelationPolicy} from '../shared/builderTemplate.js';
import {dialogDeleteAsk}           from '../shared/dialog.js';
import {srcBase64}                 from '../shared/image.js';
import {
	getAttributeIcon,
	isAttributeDecimal,
	isAttributeFiles,
	isAttributeInteger,
	isAttributeRelationship,
	isAttributeRelationship11,
	isAttributeString,
	isAttributeUuid,
	isAttributeWithLength
} from '../shared/attribute.js';
import {
	getDependentModules,
	getDependentAttributes
} from '../shared/builder.js';
import {
	copyValueDialog,
	deepIsEqual
} from '../shared/generic.js';

const MyBuilderRelationsItemPolicy = {
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
		module:s => s.$store.getters['schema/moduleIdMap'][s.moduleId],
		capApp:s => s.$store.getters.captions.builder.relation
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

export default {
	name:'my-builder-relation',
	components:{
		echarts:VueECharts,
		MyBuilderAttribute,
		MyBuilderCaption,
		MyBuilderPreset,
		MyBuilderPgIndex,
		MyBuilderPgTriggers,
		MyBuilderPresets,
		MyBuilderRelationsItemPolicy,
		MyInputDecimal,
		MyInputOffset
	},
	template:`<div class="contentBox grow scroll">
		<div class="top lower nowrap">
			<div class="area">
				<img class="icon" src="images/database.png" />
				<h1 class="title">{{ capApp.titleOne.replace('{NAME}',relation.name) }}</h1>
			</div>
			<div class="area">
				<div class="row gap default-inputs" v-if="['attributes','presets'].includes(tabTarget)">
					<input v-model="nameFilter" :placeholder="capGen.threeDots" />
				</div>
			</div>
			<div class="area">
				<my-button image="visible1.png"
					@trigger="copyValueDialog(relation.name,relation.id,relation.id)"
					:caption="capGen.id"
				/>
				<my-button image="delete.png"
					@trigger="dialogDeleteAsk(del,capApp.dialog.delete)"
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
				:entries="['attributes','properties','indexes','triggers','presets','policies','relationships','data']"
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
					:builderLanguage
					:readonly
					:relation
				/>
			</div>

			<!-- properties -->
			<div class="contentBox" v-if="tabTarget === 'properties'">
				<div class="top lower">
					<div class="area">
						<my-button image="save.png"
							@trigger="set"
							:active="canSave"
							:caption="capGen.button.save"
							:captionTitle="capGen.button.save"
						/>
						<my-button image="refresh.png"
							@trigger="reset(true)"
							:active="isChanged"
							:caption="capGen.button.refresh"
						/>
					</div>
				</div>
				
				<div class="content default-inputs no-padding">
					<table class="generic-table-vertical default-inputs">
						<tbody>
							<tr>
								<td>{{ capGen.name }}</td>
								<td><input class="long" v-model="relation.name" :disabled="readonly" /></td>
								<td>{{ capApp.nameHint }}</td>
							</tr>
							<tr>
								<td>{{ capGen.title }}</td>
								<td>
									<my-builder-caption
										v-model="relation.captions.relationTitle"
										:language="builderLanguage"
										:readonly
									/>
								</td>
								<td>{{ capApp.titleHint }}</td>
							</tr>
							<tr>
								<td>{{ capGen.comments }}</td>
								<td colspan="2">
									<textarea class="dynamic"
										@input="relation.comment = $event.target.value !== '' ? $event.target.value : null"
										:disabled="readonly"
										:value="relation.comment"
									></textarea>
								</td>
							</tr>
							<tr>
								<td>{{ capApp.recordTitle }}</td>
								<td>
									<div class="column gap">
										<select @input="recordTitleAttributeAdd($event.target.value)" :disabled="readonly" :value="recordTitleAttributeId">
											<option value="">[{{ capGen.button.add }}]</option>
											<option v-for="a in attributesRecordTitleCandidates" :value="a.id">{{ a.name }}</option>
										</select>
										<div class="row gap">
											<my-button image="delete.png"
												v-for="id in relation.attributeIdsTitle"
												@trigger="recordTitleAttributeRemove(id)"
												:active="!readonly"
												:caption="attributeIdMap[id].name"
												:naked="true"
											/>
										</div>
									</div>
								</td>
								<td v-html="capApp.recordTitleHint.join('<br /><br />')"></td>
							</tr>
							<tr>
								<td>{{ capApp.retention }}</td>
								<td>
									<table>
										<tbody>
											<tr>
												<td>{{ capApp.retentionCount }}</td>
												<td><my-input-decimal v-model="relation.retentionCount" :min="0" :allowNull="true" :lengthFract="0" :readonly /></td>
											</tr>
											<tr>
												<td>{{ capApp.retentionDays }}</td>
												<td><my-input-decimal v-model="relation.retentionDays" :min="0" :allowNull="true" :lengthFract="0" :readonly /></td>
											</tr>
										</tbody>
									</table>
								</td>
								<td>{{ capApp.retentionHint }}</td>
							</tr>
							<tr>
								<td>{{ capApp.encryption }}</td>
								<td><my-bool v-model="relation.encryption" :readonly="true" /></td>
								<td>{{ capApp.encryptionHint }}</td>
							</tr>
						</tbody>
					</table>
				</div>
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
					:builderLanguage
					:readonly
					:relation
				/>
			</div>
			
			<!-- triggers -->
			<div class="tab-content" v-if="tabTarget === 'triggers'">
				<my-builder-pg-triggers :contextEntity="'relation'" :contextId="relation.id" :readonly />
			</div>
			
			<!-- presets -->
			<div class="tab-content" v-if="tabTarget === 'presets'">
				<my-builder-presets :filter="nameFilter" :relation :readonly />
			</div>
			
			<!-- policies -->
			<div class="tab-content" v-if="tabTarget === 'policies'">
				<table class="default-inputs">
					<thead v-if="relation.policies.length !== 0">
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
						:list="relation.policies"
					>
						<template #item="{element,index}">
							<my-builder-relations-item-policy
								@remove="relation.policies.splice(index,1)"
								@update:modelValue="relation.policies[index] = $event"
								:modelValue="element"
								:moduleId="relation.moduleId"
								:readonly
							/>
						</template>
					</draggable>
				</table>
				<p style="width:900px;" v-if="relation.policies.length !== 0">
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
						:active="!readonly && isChanged"
						:caption="capGen.button.save"
						:captionTitle="capGen.button.save"
					/>
				</div>
			</div>

			<!-- relationship graph -->
			<div class="tab-content graph" v-if="tabTarget === 'relationships'">
				<echarts
					@click="graphClicked"
					:autoresize="true"
					:option="graphOption"
					:theme="settings.dark ? 'dark' : ''"
				/>
			</div>
			
			<!-- data view -->
			<div class="tab-content builder-relation-preview default-inputs" v-if="tabTarget === 'data'">
				<div class="row gap centered space-between">
					<div class="row gap centered">
						<span>{{ capApp.previewLimit }}</span>
						<select class="short"
							v-model.number="previewLimit"
							@change="previewReload"
						>
							<option v-for="i in 10" :value="i*10">{{ i*10 }}</option>
						</select>
					</div>
					
					<my-input-offset
						@input="previewOffset = $event; getPreview()"
						:caption="true"
						:limit="previewLimit"
						:offset="previewOffset"
						:total="previewRowCount"
					/>
					
					<my-button image="refresh.png"
						@trigger="getPreview"
						:caption="capGen.button.refresh"
					/>
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
		relationSchema:{
			handler() { this.reset(false); },
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
			relation:false,  // relation being edited in this component
			relationCopy:{}, // copy of relation from schema when component last reset

			// states
			attributeIdEdit:false,
			indexIdEdit:false,
			nameFilter:'',
			previewLimit:50,
			previewOffset:0,
			previewRows:[],
			previewRowCount:0,
			previewValueLength:50,
			recordTitleAttributeId:'',
			tabTarget:'attributes'
		};
	},
	mounted() {
		window.addEventListener('keydown',this.handleHotkeys);
	},
	unmounted() {
		window.removeEventListener('keydown',this.handleHotkeys);
	},
	computed:{
		attributesRecordTitleCandidates:s => {
			let out = [];
			for(const a of s.relation.attributes) {
				if(!s.relation.attributeIdsTitle.includes(a.id) && a.contentUse === 'default' && (
						s.isAttributeString(a.content) || s.isAttributeDecimal(a.content) ||
						s.isAttributeInteger(a.content) || s.isAttributeUuid(a.content)
					)
				) {
					out.push(a);
				}
			}
			return out;
		},
		tabCaptions:s => {
			let triggerCnt = 0;
			for(const mod of s.modules) {
				triggerCnt += mod.pgTriggers.filter(trg => trg.relationId === s.id).length;
			}

			return [
				s.capApp.attributes.replace('{CNT}',s.relation.attributes.length),
				s.capGen.properties,
				s.capApp.indexes.replace('{CNT}',s.relation.indexes.length),
				s.capApp.triggers.replace('{CNT}',triggerCnt),
				s.capApp.presets.replace('{CNT}',s.relation.presets.length),
				s.capApp.policies.replace('{CNT}',s.relation.policies.length),
				s.capApp.graph,
				s.capApp.preview
			];
		},

		// relationship graph
		graphOption:s => {
			let edges = [];
			let nodes = [{ // base relation
				id:s.relation.id,
				name:s.relation.name,
				category:0,
				label:{ show:true },
				r3:{ relationId:null },
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
					label:{ show:true },
					r3:{ relationId:rTarget.id },
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

		// simple
		attributesNotFiles:s => s.relation === false ? [] : s.relation.attributes.filter(v => !s.isAttributeFiles(v.content)),
		canSave:           s => s.relation.name !== '' && !s.readonly && s.isChanged,
		isChanged:         s => !s.deepIsEqual(s.relation,s.relationSchema),
		relationSchema:    s => s.relationIdMap[s.id] === undefined ? false : s.relationIdMap[s.id],
		
		// stores
		attributeIdMap:s => s.$store.getters['schema/attributeIdMap'],
		modules:       s => s.$store.getters['schema/modules'],
		moduleIdMap:   s => s.$store.getters['schema/moduleIdMap'],
		relationIdMap: s => s.$store.getters['schema/relationIdMap'],
		iconIdMap:     s => s.$store.getters['schema/iconIdMap'],
		capApp:        s => s.$store.getters.captions.builder.relation,
		capGen:        s => s.$store.getters.captions.generic,
		settings:      s => s.$store.getters.settings
	},
	methods:{
		// externals
		copyValueDialog,
		deepIsEqual,
		dialogDeleteAsk,
		getAttributeIcon,
		getDependentAttributes,
		getTemplateRelationPolicy,
		isAttributeDecimal,
		isAttributeFiles,
		isAttributeInteger,
		isAttributeRelationship,
		isAttributeRelationship11,
		isAttributeString,
		isAttributeUuid,
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
			this.relation.policies.push(this.getTemplateRelationPolicy());
		},
		handleHotkeys(e) {
			if(e.ctrlKey && e.key === 's') {
				if(this.tabTarget === 'properties' && this.canSave)
					this.set();

				e.preventDefault();
			}
		},
		graphClicked(ev) {
			if(typeof ev.data.r3.relationId !== 'undefined' && ev.data.r3.relationId !== null)
				this.$router.push('/builder/relation/'+ev.data.r3.relationId);
		},
		previewReload() {
			this.previewOffset = 0;
			this.getPreview();
		},
		recordTitleAttributeAdd(id) {
			this.relation.attributeIdsTitle.push(id);
			this.recordTitleAttributeId = '';
		},
		recordTitleAttributeRemove(id) {
			const pos = this.relation.attributeIdsTitle.indexOf(id);
			if(pos !== -1)
				this.relation.attributeIdsTitle.splice(pos,1);
		},
		reset(manuelReset) {
			if(this.relationSchema !== false && (manuelReset || !this.deepIsEqual(this.relationCopy,this.relationSchema))) {
				this.relation     = JSON.parse(JSON.stringify(this.relationSchema));
				this.relationCopy = JSON.parse(JSON.stringify(this.relationSchema));

				if(this.tabTarget === 'data')
					this.previewReload();
			}
		},
		
		// backend calls
		del() {
			ws.send('relation','del',this.relation.id,true).then(
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
			ws.send('relation','set',this.relation,true).then(
				() => { this.$root.schemaReload(this.relation.moduleId); },
				this.$root.genericError
			);
		}
	}
};