import MyInputColorWrap               from '../inputColorWrap.js';
import MyInputDateFormat              from '../inputDateFormat.js';
import MyInputDecimal                 from '../inputDecimal.js';
import MyInputNumberSep               from '../inputNumberSep.js';
import {getIndexAttributeIdsByJoins}  from '../shared/attribute.js';
import {getTemplateDocSet}            from '../shared/builderTemplate.js';
import {deepIsEqual}                  from '../shared/generic.js';
import {getCaptionByIndexAttributeId} from '../shared/query.js';
import {
	MyBuilderDocFontAlign,
	MyBuilderDocFontFamily,
	MyBuilderDocFontLineFactor,
	MyBuilderDocFontStyles
} from './builderDocInput.js';

const targetTypes = {
	color:['font.color'],
	dateFormat:['font.dateFormat'],
	decimal:['font.size'],
	fontAlign:['font.align'],
	fontFamily:['font.family'],
	fontLineFactor:['font.lineFactor'],
	fontStyle:['font.style'],
	numberSep:['font.numberSepDec','font.numberSepTho']
};
const targetsDoc  = ['title','language','author'];
const targetsFont = [
	'font.family','font.size','font.lineFactor','font.align','font.style',
	'font.color','font.numberSepTho','font.numberSepDec','font.dateFormat'
];

const MyBuilderDocSetTarget = {
	name:'my-builder-doc-set-target',
	components:{
		MyBuilderDocFontAlign,
		MyBuilderDocFontFamily,
		MyBuilderDocFontLineFactor,
		MyBuilderDocFontStyles,
		MyInputColorWrap,
		MyInputDateFormat,
		MyInputDecimal,
		MyInputNumberSep
	},
	template:`<tr>
		<td>
			<my-button-check
				@update:modelValue="toggle"
				:caption="targetCapMap[target]"
				:modelValue="active"
				:readonly
			/>
		</td>
		<td>
			<div class="column gap" v-if="active">

				<!-- value inputs -->
				<template v-if="allowValue">
					<my-button image="edit.png"
						v-if="value === null"
						@trigger="value = valueDef"
						:caption="capApp.setValue"
						:naked="true"
					/>
					<template v-if="value !== null">
						<my-builder-doc-font-align       v-if="isFontAlign"      v-model="value" :readonly />
						<my-builder-doc-font-family      v-if="isFontFamily"     v-model="value" :readonly />
						<my-builder-doc-font-line-factor v-if="isFontLineFactor" v-model="value" :readonly />
						<my-builder-doc-font-styles      v-if="isFontStyle"      v-model="value" :readonly />
						<my-input-color-wrap             v-if="isColor"          v-model="value" :readonly :allowNull="false" />
						<my-input-date-format            v-if="isDateFormat"     v-model="value" :readonly />
						<my-input-decimal                v-if="isDecimal"        v-model="value" :readonly :allowNull="false" :length="4" :lengthFract="2" />
						<my-input-number-sep             v-if="isNumberSep"      v-model="value" :readonly :allowNone="target === 'font.numberSepTho'" />
					</template>
				</template>

				<!-- attribute index inputs -->
				<select v-if="allowData" @input="updateIndexAttribute($event.target.value)" :disabled="readonly" :value="set.attributeIndex+'_'+set.attributeId">
					<option value="null_null">[{{ capApp.setData }}]</option>
					<option v-for="ia in indexAttributeIds" :value="ia">
						{{ getCaptionByIndexAttributeId(ia) }}
					</option>
				</select>
			</div>
		</td>
	</tr>`,
	props:{
		allowData: { type:Boolean, required:true },
		allowValue:{ type:Boolean, required:true },
		joins:     { type:Array,   required:true },
		readonly:  { type:Boolean, required:true },
		sets:      { type:Array,   required:true }, // all sets that are enabled, current set might or not might not be in it
		target:    { type:String,  required:true }  // target to set (font.align, font.numberSepTho, etc.)
	},
	emits:['apply','remove'],
	data() {
		return {
			targetCapMap:{}
		};
	},
	computed:{
		valueDef:s => {
			if(s.isColor)          return '000000';
			if(s.isDateFormat)     return 'Y-m-d';
			if(s.isDecimal)        return 0.0;
			if(s.isNumberSep)      return '.';
			if(s.isFontAlign)      return 'L';
			if(s.isFontFamily)     return 'Roboto';
			if(s.isFontLineFactor) return 1.0;
			return '';
		},
		
		// inputs
		value:{
			get()  { return this.set.value; },
			set(v) { this.updateMultiple(['value'],[v]); }
		},

		// simple
		active:             s => s.setIndex !== -1,
		atrContentWhitelist:s => s.isDecimal || s.isFontLineFactor ? ['numeric','real','double precision'] : ['varchar','text'],
		indexAttributeIds:  s => s.getIndexAttributeIdsByJoins(s.joins,s.atrContentWhitelist),
		isColor:            s => targetTypes.color.includes(s.target),
		isDateFormat:       s => targetTypes.dateFormat.includes(s.target),
		isDecimal:          s => targetTypes.decimal.includes(s.target),
		isFontAlign:        s => targetTypes.fontAlign.includes(s.target),
		isFontFamily:       s => targetTypes.fontFamily.includes(s.target),
		isFontLineFactor:   s => targetTypes.fontLineFactor.includes(s.target),
		isFontStyle:        s => targetTypes.fontStyle.includes(s.target),
		isNumberSep:        s => targetTypes.numberSep.includes(s.target),
		set:                s => s.setIndex !== -1 ? JSON.parse(JSON.stringify(s.sets[s.setIndex])) : s.getTemplateDocSet(s.target),
		setIndex:           s => s.sets.findIndex(v => v.target === s.target),

		// stores
		capApp:s => s.$store.getters.captions.builder.doc,
		capGen:s => s.$store.getters.captions.generic
	},
	created() {
		this.targetCapMap =	{
			// doc
			'author':  this.capGen.author,
			'language':this.capGen.language,
			'title':   this.capGen.title,

			// font
			'font.align':       this.capApp.font.alignHor,
			'font.color':       this.capApp.font.color,
			'font.dateFormat':  this.capApp.font.dateFormat,
			'font.family':      this.capApp.font.family,
			'font.lineFactor':  this.capApp.font.lineFactor,
			'font.numberSepDec':this.capApp.font.numberSepDec,
			'font.numberSepTho':this.capApp.font.numberSepTho,
			'font.size':        this.capGen.size,
			'font.style':       this.capApp.font.style
		};
	},
	methods:{
		// externals
		deepIsEqual,
		getCaptionByIndexAttributeId,
		getIndexAttributeIdsByJoins,
		getTemplateDocSet,

		// actions
		toggle() {
			if(!this.active)
				return this.$emit('apply',this.set);
			
			this.$emit('remove');
			this.setType = false;
		},
		updateIndexAttribute(indexAttributeId) {
			const v = indexAttributeId.split('_');
			this.updateMultiple(['attributeIndex','attributeId'], v[1] === 'null' ? [null,null] : [parseInt(v[0]),v[1]]);
		},
		updateMultiple(keys,values) {
			let m = JSON.parse(JSON.stringify(this.set));
			for(let i = 0, j = keys.length; i < j; i++) {
				m[keys[i]] = values[i];
			}
			if(!this.deepIsEqual(m,this.set))
				this.$emit('apply',m);
		}
	}
};

