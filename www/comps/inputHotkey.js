export {MyInputHotkey as default};

let MyInputHotkey = {
	name:'my-input-hotkey',
	template:`<div class="input-hotkey gap default-inputs" :class="{ column:twoLines, row:!twoLines }">
		<div class="row gap">
			<select class="dynamic" v-model="modifier1Input" :disabled="readonly">
				<option v-for="v in modifierKeys"
					:disabled="v === modifier2Input"
					:value="v"
				>{{ capApp.modifier[v] }}</option>
			</select>
			<select class="dynamic" v-model="modifier2Input" :disabled="readonly">
				<option value=""
					:disabled="modifier1 === null"
				>-</option>
				<option v-for="v in modifierKeys"
					:disabled="v === modifier1Input"
					:value="v"
				>{{ capApp.modifier[v] }}</option>
			</select>
		</div>
		<input maxlength="1" size="1"
			v-model="charInput"
			:class="{ short:!twoLines }"
			:disabled="readonly"
			:placeholder="capApp.charHint"
		/>
	</div>`,
	props:{
		char:      { required:true }, // null if empty
		modifier1: { required:true }, // null if empty
		modifier2: { required:true }, // null if empty
		readonly:  { type:Boolean, required:false, default:false },
		twoLines:  { type:Boolean, required:false, default:false }
	},
	emits:['update:char', 'update:modifier1', 'update:modifier2'],
	data() {
		return {
			modifierKeys:['ALT','CMD','CTRL','SHIFT']
		};
	},
	computed:{
		charInput:{
			get()  { return this.char !== null ? this.char : ''; },
			set(v) {
				// ignore empty char inputs (must have a value to be valid)
				if(v !== '') this.$emit('update:char', v);
			}
		},
		modifier1Input:{
			get()  { return this.modifier1 !== null ? this.modifier1 : ''; },
			set(v) { this.$emit('update:modifier1', v !== '' ? v : null); }
		},
		modifier2Input:{
			get()  { return this.modifier2 !== null ? this.modifier2 : ''; },
			set(v) { this.$emit('update:modifier2', v !== '' ? v : null); }
		},

		// stores
		capApp:(s) => s.$store.getters.captions.input.hotkey
	}
};