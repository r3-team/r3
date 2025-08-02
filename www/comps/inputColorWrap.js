import MyInputColor from './inputColor.js';

export default {
	components:{ MyInputColor },
	template: `<div class="input-custom row nowrap gap" ref="content" :class="{ disabled:readonly, focus:dropdownShow }">
		<my-label v-if="image !== ''" :image />
		<my-input-color
			@dropdown-show="dropdownSet"
			@update:modelValue="$emit('update:modelValue',$event)"
			:allowNull
			:dropdownShow
			:modelValue
			:readonly
			:showInput
		/>
	</div>`,
	props:{
		allowNull: { type:Boolean, required:false, default:false },
		image:     { type:String,  required:false, default:'' },
		modelValue:{ required:true },
		readonly:  { type:Boolean, required:false, default:false },
		showInput: { type:Boolean, required:false, default:true }
	},
	emits:['update:modelValue'],
	computed:{
		dropdownShow:(s) => s.dropdownElm === s.$refs.content,

		// stores
		dropdownElm:(s) => s.$store.getters.dropdownElm
	},
	methods:{
		dropdownSet(state) {
			if(state && !this.dropdownShow) this.$store.commit('dropdownElm',this.$refs.content);
			if(!state && this.dropdownShow) this.$store.commit('dropdownElm',null);
		}
	}
};