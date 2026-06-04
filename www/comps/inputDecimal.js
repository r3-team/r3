import {getNumberFormatted} from './shared/generic.js';

/*
	we need input type "text" for cursor manipulation via setSelectionRange() - type "number" does not support it
	inputmode "decimal" is to inform browsers which keyboard to use, without needing to switch to input type "number"
*/

export default {
	name:'my-input-decimal',
	template:`<input class="input input-decimal" inputmode="decimal" type="text" ref="input"
		@input="input"
		:class="{ 'input-decimal-embedded':embedded }"
		:disabled="readonly"
		:placeholder
	/>`,
	data() {
		return {
			valueNum:null // current numeric value from text input ('12.00' & '12' are both 12)
		};
	},
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
	watch:{
		modelValue:{
			handler(v) {
				// numeric value did not change (also true if both are null)
				if(v === this.valueNum)
					return;

				// only apply change, if numeric value changed (important for decimals with no length)
				// 12 and 12.0 are the same number, but user might be typing trailing zeroes for a number like 12.03 or 12.003
				// always applying the change would reset the input, even if the number value did not meaningfully change
				if(v === null || this.valueNum === null || Number(v) !== Number(this.valueNum)) {
					this.valueNum = v;
					this.$refs.input.value = this.getNumberAsText(v);
				}
			},
			immediate:true
		},
	},
	computed:{
		// simple
		hasFract:   s => s.lengthFract !== 0,                                    // input has fixed fractional length (ie. 2 decimal places)
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
		getThousandSeparatorsInText(s) {
			return s === '' ? 0 : s.split(this.charTho).length - 1;
		},

		// actions
		setCursor(e,pos) {
			// wait 2 animation frames before resetting selection
			// fix for Firefox mobile, as virtual keyboard rejects immediate cursor manipulation
			requestAnimationFrame(() => {
				requestAnimationFrame(() => e.target.setSelectionRange(pos,pos));
			});
		},
		update(v) {
			this.valueNum = v;

			if(v !== this.modelValue)
				this.$emit('update:modelValue',v);
		},

		// events
		input(e) {
			// trim, remove thousands seperator char, replace decimal char with dot
			let t = e.target.value.trim().replaceAll(this.charTho,'').replaceAll(this.charDec,'.');
			if(t === '') {
				// empty text input, clear value
				this.update(this.allowNull ? null : 0);
				return e.target.value = this.allowNull ? '' : this.getNumberAsText(0);
			}

			const isDeleteBack  = e.inputType === 'deleteContentBackward';
			const isDeleteForw  = e.inputType === 'deleteContentForward';
			const isPaste       = e.inputType === 'insertFromPaste';
			const isDrop        = e.inputType === 'insertFromDrop';
			const isInitChar    = t.length === 1;
			const isInitCharNeg = t.length === 1 && t === '-';
			const textInputOrg  = e.target.value.trim();
			let   cursorPos     = e.target.selectionStart;
			let   isTrailingDec = false;
			let   trailingZeros = 0;

			if(isInitCharNeg) {
				if(this.hasFract) {
					// placing a negative char (-) as first char in fixed length number, must result in full number (such as '-0.00')
					// set input to full number and move cursor to before the decimal
					e.target.value = '-' + this.getNumberAsText(0).substring(1);
					this.setCursor(e,1);
				}
				return;
			}

			// handle removal of required decimal char via text manipulation
			// if entire input is 1 char, user replaced text by typing after selecting all, which is fine
			if(this.hasFract && !isInitChar && !isPaste && !isDrop && !t.includes('.')) {
				e.target.value = this.getNumberAsText(this.valueNum);
				return isDeleteForw ? this.setCursor(e,cursorPos+1) : this.setCursor(e,cursorPos);
			}

			// special cases for decimals without required fractional component
			if(!this.hasFract) {
				if(t.endsWith('.')) {
					// ends on a decimal char, remove it, number value is emitted if valid and char returned to the text input afterwards
					t = t.replace('.','');
					isTrailingDec = true;
				}
				else if(t.includes('.') && t.endsWith('0')) {
					// trailing zeros, number value is emitted if valid and zeroes returned to the text input afterwards
					for(let i = t.length; i > 0; i--) {
						if(t.substring(i-1,i) !== '0')
							break;
						
						trailingZeros++;
					}
				}
			}

			// attempt to parse number from sanitized text input
			let n = Number(t);
			if(isNaN(n)) {
				// text is not a number, reset input to valid numeric value
				e.target.value = this.getNumberAsText(this.valueNum);
				return this.setCursor(e,cursorPos);
			}

			if(this.hasFract && n === 0 && this.allowNull && (isDeleteBack || isDeleteForw)) {
				// in a fixed length number, if 0 is reached via deletion, empty input
				e.target.value = '';
				this.update(null);
				return;
			}
			
			// enforce max/min values if length is restricted
			if(this.length !== 0) {
				if(n > this.maxValue) n = this.maxValue;
				if(n < this.minValue) n = this.minValue;
			}

			// prepare new text input from valid number
			if     (isTrailingDec)                    t = this.getNumberAsText(n) + this.charDec;
			else if(trailingZeros > 0 && n % 1 !== 0) t = this.getNumberAsText(n) + "0".repeat(trailingZeros);
			else if(trailingZeros > 0 && n % 1 === 0) t = this.getNumberAsText(n) + this.charDec + "0".repeat(trailingZeros);
			else                                      t = this.getNumberAsText(n);

			if(e.target.value !== t) {
				e.target.value = t;

				// handle cases for thousands separators
				if(this.charTho !== '' && (e.inputType === 'insertText' || isDeleteBack || isDeleteForw)) {
					const cntCharThoBef = this.getThousandSeparatorsInText(textInputOrg);
					const cntCharThoAft = this.getThousandSeparatorsInText(t);
					const cntDiff       = cntCharThoAft - cntCharThoBef;
	
					if(cntDiff !== 0 && n !== this.valueNum) {
						// thousands separator was added/removed due to new numeric value, move cursor accordingly
						cursorPos = cursorPos+cntDiff < 0 ? 0 : cursorPos+cntDiff;
					} else if(cntDiff !== 0 && n === this.valueNum && isDeleteForw) {
						// thousands separator was removed by forward deletion but value did not change, move cursor forward
						cursorPos++;
					}
				}
				this.setCursor(e,cursorPos);
			}
			this.update(n);
		}
	}
};