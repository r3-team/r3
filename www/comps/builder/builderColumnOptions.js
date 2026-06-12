import MyBuilderAggregatorInput from './builderAggregatorInput.js';
import MyBuilderCaption         from './builderCaption.js';
import MyBuilderQuery           from './builderQuery.js';
import {getColumnIcon}          from '../shared/column.js';
import {getTemplateQuery}       from '../shared/builderTemplate.js';
import {
	getIndexAttributeIdsByJoins,
	isAttributeBoolean,
	isAttributeFiles,
	isAttributeInteger,
	isAttributeString,
	isAttributeUuid
} from '../shared/attribute.js';
import {
	getDependentModules,
	getItemTitleColumn
} from '../shared/builder.js';
import {
	getCaptionByIndexAttributeId
} from '../shared/query.js';


const MyBuilderColumnOptionsArguments = {
	name:'my-builder-column-options-arguments',
	template:`<div class="column gap">
		<div class="class row gap" v-for="(a,i) in modelValue">

			<my-label :caption="'#' + String(i)" />
			<select
				@change="setIndexAttribute(i,$event.target.value)"
				:disabled="readonly"
				:value="a.attributeIndex+'_'+a.attributeId"
			>
				<option value="0_null">[{{ capGen.valueFixedText }}]</option>
				<option v-for="ia in indexAttributeIds" :value="ia">
					{{ getCaptionByIndexAttributeId(ia) }}
				</option>
			</select>

			<input class="short"
				v-if="a.attributeId === null"
				@input="setValue(i,$event.target.value)"
				:disabled="readonly"
				:placeholder="capGen.value"
				:value="a.value"
			/>
			<my-button image="delete.png"
				@trigger="del(i)"
				:active="!readonly"
				:cancel="true"
			/>
		</div>
	</div>`,
	props:{
		joinsParents:{ type:Array,   required:true },
		modelValue:  { type:Array,   required:true },
		readonly:    { type:Boolean, required:true }
	},
	emits:['update:modelValue'],
	computed:{
		indexAttributeIds:s => s.joinsParents.length === 0 ? [] : s.getIndexAttributeIdsByJoins(s.joinsParents[0],[]),

		// stores
		capGen:s => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getCaptionByIndexAttributeId,
		getIndexAttributeIdsByJoins,

		// actions
		del(pos) {
			let v = JSON.parse(JSON.stringify(this.modelValue));
			v.splice(pos,1);
			this.$emit('update:modelValue',v);
		},
		setIndexAttribute(pos,ia) {
			let v = JSON.parse(JSON.stringify(this.modelValue));
			let p = ia.split('_');
			if(p[1] === 'null') {
				v[pos].attributeId    = null;
				v[pos].attributeIndex = 0;
			} else {
				v[pos].attributeId    = p[1];
				v[pos].attributeIndex = parseInt(p[0]);
			}
			this.$emit('update:modelValue',v);
		},
		setValue(pos,input) {
			let v = JSON.parse(JSON.stringify(this.modelValue));
			v[pos].value = input === '' ? null : input;
			this.$emit('update:modelValue',v);
		}
	}
};

