import MyInputDecimal from '../inputDecimal.js';
import {
	getIndexAttributeIdsByJoins, isAttributeBoolean, isAttributeFiles,
	isAttributeInteger, isAttributeString, isAttributeUuid
} from '../shared/attribute.js';
import { getDependentModules, getItemTitleColumn } from '../shared/builder.js';
import { getTemplateQuery } from '../shared/builderTemplate.js';
import { getColumnIcon } from '../shared/column.js';
import { getCaptionByIndexAttributeId } from '../shared/query.js';

import MyBuilderAggregatorInput from './builderAggregatorInput.js';
import MyBuilderCaption from './builderCaption.js';
import MyBuilderColumnArguments from './builderColumnArguments.js';
import MyBuilderOpenDoc from './builderOpenDoc.js';
import MyBuilderOpenForm from './builderOpenForm.js';
import MyBuilderQuery from './builderQuery.js';

export default {
	name: 'my-builder-column-options',
	components: {
		MyBuilderAggregatorInput, MyBuilderCaption, MyBuilderColumnArguments,
		MyBuilderOpenDoc, MyBuilderOpenForm, MyBuilderQuery, MyInputDecimal
	},
	template: `<div class="top lower">
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
						<div class="row gap centered nowrap" v-if="column.length !== 0">
							<my-input-decimal
								@update:modelValue="set('length',$event)"
								:max="32767"
								:min="0"
								:allowNull="false"
								:lengthFract="0"
								:modelValue="column.length"
								:readonly
							/>
							<my-button image="cancel.png"
								@trigger="set('length',0)"
								:active="!readonly"
								:naked="true"
							/>
						</div>
						<my-button
							v-if="column.length === 0"
							@trigger="set('length',50)"
							:active="!readonly"
							:caption="capGen.noLimit"
							:naked="true"
						/>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.columnSize }}</td>
					<td>
						<div class="row gap centered nowrap" v-if="column.basis !== 0">
							<my-input-decimal
								@update:modelValue="set('basis',$event)"
								:max="32767"
								:min="0"
								:allowNull="false"
								:lengthFract="0"
								:modelValue="column.basis"
								:readonly
							/>
							<my-button image="cancel.png"
								@trigger="set('basis',0)"
								:active="!readonly"
								:naked="true"
							/>
						</div>
						<my-button
							v-if="column.basis === 0"
							@trigger="set('basis',25)"
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
						<div class="input-custom item-box">
							<div class="row gap wrap">
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
								<my-button-check
									v-if="isInput"
									@update:modelValue="setStyle('relHide',$event)"
									:caption="capApp.columnHideInRelInput"
									:modelValue="column.styles.includes('relHide')"
									:readonly
								/>
							</div>
						</div>
					</td>
				</tr>
				<tr v-if="actionPossible">
					<td>{{ capGen.button.executeAction }}</td>
					<td>
						<my-bool
							@update:modelValue="set('display',$event ? 'action' : 'default')"
							:modelValue="column.display === 'action'"
							:readonly
						/>
					</td>
				</tr>
				<tr v-if="displayOptions.length !== 0 && !isAction">
					<td>{{ capApp.display }}</td>
					<td>
						<select
							@input="set('display',$event.target.value)"
							:disabled="readonly"
							:value="column.display"
						>
							<option value="default">{{ capApp.option.display.default }}</option>
							<option v-for="o in displayOptions" :value="o">
								{{ diplayOptionLabels[o] }}
							</option>
						</select>
					</td>
				</tr>
			</template>
			<tr v-if="isAction">
				<td>{{ capGen.openForm }}</td>
				<td>
					<my-builder-open-form
						@update:modelValue="set('openForm',$event)"
						:joinsIndexMapField
						:modelValue="column.openForm"
						:module
						:readonly
					/>
				</td>
			</tr>
			<tr v-if="isAction">
				<td>{{ capGen.button.pdfCreate }}</td>
				<td>
					<my-builder-open-doc
						@update:modelValue="set('openDoc',$event)"
						:dataFields="[]"
						:joinsIndexMap="joinsIndexMapField"
						:modelValue="column.openDoc"
						:module
						:readonly
					/>
				</td>
			</tr>
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
					<div class="input-custom item-box">
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
					</div>
				</td>
			</tr>
		</tbody>
	</table>`,
	props: {
		allowActions: { type: Boolean, required: false, default: false },
		builderLanguage: { type: String, required: true },
		column: { type: Object, required: true },
		entityIdMapRef: { type: Object, required: false, default: () => { return {} } },
		fieldIdMap: { type: Object, required: false, default: () => { return {} } },
		filtersDisable: { type: Array, required: false, default: [] },
		formId: { type: String, required: false, default: '' },
		hasCaptions: { type: Boolean, required: true },
		isInput: { type: Boolean, required: false, default: false },
		joinsIndexMapField: { type: Object, required: false, default: () => { return {} } },
		joinsParents: { type: Array, required: false, default: [] },
		moduleId: { type: String, required: true },
		onlyData: { type: Boolean, required: true }, // no display/formatting options
		readonly: { type: Boolean, required: true }
	},
	emits: ['close', 'set'],
	computed: {
		actionPossible: s => s.allowActions && !s.isBoolean && !s.isDrawing && !s.isFiles,
		attribute: s => s.attributeIdMap[s.column.attributeId] ?? false,
		module: s => s.moduleIdMap[s.moduleId],
		query: s => s.isSubQuery && s.column.query !== null ? s.column.query : s.getTemplateQuery(),
		indexAttributeIds: s => !s.isSubQuery && s.column.query !== null
			? [] : s.getIndexAttributeIdsByJoins(s.query.joins, [], []),

		// inputs
		alignment: {
			get() {
				if (this.column.styles.includes('alignEnd')) return 'end';
				if (this.column.styles.includes('alignMid')) return 'mid';
				return 'def';
			},
			set(v) {
				const styles = JSON.parse(JSON.stringify(this.column.styles));

				if (v !== 'end' && styles.includes('alignEnd')) styles.splice(styles.indexOf('alignEnd'), 1);
				if (v !== 'mid' && styles.includes('alignMid')) styles.splice(styles.indexOf('alignMid'), 1);
				if (v === 'end' && !styles.includes('alignEnd')) styles.push('alignEnd');
				if (v === 'mid' && !styles.includes('alignMid')) styles.push('alignMid');

				this.set('styles', styles);
			}
		},
		displayOptions: s => {
			const out = [];
			const isDateOrTime = s.isDate || s.isDatetime || s.isTime;
			if (s.isInteger && !isDateOrTime)
				out.push('rating');

			if (s.isString && !s.isDrawing && !s.isColor && !s.isRichtext && !s.isTextarea && !s.isBarcode)
				out.push('email', 'password', 'phone', 'url');

			if (s.isFiles || s.isBarcode)
				out.push('gallery');

			return out;
		},
		diplayOptionLabels: s => {
			return {
				email: s.capApp.option.display.email,
				gallery: s.capApp.option.display.gallery,
				password: s.capApp.option.display.password,
				phone: s.capApp.option.display.phone,
				rating: s.capApp.option.display.rating,
				url: s.capApp.option.display.url
			};
		},

		// simple
		isAction: s => s.column.display === 'action',
		isBarcode: s => s.isStringAttribute && s.attribute.contentUse.includes('barcode'),
		isBoolean: s => s.attribute !== false && s.isAttributeBoolean(s.attribute.content),
		isColor: s => s.isStringAttribute && s.attribute.contentUse === 'color',
		isDate: s => s.isInteger && s.attribute.contentUse === 'date',
		isDatetime: s => s.isInteger && s.attribute.contentUse === 'datetime',
		isDrawing: s => s.isStringAttribute && s.attribute.contentUse === 'drawing',
		isFiles: s => s.attribute !== false && s.isAttributeFiles(s.attribute.content),
		isFncPg: s => s.column.content === 'fnc_pg',
		isFncScalar: s => s.column.content === 'fnc_scalar',
		isInteger: s => s.attribute !== false && s.isAttributeInteger(s.attribute.content),
		isRichtext: s => s.isStringAttribute && s.attribute.contentUse === 'richtext',
		isString: s => s.isStringAttribute || s.isFncScalar || s.isFncPg,
		isStringAttribute: s => s.attribute !== false && s.isAttributeString(s.attribute.content),
		isSubQuery: s => s.column.content === 'query',
		isTextarea: s => s.isStringAttribute && s.attribute.contentUse === 'textarea',
		isTime: s => s.isInteger && s.attribute.contentUse === 'time',
		isUuid: s => s.attribute !== false && s.isAttributeUuid(s.attribute.content),
		isWithArgs: s => s.isFncScalar || s.isFncPg,

		// stores
		attributeIdMap: s => s.$store.getters['schema/attributeIdMap'],
		moduleIdMap: s => s.$store.getters['schema/moduleIdMap'],
		capApp: s => s.$store.getters.captions.builder.form,
		capGen: s => s.$store.getters.captions.generic
	},
	methods: {
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
		addArgument() {
			const v = JSON.parse(JSON.stringify(this.column.arguments));
			v.push({
				attributeIndex: 0,
				attributeId: null,
				value: null
			});
			this.$emit('set', 'arguments', v);
		},
		set(name, val) {
			if (val === '') val = null;
			this.$emit('set', name, val);
		},
		setIndexAttribute(indexAttributeId) {
			const v = indexAttributeId.split('_');
			if (v[1] === 'null') {
				this.set('index', 0);
				this.set('attributeId', null);
				return;
			}
			this.set('index', parseInt(v[0], 10));
			this.set('attributeId', v[1]);
		},
		setStyle(name, val) {
			const styles = JSON.parse(JSON.stringify(this.column.styles));
			const pos = styles.indexOf(name);

			if (pos === -1 && val) styles.push(name);
			if (pos !== -1 && !val) styles.splice(pos, 1);

			this.set('styles', styles);
		}
	}
};
