import MyInputRichtext from './../inputRichtext.js';
export {MyBuilderCaption as default};

let MyBuilderCaption = {
	name:'my-builder-caption',
	components:{MyInputRichtext},
	template:`<div class="builder-caption default-inputs">
		
		<template v-if="!richtext">
			<input v-model="valueInput"
				v-if="!multiLine"
				:class="{ dynamic:dynamicSize, long:longInput }"
				:disabled="readonly"
				:placeholder="placeholder"
			/>
			<textarea v-model="valueInput"
				v-else
				:class="{ dynamic:dynamicSize, long:longInput }"
				:disabled="readonly"
				:placeholder="placeholder"
			></textarea>
		</template>
		
		<my-input-richtext
			v-if="richtext"
			v-model="valueInput"
			@hotkey="$emit('hotkey',$event)"
			:readonly="readonly"
		/>
	</div>`,
	props:{
		contentName:{ type:String,  required:false, default:'' },
		dynamicSize:{ type:Boolean, required:false, default:false },
		language:   { type:String,  required:true },
		longInput:  { type:Boolean, required:false, default:false },
		modelValue: { type:Object,  required:true },
		multiLine:  { type:Boolean, required:false, default:false },
		readonly:   { type:Boolean, required:false, default:false },
		richtext:   { type:Boolean, required:false, default:false }
	},
	emits:['hotkey','update:modelValue'],
	computed:{
		valueInput:{
			get() {
				if(typeof this.modelValue[this.language] !== 'undefined')
					return this.modelValue[this.language];
				else
					return '';
			},
			set(v) {
				let value = JSON.parse(JSON.stringify(this.modelValue));
				
				if(v === '')
					delete value[this.language];
				else
					value[this.language] = v;
				
				// send sorted objected
				// to compare against language codes from DB, which are always sorted
				this.$emit('update:modelValue',
					JSON.parse(JSON.stringify(value,Object.keys(value).sort())));
			}
		},
		placeholder() {
			return this.contentName === ''
				? this.language : `${this.contentName} (${this.language})`;
		}
	}
};