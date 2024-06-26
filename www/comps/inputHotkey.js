export {MyInputHotkey as default};

let MyInputHotkey = {
	name:'my-input-hotkey',
	template:`<div class="column gap default-inputs">
		<div class="row gap">
			<select class="short" v-model="modifier1Input" :disabled="readonly">
				<option value="">-</option>
				<option v-for="v in modifierKeys" :value="v">{{ capApp.modifier[v] }}</option>
			</select>
			<select class="short" v-model="modifier2Input" :disabled="readonly">
				<option value="">-</option>
				<option v-for="v in modifierKeys" :value="v">{{ capApp.modifier[v] }}</option>
			</select>
		</div>
		<input maxlength="1" size="1"
			v-model="charInput"
			:disabled="readonly"
			:placeholder="capApp.charHint"
		/>
	</div>`,
	props:{
		char:     { required:true },
		modifier1:{ required:true },
		modifier2:{ required:true },
		readonly: { type:Boolean, required:true }
	},
	emits:['update:char', 'update:modifier1', 'update:modifier2'],
	data() {
		return {
			modifierKeys:['ALT','CTRL','SHIFT']
		};
	},
	computed:{
		charInput:{
			get()  { return this.char !== null ? this.char : ''; },
			set(v) { this.$emit('update:char', v !== '' ? v : null); }
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