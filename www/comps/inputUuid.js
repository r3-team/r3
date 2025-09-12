export default {
	name:'my-input-uuid',
	template:`<div class="input-uuid">
		<div class="row wrap">
			<input v-model="val[0]" @keyup="setValue(0)" :disabled="readonly" :placeholder="getHolder(lengths[0])"  maxlength="36"         :size="lengths[0]" ref="input0" data-is-input="1" />
			<span>-</span>
			<input v-model="val[1]" @keyup="setValue(1)" :disabled="readonly" :placeholder="getHolder(lengths[1])" :maxlength="lengths[1]" :size="lengths[1]" ref="input1" :tabindex="getTabindex(1)" />
			<span>-</span>
			<input v-model="val[2]" @keyup="setValue(2)" :disabled="readonly" :placeholder="getHolder(lengths[2])" :maxlength="lengths[2]" :size="lengths[2]" ref="input2" :tabindex="getTabindex(2)" />
			<span>-</span>
			<input v-model="val[3]" @keyup="setValue(3)" :disabled="readonly" :placeholder="getHolder(lengths[3])" :maxlength="lengths[3]" :size="lengths[3]" ref="input3" :tabindex="getTabindex(3)" />
			<span>-</span>
			<input v-model="val[4]" @keyup="setValue(4)" :disabled="readonly" :placeholder="getHolder(lengths[4])" :maxlength="lengths[4]" :size="lengths[4]" ref="input4" :tabindex="getTabindex(4)" />
		</div>
		<my-button image="cancel.png"
			@trigger="clear"
			:active="!isEmpty && !readonly"
			:naked="true"
		/>
	</div>`,
	props:{
		modelValue:{ required:true },
		readonly:  { type:Boolean, required:false, default:false }
	},
	data() {
		return {
			lengths:[8,4,4,4,12],
			val:['','','','','']
		};
	},
	emits:['update:modelValue'],
	computed:{
		isEmpty:(s) => s.val[0] === '' && s.val[1] === '' && s.val[2] === '' && s.val[3] === '' && s.val[4] === '',
	},
	watch:{
		modelValue:{
			handler(valNew,valOld) {
				if(valNew === valOld)                return;
				if(valNew === null || valNew === '') return this.reset();
				
				let valNewSplit = valNew.split('-');
				if(valNewSplit.length === 5)
					this.val = valNewSplit;
			},
			immediate:true
		}
	},
	methods:{
		clear() {
			this.reset();
			this.setValueCombined();
			this.setActiveInput(0);
		},
		getHolder(n) {
			return '.'.repeat(n);
		},
		getTabindex(i) {
			return this.val[i-1] === '' && this.val[i] === '' ? -1 : 0;
		},
		reset() {
			this.val = ['','','','',''];
		},
		setActiveInput(i) {
			const el = this.$refs[`input${i}`];
			if(el !== undefined) {
				el.focus();
				this.$nextTick(() => el.select());
			}
		},
		setValue(i) {
			// special case: a full UUID was entered in first input field
			if(i === 0 && this.val[0].length === 36 && this.val[0].split('-').length === 5) {
				this.setActiveInput(0);
				return this.$emit('update:modelValue',this.val[0]);
			}

			// shorten input values to max. length
			if(this.val[i].length > this.lengths[i])
				this.val[i] = this.val[i].substring(0,8);

			// send new value
			this.setValueCombined();

			// jump to next input if current input is full and not last one
			if(this.val[i].length === this.lengths[i] && i < this.val.length - 1)
				this.setActiveInput(i+1);
		},
		setValueCombined() {
			const v = this.isEmpty ? null : this.val.join('-');
			if(v !== this.modelValue)
				this.$emit('update:modelValue',v);
		}
	}
};