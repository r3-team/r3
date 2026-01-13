import MyInputColorWrap      from '../inputColorWrap.js';
import MyInputDecimal        from '../inputDecimal.js';
import MyInputRange          from '../inputRange.js';
import {getTemplateDocField} from '../shared/builderTemplate.js';
export {
	MyBuilderDocBorder,
	MyBuilderDocFontAlign,
	MyBuilderDocFontFamily,
	MyBuilderDocFontLineFactor,
	MyBuilderDocFontStyles,
	MyBuilderDocHeaderFooter,
	MyBuilderDocMarginPadding
};

const MyBuilderDocBorder = {
	name:'my-builder-doc-border',
	components:{
		MyInputColorWrap,
		MyInputDecimal,
		MyInputRange
	},
	template:`<tr><td><b>{{ capGen.border }}</b></td></tr>
	<tr>
		<td><my-button-check @update:modelValue="setDraw('1',$event)" :caption="capGen.button.all" :modelValue="drawAll" :readonly /></td>
		<td>
			<div class="column gap centered" v-if="!drawAll">
				<div class="row">
					<my-bool @update:modelValue="setDraw('T',$event)" :modelValue="draw.includes('T')" :readonly />
				</div>
				<div class="row gap centered">
					<my-bool @update:modelValue="setDraw('L',$event)" :modelValue="draw.includes('L')" :readonly />
					<div class="builder-doc-input-page-box"></div>
					<my-bool @update:modelValue="setDraw('R',$event)" :modelValue="draw.includes('R')" :readonly />
				</div>
				<div class="row">
					<my-bool @update:modelValue="setDraw('B',$event)" :modelValue="draw.includes('B')" :readonly />
				</div>
			</div>
		</td>
	</tr>
	<tr>
		<td>{{ capGen.size }}</td>
		<td>
			<div class="row gap centered">
				<my-input-range   class="short" @update:modelValue="$emit('update:size',$event)" :modelValue="size" :readonly :min="0" :max="20" :step="0.1" />
				<my-input-decimal class="short" @update:modelValue="$emit('update:size',$event)" :modelValue="size" :allowNull="false" :max="20" :length="4" :lengthFract="2" />
			</div>
		</td>
	</tr>
	<tr>
		<td>{{ capGen.color }}</td>
		<td><my-input-color-wrap @update:modelValue="$emit('update:color',$event)" :allowNull="true" :modelValue="color" :readonly /></td>
	</tr>
	<tr v-if="allowCell">
		<td>{{ capApp.borderCell }}</td>
		<td><my-bool @update:modelValue="$emit('update:cell',$event)" :modelValue="cell" :readonly /></td>
	</tr>`,
	props:{
		allowCell:{ type:Boolean, required:true },
		readonly: { type:Boolean, required:true },

		// values
		cell: { type:Boolean,       required:true },
		color:{ type:[String,null], required:true },
		draw: { type:String,        required:true },
		size: { type:Number,        required:true }
	},
	emits:['update:cell','update:color','update:draw','update:size'],
	computed:{
		drawAll:s => s.draw.includes('1'),

		// stores
		capApp:s => s.$store.getters.captions.builder.doc,
		capGen:s => s.$store.getters.captions.generic
	},
	methods:{
		setDraw(mode,add) {
			// set all borders on/off
			if(mode === '1')
				return this.$emit('update:draw', add ? '1' : '');

			let v = this.draw;

			if(add) v += mode;
			else    v = v.replace(mode,'');

			this.$emit('update:draw',v);
		}
	}
};

const MyBuilderDocHeaderFooter = {
	name:'my-builder-doc-header-footer',
	components:{
		MyInputDecimal,
		MyInputRange
	},
	template:`<tr>
		<td>
			<my-button-check @update:modelValue="setActive" :caption="isHeader ? capGen.header : capGen.footer" :modelValue="active" :readonly />
		</td>
		<td>
			<select v-if="active" @input="setPageIdInherit($event.target.value)" :value="pageIdInherit !== null ? pageIdInherit : ''">
				<option value="">[{{ capApp.inheritFrom }}]</option>
				<option
					v-for="(p,i) in pages"
					v-show="p.id !== pageId"
					:value="p.id"
				>{{ capApp.inheritFrom + ': ' + capGen.page + ' ' + (i+1) }}</option>
			</select>
		</td>
	</tr>`,
	props:{
		isHeader: { type:Boolean, required:true },
		pages:    { type:Array,   required:true },
		pageId:   { type:String,  required:true },
		pageSizeX:{ type:Number,  required:true },
		readonly: { type:Boolean, required:true },
		sizeMax:  { type:Number,  required:true },

		// inputs
		active:       { type:Boolean,       required:true },
		fieldGrid:    { type:Object,        required:true },
		pageIdInherit:{ type:[String,null], required:true }
	},
	emits:['update:active','update:fieldGrid','update:pageIdInherit'],
	computed:{
		capApp:s => s.$store.getters.captions.builder.doc,
		capGen:s => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getTemplateDocField,

		// actions
		setActive(v) {
			let f = this.getTemplateDocField(this.isHeader ? 'gridHeader' : 'gridFooter');
			f.sizeX = this.pageSizeX;
			f.sizeY = this.sizeMax;
			this.$emit('update:active',v);
			this.$emit('update:fieldGrid',f);
			this.$emit('update:pageIdInherit',null);
		},
		setPageIdInherit(v) {
			this.$emit('update:pageIdInherit',v !== '' ? v : null);
		}
	}
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
					<div class="builder-doc-input-page-box"></div>
					<my-input-decimal class="short" @update:modelValue="$emit('update:r',$event)" :modelValue="r" :readonly :allowNull="false" :length="5" :lengthFract="2" />
				</div>
				<div class="row">
					<my-input-decimal class="short" @update:modelValue="$emit('update:b',$event)" :modelValue="b" :readonly :allowNull="false" :length="5" :lengthFract="2" />
				</div>
			</div>
		</td>
	</tr>`,
	props:{
		readonly:{ type:Boolean, required:true },

		// values
		t:{ type:Number, required:true },
		r:{ type:Number, required:true },
		b:{ type:Number, required:true },
		l:{ type:Number, required:true }
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