import MyInputRichtext from './../inputRichtext.js';
export {MyBuilderCaption as default};

let MyBuilderCaption = {
	name:'my-builder-caption',
	components:{MyInputRichtext},
	template:`<div class="builder-caption default-inputs">
		
		<template v-if="!richtext">
			<input v-model="valueInput"
				v-if="!multiLine"
				:class="{ long:longInput }"
				:disabled="readonly"
				:placeholder="placeholder"
			/>
			<textarea v-model="valueInput"
				v-else
				:class="{ long:longInput }"
				:disabled="readonly"
				:placeholder="placeholder"
			></textarea>
		</template>
		
		<my-input-richtext
			v-if="richtext"
			v-model="valueInput"
			:disabled="readonly"
		/>
	</div>`,
	props:{
		contentName:{ type:String,  required:false, default:'' },
		language:   { type:String,  required:true },
		longInput:  { type:Boolean, required:false, default:false },
		modelValue: { type:Object,  required:true },
		multiLine:  { type:Boolean, required:false, default:false },
		readonly:   { type:Boolean, required:false, default:false },
		richtext:   { type:Boolean, required:false, default:false }
	},
	emits:['update:modelValue'],
	computed:{
		valueInput:{
			get:function() {
				if(typeof this.modelValue[this.language] !== 'undefined')
					return this.modelValue[this.language];
				else
					return '';
			},
			set:function(v) {
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
		placeholder:function() {
			if(this.contentName === '')
				return this.language;
			
			return `${this.contentName} (${this.language})`;
		}
	}
};