import MyInputDate from './inputDate.js';

export default {
	components:{ MyInputDate },
	template: `<div class="input-date-wrap input-custom row nowrap gap" ref="content"
		:class="{ disabled:isReadonly, dropdown:dropdownShow, focus:dropdownShow }"
	>
		<my-input-date
			@dropdown-show="dropdownSet"
			@set-unix-from="$emit('set-unix-from',$event)"
			@set-unix-to="$emit('set-unix-to',$event)"
			:dropdownShow
			:isDate
			:isTime
			:isRange
			:isReadonly
			:unixFrom
			:unixTo
			:useMonth
		/>
	</div>`,
	props:{
		isDate:    { type:Boolean, required:true },
		isTime:    { type:Boolean, required:true },
		isRange:   { type:Boolean, required:false, default:false },
		isReadonly:{ type:Boolean, required:false, default:false },
		unixFrom:  { required:true },
		unixTo:    { required:false, default:null },
		useMonth:  { type:Boolean, required:false, default:false }
	},
	emits:['set-unix-from','set-unix-to'],
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