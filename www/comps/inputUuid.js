export {MyInputUuid as default};

let MyInputUuid = {
	name:'my-input-uuid',
	template:`<div class="input-uuid">
		<input v-model="val[0]" :disabled="readonly" :placeholder="getHolder(8)"  size="8" @keyup="setFirstBlock($event.target.value)" data-is-input="1" />
		<span>-</span>
		<input v-model="val[1]" :disabled="readonly" :placeholder="getHolder(4)"  size="4"  maxlength="4"  @keyup="set" />
		<span>-</span>
		<input v-model="val[2]" :disabled="readonly" :placeholder="getHolder(4)"  size="4"  maxlength="4"  @keyup="set" />
		<span>-</span>
		<input v-model="val[3]" :disabled="readonly" :placeholder="getHolder(4)"  size="4"  maxlength="4"  @keyup="set" />
		<span>-</span>
		<input v-model="val[4]" :disabled="readonly" :placeholder="getHolder(12)" size="12" maxlength="12" @keyup="set" />
	</div>`,
	props:{
		modelValue:{ required:true },
		readonly:  { type:Boolean, required:false, default:false }
	},
	data() {
		return {
			val:['','','','','']
		};
	},
	emits:['update:modelValue'],
	watch:{
		modelValue(valNew,valOld) {
			if(valNew === valOld)                return;
			if(valNew === null || valNew === '') return this.reset();
			
			let valNewSplit = valNew.split('-');
			if(valNewSplit.length === 5)
				this.val = valNewSplit;
		}
	},
	methods:{
		getHolder(n) {
			return '.'.repeat(n);
		},
		reset() {
			this.val = ['','','','',''];
		},
		set() {
			if(this.val.join('-') !== this.modelValue)
				this.$emit('update:modelValue',this.val.join('-'));
		},
		setFirstBlock(v) {
			if(v.length === 36 && v.split('-').length === 5)
				return this.$emit('update:modelValue',v);
			
			this.val[0] = v.substring(0,8);
			this.set();
		}
	}
};