
import MyInputColorWrap  from '../inputColorWrap.js';
import MyInputDateFormat from '../inputDateFormat.js';
import MyInputDecimal    from '../inputDecimal.js';
import MyInputNumberSep  from '../inputNumberSep.js';
import {
	MyBuilderDocFontAlign,
	MyBuilderDocFontFamily,
	MyBuilderDocFontLineFactor,
	MyBuilderDocFontStyles
} from './builderDocInput.js';

export default {
	name:'my-builder-doc-font',
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
		<td>{{ capApp.family }}</td>
		<td><my-builder-doc-font-family @update:modelValue="$emit('update:family',$event)" :modelValue="family" :readonly /></td>
	</tr>
	<tr>
		<td>{{ capGen.size }}</td>
		<td>
			<div class="row gap centered">
				<my-input-decimal class="short"
					@update:modelValue="$emit('update:size',$event)"
					:length="4"
					:lengthFract="2"
					:modelValue="size"
					:readonly="readonly"
				/>
				<span>mm</span>
			</div>
		</td>
	</tr>
	<tr>
		<td>{{ capApp.lineFactor }}</td>
		<td><my-builder-doc-font-line-factor @update:modelValue="$emit('update:lineFactor',$event)" :modelValue="lineFactor" :readonly /></td>
	</tr>
	<tr>
		<td>{{ capApp.align }}</td>
		<td><my-builder-doc-font-align @update:modelValue="$emit('update:align',$event)" :modelValue="align" :readonly /></td>
	</tr>
	<tr>
		<td>{{ capApp.style }}</td>
		<td><my-builder-doc-font-styles @update:modelValue="$emit('update:style',$event)" :modelValue="style" :readonly /></td>
	</tr>
	<tr>
		<td>{{ capApp.color }}</td>
		<td><my-input-color-wrap @update:modelValue="$emit('update:color',$event)" :allowNull="true" :modelValue="color" :readonly /></td>
	</tr>
	<tr>
		<td>{{ capGen.numberSepThousand }}</td>
		<td><my-input-number-sep @update:modelValue="$emit('update:numberSepTho',$event)" :allowNone="true"  :modelValue="numberSepTho" :readonly /></td>
	</tr>
	<tr>
		<td>{{ capGen.numberSepDecimal }}</td>
		<td><my-input-number-sep @update:modelValue="$emit('update:numberSepDec',$event)" :allowNone="false" :modelValue="numberSepDec" :readonly /></td>
	</tr>
	<tr>
		<td>{{ capApp.dateFormat }}</td>
		<td><my-input-date-format @update:modelValue="$emit('update:dateFormat',$event)" :modelValue="dateFormat" :readonly /></td>
	</tr>
	<tr>
		<td>{{ capApp.bool }}</td>
		<td>
			<div class="row gap centered">
				<span>{{ capGen.boolTrue }}</span>
				<input class="short" :disabled="readonly" :value="boolTrue"  @input="$emit('update:boolTrue',  $event.target.value)" />
				<span>{{ capGen.boolFalse }}</span>
				<input class="short" :disabled="readonly" :value="boolFalse" @input="$emit('update:boolFalse', $event.target.value)" />
			</div>
		</td>
	</tr>`,
	props:{
		align:       { type:String,  required:true },
		boolFalse:   { type:String,  required:true },
		boolTrue:    { type:String,  required:true },
		color:       { type:[String,null], required:true },
		dateFormat:  { type:String,  required:true },
		family:      { type:String,  required:true },
		lineFactor:  { type:Number,  required:true },
		numberSepDec:{ type:String,  required:true },
		numberSepTho:{ type:String,  required:true },
		readonly:    { type:Boolean, required:true },
		size:        { type:Number,  required:true },
		style:       { type:String,  required:true }
	},
	emits:[
		'update:align','update:boolFalse','update:boolTrue','update:color','update:dateFormat','update:family',
		'update:lineFactor','update:numberSepDec','update:numberSepTho','update:size','update:style'
	],
	computed:{
		capApp:s => s.$store.getters.captions.builder.doc.font,
		capGen:s => s.$store.getters.captions.generic
	}
};