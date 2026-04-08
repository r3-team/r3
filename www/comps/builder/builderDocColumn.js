import MyBuilderAggregatorInput       from './builderAggregatorInput.js';
import MyBuilderCaption               from './builderCaption.js';
import MyBuilderDocSets               from './builderDocSets.js';
import MyBuilderQuery                 from './builderQuery.js';
import MyInputDecimal                 from '../inputDecimal.js';
import MyInputRange                   from '../inputRange.js';
import {getIndexAttributeIdsByJoins}  from '../shared/attribute.js';
import {getTemplateQuery}             from '../shared/builderTemplate.js';
import {getCaptionByIndexAttributeId} from '../shared/query.js';
import {
	getDocColumnIcon,
	getDocColumnTitle
} from '../shared/builderDoc.js';

export default {
	name:'my-builder-doc-column',
	components:{
		MyBuilderAggregatorInput,
		MyBuilderCaption,
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

			<my-tabs
				v-if="isWithQuery"
				v-model="tabTarget"
				:entries="['properties','content']"
				:entriesIcon="['images/edit.png','images/database.png']"
				:entriesText="[capGen.properties,capGen.content]"
			/>
			
			<template v-if="tabTarget === 'content'">
				<div class="content grow">
					<my-builder-query
						v-if="column.subQuery"
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
				</div>
				<br />
				<table class="generic-table-vertical default-inputs">
					<tbody>
						<tr><td colspan="2"><b>{{ capGen.dataRetrieval }}</b></td></tr>
						<tr>
							<td>{{ capGen.attribute }}</td>
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
					</tbody>
				</table>
			</template>

			<template v-if="tabTarget === 'properties' || !isWithQuery">
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
						<tr><td colspan="2"><b>{{ capGen.dataRetrieval }}</b></td></tr>
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
			</template>
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
			tabTarget:'properties',
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
		icon:             s => s.getDocColumnIcon(s.column),
		isWithQuery:      s => s.column.subQuery,
		indexAttributeIds:s => !s.column.subQuery ? [] : s.getIndexAttributeIdsByJoins(s.query.joins,[]),
		query:            s => s.isWithQuery && s.column.query !== null ? s.column.query : s.getTemplateQuery(),
		title:            s => s.getDocColumnTitle(s.column),
		titleBar:         s => `${s.capGen.column}: ${s.title}`,

		// stores
		capApp:s => s.$store.getters.captions.builder.doc,
		capGen:s => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getCaptionByIndexAttributeId,
		getIndexAttributeIdsByJoins,
		getDocColumnIcon,
		getDocColumnTitle,
		getTemplateQuery,

		// actions
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