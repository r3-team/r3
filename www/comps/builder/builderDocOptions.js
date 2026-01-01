
import MyInputColorWrap from '../inputColorWrap.js';
import MyInputDecimal   from '../inputDecimal.js';

export const MyBuilderDocFont = {
	name:'my-builder-form-functions',
	components:{ MyInputColorWrap, MyInputDecimal },
	template:`
		<tr>
			<td>{{ capApp.family }}</td>
			<td>
				<select :disabled="readonly" :value="family" @input="$emit('update:family', $event.target.value)">
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
				</select>
			</td>
		</tr>
		<tr>
			<td>{{ capApp.size }}</td>
			<td>
				<my-input-decimal
					@update:modelValue="$emit('update:size',$event)"
					:length="4"
					:lengthFract="2"
					:modelValue="size"
					:readonly="readonly"
				/>
			</td>
		</tr>
		<tr>
			<td>{{ capApp.lineFactor }}</td>
			<td>
				<div class="row gap centered">
					<input type="range"
						@input="$emit('update:lineFactor', Number($event.target.value))"
						:disabled="readonly"
						:min="0.05"
						:max="3.0"
						:step="0.05"
						:value="lineFactor"
					/>
					<input class="short" disabled :value="String(parseInt(lineFactor * 100)) + '%'" />
				</div>
			</td>
		</tr>
		<tr>
			<td>{{ capApp.alignHor }}</td>
			<td>
				<select :disabled="readonly" :value="align" @input="$emit('update:align', $event.target.value)">
					<option value="L">{{ capGen.alignmentHor.left }}</option>
					<option value="J">{{ capGen.alignmentHor.justify }}</option>
					<option value="R">{{ capGen.alignmentHor.right }}</option>
				</select>
			</td>
		</tr>
		<tr>
			<td>{{ capApp.style }}</td>
			<td>
				<div class="row gap centered">
					<my-button-check :caption="capApp.styleBold"   :modelValue="style.includes('B')" :readonly="readonly" @update:modelValue="setStyle('B',$event)" />
					<my-button-check :caption="capApp.styleItalic" :modelValue="style.includes('I')" :readonly="readonly" @update:modelValue="setStyle('I',$event)" />
				</div>
			</td>
		</tr>
		<tr>
			<td>{{ capApp.color }}</td>
			<td><my-input-color-wrap :allowNull="true" :modelValue="color" @update:modelValue="$emit('update:color',$event)" :readonly /></td>
		</tr>
		<tr>
			<td>{{ capGen.numberSepThousand }}</td>
			<td>
				<select :disabled="readonly" :value="numberSepTho" @input="$emit('update:numberSepTho', $event.target.value)">
					<option value=".">{{ capGen.option.numberSeparator.dot }}</option>
					<option value=",">{{ capGen.option.numberSeparator.comma }}</option>
					<option value="'">{{ capGen.option.numberSeparator.apos }}</option>
					<option value="·">{{ capGen.option.numberSeparator.mdot }}</option>
					<option value=" ">{{ capGen.option.numberSeparator.space }}</option>
					<option value="0">{{ capGen.option.numberSeparator.none }}</option>
				</select>
			</td>
		</tr>
		<tr>
			<td>{{ capGen.numberSepDecimal }}</td>
			<td>
				<select :disabled="readonly" :value="numberSepDec" @input="$emit('update:numberSepDec', $event.target.value)">
					<option value=".">{{ capGen.option.numberSeparator.dot }}</option>
					<option value=",">{{ capGen.option.numberSeparator.comma }}</option>
					<option value="'">{{ capGen.option.numberSeparator.apos }}</option>
					<option value="·">{{ capGen.option.numberSeparator.mdot }}</option>
					<option value=" ">{{ capGen.option.numberSeparator.space }}</option>
				</select>
			</td>
		</tr>
		<tr>
			<td>{{ capApp.dateFormat }}</td>
			<td>
				<select :disabled="readonly" :value="dateFormat" @input="$emit('update:dateFormat', $event.target.value)">
					<option value="Y-m-d">{{ capGen.dateFormat0 }}</option>
					<option value="Y/m/d">{{ capGen.dateFormat1 }}</option>
					<option value="d.m.Y">{{ capGen.dateFormat2 }}</option>
					<option value="d/m/Y">{{ capGen.dateFormat3 }}</option>
					<option value="m/d/Y">{{ capGen.dateFormat4 }}</option>
				</select>
			</td>
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
		</tr>
	`,
	props:{
		align:       { type:String,  required:true },
		boolFalse:   { type:String,  required:true },
		boolTrue:    { type:String,  required:true },
		color:       { required:true },
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
		// stores
		capApp:(s) => s.$store.getters.captions.builder.doc.font,
		capGen:(s) => s.$store.getters.captions.generic
	},
	methods:{
		setStyle(style,add) {
			let s = this.style;

			if(add && !s.includes(style)) s += style;
			if(!add && s.includes(style)) s = s.replace(style,'');

			if(s === 'IB')
				s = 'BI';

			this.$emit('update:style',s);
		}
	}
};