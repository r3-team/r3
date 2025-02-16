import MyBuilderCaption from './builderCaption.js';
import MyBuilderQuery   from './builderQuery.js';
import {
	getIndexAttributeIdsByJoins,
	isAttributeBoolean,
	isAttributeFiles,
	isAttributeInteger,
	isAttributeString,
	isAttributeUuid
} from '../shared/attribute.js';
import {
	getCaptionByIndexAttributeId
} from '../shared/query.js';
export {MyBuilderColumnOptions as default};

let MyBuilderColumnOptions = {
	name:'my-builder-column-options',
	components:{
		MyBuilderCaption,
		MyBuilderQuery
	},
	template:`<table class="generic-table-vertical default-inputs">
		<tbody>
			<tr v-if="hasCaptions">
				<td>{{ capGen.title }}</td>
				<td>
					<my-builder-caption
						@update:modelValue="set('captions',{columnTitle:$event})"
						:language="builderLanguage"
						:modelValue="column.captions.columnTitle"
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
								:caption="capApp.columnShowDefault"
								:modelValue="column.hidden"
								:reversed="true"
							/>
							<my-button-check
								@update:modelValue="set('onMobile',$event)"
								:caption="capApp.columnShowDefaultMobile"
								:modelValue="column.onMobile && !column.hidden"
								:readonly="column.hidden"
							/>
						</div>
					</td>
				</tr>
				<tr v-if="!isDrawing && !isColor">
					<td>{{ !isFiles ? capApp.columnLength : capApp.columnLengthFiles }}</td>
					<td>
						<input
							v-if="column.length !== 0"
							@change="setInt('length',$event.target.value,false)"
							:value="column.length"
						/>
						<my-button
							v-else
							@trigger="setInt('length',50,false)"
							:caption="capApp.columnLength0"
							:naked="true"
						/>
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
							/>
							<my-button-check
								@update:modelValue="setStyle('italic',$event)"
								:caption="capApp.option.style.italic"
								:modelValue="column.styles.includes('italic')"
							/>
							<my-button-check
								@update:modelValue="setStyle('monospace',$event)"
								:caption="capGen.monospace"
								:modelValue="column.styles.includes('monospace')"
							/>
							<my-button-check
								@update:modelValue="setStyle('clipboard',$event)"
								:caption="capApp.columnClipboard"
								:modelValue="column.styles.includes('clipboard')"
							/>
							<my-button-check
								@update:modelValue="setStyle('wrap',$event)"
								:caption="capApp.columnWrap"
								:modelValue="column.styles.includes('wrap')"
							/>
							<my-button-check
								v-if="isBarcode || isDrawing || (isFiles && column.display === 'gallery')"
								@update:modelValue="setStyle('previewLarge',$event)"
								:caption="capApp.columnPreviewLarge"
								:modelValue="column.styles.includes('previewLarge')"
							/>
							<my-button-check
								v-if="isBoolean"
								@update:modelValue="setStyle('boolAtrIcon',$event)"
								:caption="capApp.columnBoolAtrIcon"
								:modelValue="column.styles.includes('boolAtrIcon')"
							/>
						</div>
					</td>
				</tr>
				<tr>
					<td>{{ capGen.alignment }}</td>
					<td>
						<select v-model="alignment">
							<option value="def">{{ capGen.alignmentHor.left }}</option>
							<option value="mid">{{ capGen.alignmentHor.center }}</option>
							<option value="end">{{ capGen.alignmentHor.right }}</option>
						</select>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.columnSize }}</td>
					<td>
						<input
							v-if="column.basis !== 0"
							@change="setInt('basis',$event.target.value,false)"
							:value="column.basis"
						/>
						<my-button
							v-else
							@trigger="setInt('basis',25,false)"
							:caption="capApp.columnSize0"
							:naked="true"
						/>
					</td>
				</tr>
				<tr v-if="!isDrawing && !isUuid && !isColor">
					<td>{{ capApp.display }}</td>
					<td>
						<select
							@input="set('display',$event.target.value)"
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
				<td colspan="999"><b>{{ capApp.columnHeaderData }}</b></td>
			</tr>
			<tr>
				<td>{{ capApp.aggregator }}</td>
				<td>
					<select
						@input="set('aggregator',$event.target.value)"
						:value="column.aggregator"
					>
						<option value="">-</option>
						<option value="record">{{ capGen.option.aggRecord }}</option>
						<option value="avg">{{ capGen.option.aggAvg }}</option>
						<option value="count">{{ capGen.option.aggCount }}</option>
						<option value="list">{{ capGen.option.aggList }}</option>
						<option value="max">{{ capGen.option.aggMax }}</option>
						<option value="min">{{ capGen.option.aggMin }}</option>
						<option value="sum">{{ capGen.option.aggSum }}</option>
						<option value="array">{{ capGen.option.aggArray }}</option>
					</select>
				</td>
			</tr>
			<tr>
				<td>{{ capGen.options }}</td>
				<td>
					<div class="row gap wrap">
						<my-button-check
							@update:modelValue="set('distincted',$event)"
							:caption="capApp.distincted"
							:modelValue="column.distincted"
						/>
						<my-button-check
							@update:modelValue="set('groupBy',$event)"
							:caption="capApp.groupBy"
							:modelValue="column.groupBy"
						/>
					</div>
				</td>
			</tr>
			<tr v-if="isSubQuery">
				<td>{{ capApp.subQueryAttribute }}</td>
				<td>
					<select
						@change="setIndexAttribute($event.target.value)"
						:value="column.index+'_'+column.attributeId"
					>
						<option value="0_null">-</option>
						<option v-for="ia in indexAttributeIds" :value="ia">
							{{ getCaptionByIndexAttributeId(ia) }}
						</option>
					</select>
				</td>
			</tr>
		</tbody>
	</table>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		column:         { type:Object,  required:true },
		hasCaptions:    { type:Boolean, required:true },
		moduleId:       { type:String,  required:true },
		onlyData:       { type:Boolean, required:true }  // no display/formatting options
	},
	emits:['set'],
	computed:{
		attribute:(s) => typeof s.attributeIdMap[s.column.attributeId] === 'undefined'
			? false : s.attributeIdMap[s.column.attributeId],
		indexAttributeIds:(s) => !s.isSubQuery
			? [] : s.getIndexAttributeIdsByJoins(s.column.query.joins),
		
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
		isBarcode: (s) => s.isString  && s.attribute.contentUse === 'barcode',
		isBoolean: (s) => s.isAttributeBoolean(s.attribute.content),
		isColor:   (s) => s.isString  && s.attribute.contentUse === 'color',
		isDrawing: (s) => s.isString  && s.attribute.contentUse === 'drawing',
		isFiles:   (s) => s.isAttributeFiles(s.attribute.content),
		isInteger: (s) => s.isAttributeInteger(s.attribute.content),
		isString:  (s) => s.isAttributeString(s.attribute.content),
		isSubQuery:(s) => s.column.subQuery,
		isUuid:    (s) => s.isAttributeUuid(s.attribute.content),
		
		// stores
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		capApp:        (s) => s.$store.getters.captions.builder.form,
		capGen:        (s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getCaptionByIndexAttributeId,
		getIndexAttributeIdsByJoins,
		isAttributeBoolean,
		isAttributeFiles,
		isAttributeInteger,
		isAttributeString,
		isAttributeUuid,
		
		// actions
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