import MyInputDecimal from '../inputDecimal.js';
export {
	MyBuilderDocFontAlign,
	MyBuilderDocFontFamily,
	MyBuilderDocFontLineFactor,
	MyBuilderDocFontStyles,
	MyBuilderDocMarginPadding
};

const MyBuilderDocMarginPadding = {
	name:'my-builder-doc-margin-padding',
	components:{MyInputDecimal},
	template:`<tr>
		<td>{{ capGen.spacing }}</td>
		<td>
			<div class="column gap centered">
				<div class="row">
					<my-input-decimal class="short" @update:modelValue="$emit('update:t',$event)" :modelValue="t" :readonly :allowNull="false" :length="5" :lengthFract="2" />
				</div>
				<div class="row gap centered">
					<my-input-decimal class="short" @update:modelValue="$emit('update:l',$event)" :modelValue="l" :readonly :allowNull="false" :length="5" :lengthFract="2" />
					<div class="builder-doc-margin-padding-box"></div>
					<my-input-decimal class="short" @update:modelValue="$emit('update:r',$event)" :modelValue="r" :readonly :allowNull="false" :length="5" :lengthFract="2" />
				</div>
				<div class="row">
					<my-input-decimal class="short" @update:modelValue="$emit('update:b',$event)" :modelValue="b" :readonly :allowNull="false" :length="5" :lengthFract="2" />
				</div>
			</div>
		</td>
	</tr>`,
	props:{
		t:       { type:Number,  required:true },
		r:       { type:Number,  required:true },
		b:       { type:Number,  required:true },
		l:       { type:Number,  required:true },
		readonly:{ type:Boolean, required:true }
	},
	emits:['update:t','update:r','update:b','update:l'],
	computed:{
		capGen:s => s.$store.getters.captions.generic
	}
};

const MyBuilderDocFontAlign = {
	name:'my-builder-doc-font-align',
	template:`<select :disabled="readonly" :value="modelValue" @input="$emit('update:modelValue',$event.target.value)">
		<option value="L">{{ capGen.alignmentHor.left }}</option>
		<option value="J">{{ capGen.alignmentHor.justify }}</option>
		<option value="R">{{ capGen.alignmentHor.right }}</option>
	</select>`,
	props:{
		modelValue:{ type:String,  required:true },
		readonly:  { type:Boolean, required:true }
	},
	emits:['update:modelValue'],
	computed:{
		capGen:s => s.$store.getters.captions.generic
	}
};

const MyBuilderDocFontFamily = {
	name:'my-builder-doc-font-family',
	template:`<select :disabled="readonly" :value="modelValue" @input="$emit('update:modelValue',$event.target.value)">
		<optgroup :label="capApp.familySansSerif">
			<option value="Arimo">Arimo</option>
			<option value="ComicNeue">ComicNeue</option>
			<option value="NotoSans">NotoSans</option>
			<option value="OpenSans">OpenSans</option>
			<option value="Roboto">Roboto</option>
		</optgroup>
		<optgroup :label="capApp.familySerif">
			<option value="Tinos">Tinos</option>
		</optgroup>
		<optgroup :label="capApp.familyMonospace">
			<option value="CourierPrime">CourierPrime</option>
			<option value="Cousine">Cousine</option>
		</optgroup>
		<optgroup :label="capApp.familyInternational">
			<option value="NotoSansArabic">NotoSans Arabic</option>
			<option value="NotoSansJP">NotoSans Japanese</option>
			<option value="NotoSansKR">NotoSans Korean</option>
			<option value="NotoSansSC">NotoSans Simplified Chinese</option>
			<option value="NotoSansThai">NotoSans Thai</option>
		</optgroup>
	</select>`,
	props:{
		modelValue:{ type:String,  required:true },
		readonly:  { type:Boolean, required:true }
	},
	emits:['update:modelValue'],
	computed:{
		capApp:s => s.$store.getters.captions.builder.doc.font
	}
};

const MyBuilderDocFontLineFactor = {
	name:'my-builder-doc-font-line-factor',
	template:`<div class="row gap centered">
		<input type="range"
			@input="$emit('update:modelValue',Number($event.target.value))"
			:disabled="readonly"
			:min="0.05"
			:max="3.0"
			:step="0.05"
			:value="modelValue"
		/>
		<input class="short" disabled :value="String(parseInt(modelValue * 100)) + '%'" />
	</div>`,
	props:{
		modelValue:{ type:Number,  required:true },
		readonly:  { type:Boolean, required:true }
	},
	emits:['update:modelValue']
};

const MyBuilderDocFontStyles = {
	name:'my-builder-doc-font-styles',
	template:`<div class="row gap centered">
		<my-button-check @update:modelValue="set('B',$event)" :caption="capApp.styleBold"   :modelValue="valueString.includes('B')" :readonly="readonly" />
		<my-button-check @update:modelValue="set('I',$event)" :caption="capApp.styleItalic" :modelValue="valueString.includes('I')" :readonly="readonly" />
	</div>`,
	props:{
		modelValue:{ type:[String,null], required:true },
		readonly:  { type:Boolean,       required:true }
	},
	emits:['update:modelValue'],
	computed:{
		valueString:s => s.modelValue === null ? '' : s.modelValue,

		// stores
		capApp:s => s.$store.getters.captions.builder.doc.font
	},
	methods:{
		set(style,add) {
			let s = this.valueString;

			if(add && !s.includes(style)) s += style;
			if(!add && s.includes(style)) s = s.replace(style,'');

			if(s === 'IB')
				s = 'BI';

			this.$emit('update:modelValue',s);
		}
	}
};