export default {
	name:'my-builder-doc-sets',
	components:{MyBuilderDocSetTarget},
	template:`<table class="generic-table-vertical default-inputs">
		<tbody>
			<template v-if="targetsDoc">
				<tr><td><b>{{ capGen.overwrites + ' (' + capGen.pdf + ')' }}</b></td></tr>
				<my-builder-doc-set-target
					v-for="t in targetsListDoc"
					@apply="apply(t,$event)"
					@remove="remove(t)"
					:allowData
					:allowValue
					:joins
					:readonly
					:sets="modelValue"
					:target="t"
				/>
			</template>
			<template v-if="targetsFont">
				<tr><td><b>{{ capGen.overwrites + ' (' + capGen.font + ')' }}</b></td></tr>
				<my-builder-doc-set-target
					v-for="t in targetsListFont"
					@apply="apply(t,$event)"
					@remove="remove(t)"
					:allowData
					:allowValue
					:joins
					:readonly
					:sets="modelValue"
					:target="t"
				/>
			</template>
		</tbody>
	</table>`,
	props:{
		allowData:  { type:Boolean, required:false, default:false },
		allowValue: { type:Boolean, required:false, default:false },
		joins:      { type:Array,   required:true },
		modelValue: { type:Array,   required:true },
		readonly:   { type:Boolean, required:true },
		targetsDoc: { type:Boolean, required:false, default:false },
		targetsFont:{ type:Boolean, required:false, default:false }
	},
	emits:['update:modelValue'],
	computed:{
		targetsListDoc: s => targetsDoc,
		targetsListFont:s => targetsFont,

		// stores
		capGen:s => s.$store.getters.captions.generic
	},
	methods:{
		apply(target,value) {
			let v = JSON.parse(JSON.stringify(this.modelValue));
			const pos = v.findIndex(v => v.target === target);

			if(pos !== -1) v[pos] = value;
			else           v.push(value);
			
			this.$emit('update:modelValue',v);
		},
		remove(target) {
			let v = JSON.parse(JSON.stringify(this.modelValue));
			const pos = v.findIndex(v => v.target === target);
			if(pos !== -1) {
				v.splice(pos,1);
				this.$emit('update:modelValue',v);
			}
		}
	}
};