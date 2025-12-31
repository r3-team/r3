import {getNumberFormatted} from './shared/generic.js';

export default {
	name:'my-input-decimal',
	template:`<input
		@focus="focus"
		@input="input"
		:disabled="readonly"
		:placeholder="placeholder"
		:value="getNumberAsText(modelValue)"
	/>`,
	props:{
		allowNull : { type:Boolean, required:false, default:false },
		length:     { type:Number,  required:false, default:12 }, // total length (including the fraction part)
		lengthFract:{ type:Number,  required:false, default:2 }, // length of fraction
		modelValue: { required:true },
		readonly:   { type:Boolean, required:false, default:false }
	},
	computed:{
		// simple
		hasDecimal: s => s.lengthFract !== 0,
		placeholder:s => s.hasDecimal ? `0${s.charDec}`.padEnd(s.lengthFract) : '0',

		// stores
		charDec:s => s.$store.getters.numberSepDecimal,
		charTho:s => s.$store.getters.numberSepThousand
	},
	emits:['update:modelValue'],
	methods:{
		// externals
		getNumberFormatted,

		// presentation
		getNumberAsText(n) {
			return n === null ? '' : this.getNumberFormatted(n,this.length,this.lengthFract);
		},

		// events
		focus(e) {
			if(this.hasDecimal && this.modelValue !== null && parseInt(this.modelValue) === 0) {
				// current integer value is 0, move cursor after the 0
				setTimeout(() => { e.target.setSelectionRange(1,1); }, 50);
			}	
		},
		input(e) {
			// trim, remove thousands seperator char, replace decimal char with dot
			const t = e.target.value.trim().replaceAll(this.charTho, '').replaceAll(this.charDec,'.');

			if(t === '') {
				// empty text input, set value to null/0 and input to empty/0
				this.$emit('update:modelValue', this.allowNull ? null : 0);
				return e.target.value = this.allowNull ? '' : this.getNumberAsText(0);
			}

			const cursorPos = e.target.selectionStart;
			if(this.hasDecimal && !t.includes('.')) {
				// required decimal char removed, reset value, input & cursor
				e.target.value = this.getNumberAsText(this.modelValue);
				return e.target.setSelectionRange(cursorPos,cursorPos);
			}

			// attempt to parse number from text input
			let n = Number(t);
			if(isNaN(n)) {
				// not a number, reset input
				e.target.value = this.getNumberAsText(this.modelValue);
				return e.target.setSelectionRange(cursorPos,cursorPos);
			}

			// valid number, update value & input
			this.$emit('update:modelValue',n);
			e.target.value = this.getNumberAsText(n);

			// get length difference between input before and after change
			// need to know in case thousands seperator char was added/removed, so that we can move the cursor accordingly
			const lengthDiff = this.modelValue === null ? 0 : this.getNumberAsText(n).length - this.getNumberAsText(this.modelValue).length;

			if(lengthDiff === 0) {
				if(this.modelValue !== null && parseInt(this.modelValue) === 0 && parseInt(n) !== 0) {
					// change was replacement of initial zero value (ie. 0,00 becomes 3,00)
					// in this case, we move the cursor back to before the decimal char
					return e.target.setSelectionRange(cursorPos-1,cursorPos-1);
				}
				return e.target.setSelectionRange(cursorPos,cursorPos);
			}

			let cursorPosNext = lengthDiff > 0 ? cursorPos+lengthDiff-1 : cursorPos+lengthDiff+1;
			if(cursorPosNext < 0)
				cursorPosNext = 0;

			e.target.setSelectionRange(cursorPosNext,cursorPosNext);
		}
	}
};