import MyBuilderAggregatorInput       from './builderAggregatorInput.js';
import MyBuilderCaption               from './builderCaption.js';
import MyBuilderColumnArguments       from './builderColumnArguments.js';
import MyBuilderDocSets               from './builderDocSets.js';
import MyBuilderQuery                 from './builderQuery.js';
import MyInputDecimal                 from '../inputDecimal.js';
import MyInputRange                   from '../inputRange.js';
import {getIndexAttributeIdsByJoins}  from '../shared/attribute.js';
import {getDependentModules}          from '../shared/builder.js';
import {getTemplateQuery}             from '../shared/builderTemplate.js';
import {getColumnIcon}                from '../shared/column.js';
import {getCaptionByIndexAttributeId} from '../shared/query.js';
import {getDocColumnTitle}            from '../shared/builderDoc.js';

export default {
	name:'my-builder-doc-column',
	components:{
		MyBuilderAggregatorInput,
		MyBuilderCaption,
		MyBuilderColumnArguments,
		MyBuilderDocSets,
		MyBuilderQuery,
		MyInputDecimal,
		MyInputRange
	},
	template:`<div class="builder-doc-column" :class="classCss" :title="isDragPreview ? '' : title">
		<div class="builder-doc-column-title" v-if="!isDragPreview">
			<img :src="'images/' + icon" />
			<span>{{ title }}</span>
		</div>

		<teleport v-if="isOptionsShow" :to="elmOptions">
			<div class="top lower">
				<div class="area">
					<img class="icon" src="images/dash.png" />
					<img class="icon" :src="'images/' + icon" />
					<h2>{{ titleBar }}</h2>
				</div>
				<div class="area">
					<my-button image="cancel.png"
						@trigger="$emit('close')"
						:cancel="true"
						:captionTitle="capGen.button.close"
					/>
				</div>
			</div>

			<table class="generic-table-vertical default-inputs">
				<tbody>
					<tr>
						<td>{{ capGen.title }}</td>
						<td>
							<my-builder-caption
								v-model="column.captions.docColumnTitle"
								:contentName="capGen.title"
								:language="builderLanguage"
								:longInput="true"
								:readonly
							/>
						</td>
					</tr>
					<tr>
						<td>{{ capGen.prefix }}</td>
						<td><input v-model="column.textPrefix" :disabled="readonly" /></td>
					</tr>
					<tr>
						<td>{{ capGen.postfix }}</td>
						<td><input v-model="column.textPostfix" :disabled="readonly" /></td>
					</tr>
					<tr>
						<td>{{ capGen.lengthChars }}</td>
						<td>
							<my-input-decimal class="short" v-if="column.length !== 0" v-model="column.length" :min="0" :allowNull="false" :lengthFract="0" :readonly />
							<my-button v-else @trigger="column.length = 50" :active="!readonly" :caption="capGen.noLimit" :naked="true" />
						</td>
					</tr>
					<tr>
						<td>{{ capGen.sizeX }}</td>
						<td>
							<div class="row gap centered" v-if="column.sizeX !== 0">
								<my-input-range   class="short" v-model="column.sizeX" :min="1" :max="sizeXMax" :readonly :step="0.1" />
								<my-input-decimal class="short" v-model="column.sizeX" :min="1" :max="sizeXMax" :readonly :allowNull="false" :length="5" :lengthFract="2" />
								<my-button image="cancel.png" :active="column.sizeX !== 0 && !readonly" :naked="true" @trigger="column.sizeX = 0" />
								<span>mm</span>
							</div>
							<my-button
								v-else
								@trigger="column.sizeX = 50"
								:active="!readonly"
								:caption="capGen.automatic"
								:naked="true"
							/>
						</td>
					</tr>
					<tr><td colspan="2"><b>{{ capGen.dataAccess }}</b></td></tr>
					<template v-if="isWithQuery">
						<tr>
							<td colspan="2">
								<my-builder-query
									@update:modelValue="column.query = $event"
									:allowChoices="false"
									:allowOrders="true"
									:builderLanguage
									:filtersDisable
									:joinsParents="[joinsParent]"
									:modelValue="query"
									:moduleId
									:readonly
								/>
							</td>
						</tr>
						<tr>
							<td>{{ capGen.attribute }}*</td>
							<td>
								<select
									@input="setIndexAttribute($event.target.value)"
									:value="column.attributeIndex+'_'+column.attributeId"
								>
									<option value="0_null">-</option>
									<option v-for="ia in indexAttributeIds" :value="ia">
										{{ getCaptionByIndexAttributeId(ia) }}
									</option>
								</select>
							</td>
						</tr>
					</template>
					<tr v-if="isFncPg">
						<td>{{ capGen.functionBackend }}*</td>
						<td>
							<select
								@input="column.pgFunctionId = $event.target.value === '' ? null : $event.target.value"
								:disabled="readonly"
								:value="column.pgFunctionId === null ? '' : column.pgFunctionId"
							>
								<option value="">-</option>
								<option v-for="fnc in module.pgFunctions.filter(v => v.isColumnExec)" :value="fnc.id">
									{{ fnc.name }}
								</option>
								<optgroup
									v-for="mod in getDependentModules(module).filter(v => v.id !== module.id && v.pgFunctions.filter(v => v.isColumnExec).length !== 0)"
									:label="mod.name"
								>
									<option v-for="fnc in mod.pgFunctions.filter(v => v.isColumnExec)" :value="fnc.id">
										{{ fnc.name }}
									</option>
								</optgroup>
							</select>
						</td>
					</tr>
					<tr v-if="isFncScalar">
						<td>{{ capGen.mode }}</td>
						<td>
							<select v-model="column.scalar" :disabled="readonly">
								<option value="CONCAT">{{ capGen.scalarFunction.CONCAT }}</option>
								<option value="COALESCE">{{ capGen.scalarFunction.COALESCE }}</option>
							</select>
						</td>
					</tr>
					<tr v-if="isWithArgs">
						<td>
							<div class="column gap">
								<span v-if="isFncScalar">{{ capGen.values }}</span>
								<span v-if="isFncPg">{{ capGen.arguments }}</span>
								<my-button image="add.png"
									@trigger="addArgument"
									:active="!readonly"
									:caption="capGen.button.add"
									:naked="true"
								/>
							</div>
						</td>
						<td>
							<my-builder-column-arguments
								v-model="column.arguments"
								:joinsParents="[joinsParent]"
								:readonly
							/>
						</td>
					</tr>
					<tr>
						<td>{{ capGen.aggregator }}</td>
						<td><my-builder-aggregator-input v-model="column.aggregator" :readonly /></td>
					</tr>
					<tr>
						<td>{{ capGen.options }}</td>
						<td>
							<div class="row gap centered">
								<my-button-check v-model="column.distincted" :caption="capGen.distincted" :readonly />
								<my-button-check v-model="column.groupBy"    :caption="capGen.groupBy"    :readonly />
							</div>
						</td>
					</tr>
					<tr>
						<td>{{ capGen.resultRow }}</td>
						<td><my-builder-aggregator-input v-model="column.aggregatorRow" :itemsFilter="['record','list','array']" :readonly /></td>
					</tr>
				</tbody>
			</table>

			<div class="content grow">
				<div class="builder-doc-sub-settings">
					<my-tabs
						v-model="tabTargetArea"
						:entries="tabTargetAreaList.entries"
						:entriesText="tabTargetAreaList.labels"
					/>
					<my-builder-doc-sets
						v-if="tabTargetArea === 'body'"
						v-model="column.setsBody"
						:allowData="true"
						:allowValue="true"
						:joins
						:readonly
						:showFont="true"
						:showText="true"
					/>
					<my-builder-doc-sets
						v-if="tabTargetArea === 'header'"
						v-model="column.setsHeader"
						:allowData="true"
						:allowValue="true"
						:joins
						:readonly
						:showFont="true"
						:showText="true"
					/>
					<my-builder-doc-sets
						v-if="tabTargetArea === 'footer'"
						v-model="column.setsFooter"
						:allowData="true"
						:allowValue="true"
						:joins
						:readonly
						:showFont="true"
						:showText="true"
					/>
				</div>
			</div>
		</teleport>
	</div>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		elmOptions:     { required:true },
		isDragPreview:  { type:Boolean, required:true },
		isDragSource:   { type:Boolean, required:true },
		isOptionsShow:  { type:Boolean, required:true },
		joins:          { type:Array,   required:true },
		joinsParent:    { type:Array,   required:true },
		modelValue:     { type:Object,  required:true },
		moduleId:       { type:String,  required:true },
		readonly:       { type:Boolean, required:true },
		sizeXMax:       { type:Number,  required:true }
	},
	emits:['close','update:modelValue'],
	data() {
		return {
			filtersDisable:[
				'collection','field','fieldChanged','fieldValid','formChanged',
				'formState','getter','globalSearch','javascript','recordMayCreate',
				'recordMayDelete','recordMayUpdate','recordNew','variable'
			],
			tabTargetArea:'body'
		};
	},
	computed:{
		classCss:s => {
			return { dragPreview:s.isDragPreview, dragSource:s.isDragSource, selected:s.isOptionsShow };
		},
		tabTargetAreaList:s => {
			return {
				entries:['body','header','footer'],
				labels:[s.capGen.content,s.capGen.header,s.capGen.footer]
			}
		},

		// inputs
		column:{ // this method updates obj directly
			get()  { return this.modelValue; },
			set(v) { this.$emit('update:modelValue',v); }
		},

		// simple
		icon:             s => s.getColumnIcon(s.column),
		isFncPg:          s => s.column.content === 'fnc_pg',
		isFncScalar:      s => s.column.content === 'fnc_scalar',
		isWithArgs:       s => s.isFncScalar || s.isFncPg,
		isWithQuery:      s => s.column.content === 'query',
		indexAttributeIds:s => s.isWithQuery ? s.getIndexAttributeIdsByJoins(s.query.joins,[],[]) : [],
		module:           s => s.moduleIdMap[s.moduleId],
		query:            s => s.isWithQuery && s.column.query !== null ? s.column.query : s.getTemplateQuery(),
		title:            s => s.getDocColumnTitle(s.column),
		titleBar:         s => `${s.capGen.column}: ${s.title}`,

		// stores
		capApp:     s => s.$store.getters.captions.builder.doc,
		capGen:     s => s.$store.getters.captions.generic,
		moduleIdMap:s => s.$store.getters['schema/moduleIdMap']
	},
	methods:{
		// externals
		getCaptionByIndexAttributeId,
		getDependentModules,
		getIndexAttributeIdsByJoins,
		getColumnIcon,
		getDocColumnTitle,
		getTemplateQuery,

		// actions
		addArgument() {
			let v = JSON.parse(JSON.stringify(this.column.arguments));
			v.push({
				attributeIndex:0,
				attributeId:null,
				value:null
			});
			this.column.arguments = v;
		},
		setIndexAttribute(indexAttributeId) {
			const p = indexAttributeId.split('_');
			if(p[1] === 'null') {
				this.column.attributeId    = null;
				this.column.attributeIndex = null;
			} else {
				this.column.attributeId    = p[1];
				this.column.attributeIndex = parseInt(p[0]);
			}
		}
	}
};