export default {
	name:'my-builder-column-options',
	components:{
		MyBuilderAggregatorInput,
		MyBuilderCaption,
		MyBuilderColumnOptionsArguments,
		MyBuilderQuery
	},
	template:`<div class="top lower">
		<div class="area">
			<img class="icon" src="images/dash.png" />
			<img class="icon" :src="'images/' + getColumnIcon(column)" />
			<h2>{{ capGen.column + ': ' + getItemTitleColumn(column,false) }}</h2>
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
			<tr v-if="hasCaptions">
				<td>{{ capGen.title }}</td>
				<td>
					<my-builder-caption
						@update:modelValue="set('captions',{columnTitle:$event})"
						:language="builderLanguage"
						:modelValue="column.captions.columnTitle"
						:readonly
					/>
				</td>
			</tr>
			<template v-if="!onlyData">
				<tr>
					<td>{{ capGen.visibility }}</td>
					<td>
						<div class="row gap wrap" style="max-width:300px;">
							<my-button-check
								@update:modelValue="set('hidden',$event)"
								:caption="capGen.showDefault1"
								:modelValue="column.hidden"
								:readonly
								:reversed="true"
							/>
							<my-button-check
								@update:modelValue="set('onMobile',$event)"
								:caption="capGen.showDefaultMobile1"
								:modelValue="column.onMobile && !column.hidden"
								:readonly="column.hidden || readonly"
							/>
						</div>
					</td>
				</tr>
				<tr v-if="!isDrawing && !isColor">
					<td>{{ !isFiles ? capGen.lengthChars : capApp.columnLengthFiles }}</td>
					<td>
						<input
							v-if="column.length !== 0"
							@change="setInt('length',$event.target.value,false)"
							:disabled="readonly"
							:value="column.length"
						/>
						<my-button
							v-else
							@trigger="setInt('length',50,false)"
							:active="!readonly"
							:caption="capGen.noLimit"
							:naked="true"
						/>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.columnSize }}</td>
					<td>
						<input
							v-if="column.basis !== 0"
							@change="setInt('basis',$event.target.value,false)"
							:disabled="readonly"
							:value="column.basis"
						/>
						<my-button
							v-else
							@trigger="setInt('basis',25,false)"
							:active="!readonly"
							:caption="capGen.automatic"
							:naked="true"
						/>
					</td>
				</tr>
				<tr>
					<td>{{ capGen.alignment }}</td>
					<td>
						<select v-model="alignment" :disabled="readonly">
							<option value="def">{{ capGen.alignmentHor.left }}</option>
							<option value="mid">{{ capGen.alignmentHor.center }}</option>
							<option value="end">{{ capGen.alignmentHor.right }}</option>
						</select>
					</td>
				</tr>
				<tr>
					<td>{{ capGen.options }}</td>
					<td>
						<div class="row gap wrap" style="max-width:300px;">
							<my-button-check
								@update:modelValue="setStyle('bold',$event)"
								:caption="capApp.option.style.bold"
								:modelValue="column.styles.includes('bold')"
								:readonly
							/>
							<my-button-check
								@update:modelValue="setStyle('italic',$event)"
								:caption="capApp.option.style.italic"
								:modelValue="column.styles.includes('italic')"
								:readonly
							/>
							<my-button-check
								@update:modelValue="setStyle('monospace',$event)"
								:caption="capGen.monospace"
								:modelValue="column.styles.includes('monospace')"
								:readonly
							/>
							<my-button-check
								@update:modelValue="setStyle('clipboard',$event)"
								:caption="capApp.columnClipboard"
								:modelValue="column.styles.includes('clipboard')"
								:readonly
							/>
							<my-button-check
								@update:modelValue="setStyle('wrap',$event)"
								:caption="capApp.columnWrap"
								:modelValue="column.styles.includes('wrap')"
								:readonly
							/>
							<my-button-check
								v-if="isBarcode || isDrawing || (isFiles && column.display === 'gallery')"
								@update:modelValue="setStyle('previewLarge',$event)"
								:caption="capApp.columnPreviewLarge"
								:modelValue="column.styles.includes('previewLarge')"
								:readonly
							/>
							<my-button-check
								v-if="isBoolean"
								@update:modelValue="setStyle('boolAtrIcon',$event)"
								:caption="capApp.columnBoolAtrIcon"
								:modelValue="column.styles.includes('boolAtrIcon')"
								:readonly
							/>
							<my-button-check
								@update:modelValue="setStyle('noShrink',$event)"
								:caption="capApp.columnNoShrink"
								:modelValue="column.styles.includes('noShrink')"
								:readonly
							/>
							<my-button-check
								v-if="isInteger"
								@update:modelValue="setStyle('noThousandsSep',$event)"
								:caption="capApp.columnNoThousandsSep"
								:modelValue="column.styles.includes('noThousandsSep')"
								:readonly
							/>
						</div>
					</td>
				</tr>
				<tr v-if="!isDrawing && !isUuid && !isColor">
					<td>{{ capApp.display }}</td>
					<td>
						<select
							@input="set('display',$event.target.value)"
							:disabled="readonly"
							:value="column.display"
						>
							<option value="default">{{ capApp.option.display.default }}</option>
							<option v-if="isInteger"            value="rating"  >{{ capApp.option.display.rating }}</option>
							<option v-if="isString"             value="email"   >{{ capApp.option.display.email }}</option>
							<option v-if="isString"             value="password">{{ capApp.option.display.password }}</option>
							<option v-if="isString"             value="phone"   >{{ capApp.option.display.phone }}</option>
							<option v-if="isString"             value="url"     >{{ capApp.option.display.url }}</option>
							<option v-if="isFiles || isBarcode" value="gallery" >{{ capApp.option.display.gallery }}</option>
						</select>
					</td>
				</tr>
			</template>
			<tr>
				<td colspan="999"><b>{{ capGen.dataAccess }}</b></td>
			</tr>
			<template v-if="isSubQuery">
				<tr>
					<td colspan="2">
						<my-builder-query
							@update:modelValue="set('query',$event)"
							:allowChoices="false"
							:allowOrders="true"
							:builderLanguage
							:entityIdMapRef
							:fieldIdMap
							:filtersDisable
							:formId
							:joinsParents
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
							@change="setIndexAttribute($event.target.value)"
							:disabled="readonly"
							:value="column.index+'_'+column.attributeId"
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
						@input="set('pgFunctionId',$event.target.value === '' ? null : $event.target.value)"
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
					<select
						@change="set('scalar',$event.target.value)"
						:disabled="readonly"
						:value="column.scalar"
					>
						<option value="CONCAT">{{ capGen.scalarFunction.CONCAT }}</option>
						<option value="COALESCE">{{ capGen.scalarFunction.COALESCE }}</option>
					</select>
				</td>
			</tr>
			<tr v-if="isFncPg || isFncScalar">
				<td>
					<div class="column gap">
						<span v-if="isFncScalar">{{ capGen.values }}</span>
						<span v-if="isFncPg">{{ capGen.arguments }}</span>
						<my-button image="add.png"
							@trigger="addValue"
							:active="!readonly"
							:caption="capGen.button.add"
							:naked="true"
						/>
					</div>
				</td>
				<td>
					<my-builder-column-options-arguments
						@update:modelValue="set('arguments',$event)"
						:joinsParents
						:modelValue="column.arguments"
						:readonly
					/>
				</td>
			</tr>
			<tr>
				<td>{{ capGen.aggregator }}</td>
				<td>
					<my-builder-aggregator-input
						@update:modelValue="set('aggregator',$event)"
						:modelValue="column.aggregator"
						:readonly
					/>
				</td>
			</tr>
			<tr>
				<td>{{ capGen.options }}</td>
				<td>
					<div class="row gap wrap">
						<my-button-check
							@update:modelValue="set('distincted',$event)"
							:caption="capGen.distincted"
							:modelValue="column.distincted"
							:readonly
						/>
						<my-button-check
							@update:modelValue="set('groupBy',$event)"
							:caption="capGen.groupBy"
							:modelValue="column.groupBy"
							:readonly
						/>
					</div>
				</td>
			</tr>
		</tbody>
	</table>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		column:         { type:Object,  required:true },
		entityIdMapRef: { type:Object,  required:false, default:() => {return {}} },
		fieldIdMap:     { type:Object,  required:false, default:() => {return {}} },
		filtersDisable: { type:Array,   required:false, default:[] },
		formId:         { type:String,  required:false, default:'' },
		hasCaptions:    { type:Boolean, required:true },
		joinsParents:   { type:Array,   required:false, default:[] },
		moduleId:       { type:String,  required:true },
		onlyData:       { type:Boolean, required:true }, // no display/formatting options
		readonly:       { type:Boolean, required:true }
	},
	emits:['close','set'],
	computed:{
		attribute:s => typeof s.attributeIdMap[s.column.attributeId] === 'undefined'
			? false : s.attributeIdMap[s.column.attributeId],
		module:s => s.moduleIdMap[s.moduleId],
		query:s => s.isSubQuery && s.column.query !== null ? s.column.query : s.getTemplateQuery(),
		indexAttributeIds:s => !s.isSubQuery && s.column.query !== null
			? [] : s.getIndexAttributeIdsByJoins(s.column.query.joins,[]),
		
		// inputs
		alignment:{
			get()  {
				if(this.column.styles.includes('alignEnd')) return 'end';
				if(this.column.styles.includes('alignMid')) return 'mid';
				return 'def';
			},
			set(v) {
				let styles = JSON.parse(JSON.stringify(this.column.styles));

				if(v !== 'end' &&  styles.includes('alignEnd')) styles.splice(styles.indexOf('alignEnd'),1);
				if(v !== 'mid' &&  styles.includes('alignMid')) styles.splice(styles.indexOf('alignMid'),1);
				if(v === 'end' && !styles.includes('alignEnd')) styles.push('alignEnd');
				if(v === 'mid' && !styles.includes('alignMid')) styles.push('alignMid');

				this.set('styles',styles);
			}
		},
		
		// simple
		isBarcode:  s => s.isString  && s.attribute.contentUse === 'barcode',
		isBoolean:  s => s.isAttributeBoolean(s.attribute.content),
		isColor:    s => s.isString  && s.attribute.contentUse === 'color',
		isDrawing:  s => s.isString  && s.attribute.contentUse === 'drawing',
		isFiles:    s => s.isAttributeFiles(s.attribute.content),
		isFncPg:    s => s.column.content === 'fnc_pg',
		isFncScalar:s => s.column.content === 'fnc_scalar',
		isInteger:  s => s.isAttributeInteger(s.attribute.content),
		isString:   s => s.isAttributeString(s.attribute.content),
		isSubQuery: s => s.column.content === 'query',
		isUuid:     s => s.isAttributeUuid(s.attribute.content),
		isWithArgs: s => s.isFncScalar || s.isFncPg,
		
		// stores
		attributeIdMap:s => s.$store.getters['schema/attributeIdMap'],
		moduleIdMap:   s => s.$store.getters['schema/moduleIdMap'],
		capApp:        s => s.$store.getters.captions.builder.form,
		capGen:        s => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getCaptionByIndexAttributeId,
		getColumnIcon,
		getDependentModules,
		getIndexAttributeIdsByJoins,
		getItemTitleColumn,
		getTemplateQuery,
		isAttributeBoolean,
		isAttributeFiles,
		isAttributeInteger,
		isAttributeString,
		isAttributeUuid,
		
		// actions
		addValue() {
			let v = JSON.parse(JSON.stringify(this.column.arguments));
			v.push({
				attributeIndex:0,
				attributeId:null,
				value:null
			});
			this.$emit('set','arguments',v);
		},
		set(name,val) {
			if(val === '') val = null;
			this.$emit('set',name,val);
		},
		setInt(name,val,allowNull) {
			if(val !== '')
				return this.$emit('set',name,parseInt(val));
			
			if(allowNull) return this.$emit('set',name,null);
			else          return this.$emit('set',name,0);
		},
		setIndexAttribute(indexAttributeId) {
			let v = indexAttributeId.split('_');
			
			if(v[1] === 'null') {
				this.set('index',0);
				this.set('attributeId',null);
				return;
			}
			this.set('index',parseInt(v[0]));
			this.set('attributeId',v[1]);
		},
		setStyle(name,val) {
			let styles = JSON.parse(JSON.stringify(this.column.styles));
			const pos  = styles.indexOf(name);
			
			if(pos === -1 && val)  styles.push(name);
			if(pos !== -1 && !val) styles.splice(pos,1);
			
			this.set('styles',styles);
		}
	}
};