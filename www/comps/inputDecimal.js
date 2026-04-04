import {getNumberFormatted} from './shared/generic.js';

/*
	we need input type "text" for cursor manipulation via setSelectionRange() - type "number" does not support it
	inputmode "decimal" is to inform browsers which keyboard to use, without needing to switch to input type "number"
*/

export default {
	name:'my-input-decimal',
	template:`<input class="input input-decimal" inputmode="decimal" type="text"
		@focus="focus"
		@input="input"
		:class="{ 'input-decimal-embedded':embedded }"
		:disabled="readonly"
		:placeholder="placeholder"
		:value="getNumberAsText(modelValue)"
	/>`,
	props:{
		allowNull:  { type:Boolean,       required:false, default:false },
		embedded:   { type:Boolean,       required:false, default:false },
		length:     { type:Number,        required:false, default:0 }, // length of integer + fraction, 0 if unrestricted
		lengthFract:{ type:Number,        required:false, default:2 }, // length of fraction, if total length is defined 0 = no fract., otherwise 0 = unrestricted
		max:        { type:[Number,null], required:false, default:null },
		min:        { type:[Number,null], required:false, default:null },
		modelValue: { type:[Number,null], required:true },
		readonly:   { type:Boolean,       required:false, default:false }
	},
	computed:{
		// simple
		hasFract:   s => s.lengthFract !== 0,
		hasLength:  s => s.length !== 0 || s.lengthFract !== 0,                  // if neither total nor fractional length is defined, both are unrestricted
		maxInteger: s => (10 ** (s.length - s.lengthFract)) - 1,                 // max. integer part,    4 digits = 9999
		maxFract:   s => s.lengthFract !== 0 ? 1 - (10 ** - s.lengthFract) : 0,  // max. fractional part, 2 digits = 0.99
		maxValue:   s => s.max !== null ? s.max : s.maxInteger + s.maxFract,     // max. value, either direct or from length such as  9999.99 (length 6, 4 int, 2 fract)
		minValue:   s => s.min !== null ? s.min : s.maxValue - (s.maxValue * 2), // min. value, either direct or from length such as -9999.99 (length 6, 4 int, 2 fract)
		placeholder:s => s.hasFract ? `0${s.charDec}` + '0'.repeat(s.lengthFract) : '0',

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
			if(this.hasFract && this.modelValue !== null && parseInt(this.modelValue) === 0) {
				// current integer value is 0, move cursor after the 0
				setTimeout(() => { e.target.setSelectionRange(1,1); }, 50);
			}	
		},
		input(e) {
			// trim, remove thousands seperator char, replace decimal char with dot
			let t = e.target.value.trim().replaceAll(this.charTho,'').replaceAll(this.charDec,'.');
			if(t === '') {
				// empty text input, set value to null/0 and input to empty/0
				this.$emit('update:modelValue', this.allowNull ? null : 0);
				return e.target.value = this.allowNull ? '' : this.getNumberAsText(0);
			}

			const cursorPos     = e.target.selectionStart;
			const isPaste       = e.inputType === 'insertFromPaste';
			const isDrop        = e.inputType === 'insertFromDrop';
			const isInitialChar = t.length === 1;

			if(this.hasFract && !isInitialChar && !isPaste && !isDrop && !t.includes('.')) {
				// required decimal char removed, reset value & input, let cursor move
				// if entire input is 1 char, user replaced text by typing after selecting all, which is fine
				e.target.value = this.getNumberAsText(this.modelValue);
				return e.target.setSelectionRange(cursorPos,cursorPos);
			}

			let trailingCharDec = false;
			if(!this.hasLength && t.endsWith('.')) {
				// case: decimal without any length definition, can use fractional part but does not need to
				// if input ends on decimal char remove it, value is sent up if valid and char kept until fractional part is typed in
				t = t.replace('.','');
				trailingCharDec = true;
			}

			// attempt to parse number from text input
			let n = Number(t);
			if(isNaN(n)) {
				// not a number, reset input
				e.target.value = this.getNumberAsText(this.modelValue);
				return e.target.setSelectionRange(cursorPos,cursorPos);
			}

			if(this.length !== 0) {
				// enforce max/min values if length is restricted
				if(n > this.maxValue) n = this.maxValue;
				if(n < this.minValue) n = this.minValue;
			}

			// valid number, update value & input
			// add trailing decimal char if it was there originally
			this.$emit('update:modelValue',n);
			e.target.value = trailingCharDec ? this.getNumberAsText(n) + this.charDec : this.getNumberAsText(n);

			// initial input (likely selected all to overwrite by typing), move to after initial input character
			if(isInitialChar)
				return e.target.setSelectionRange(1,1);

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