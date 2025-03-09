
import {srcBase64} from './shared/image.js';
export {MyInputRating as default};

let MyInputRating = {
	name:'my-input-rating',
	template:`<div class="input-rating">
		<div class="input-rating-icons">
			<img class="input-rating-icon clickable"
				v-for="n in maxValid"
				@click.left="$emit('update:modelValue',n)"
				@click.right.prevent="$emit('update:modelValue',null)"
				:class="{ active:n <= value }"
				:src="iconSrc"
			/>
		</div>
		<input disabled class="input-rating-input" :value="input" />
	</div>`,
	props:{
		iconId:    { required:true },
		max:       { type:Number, required:true },
		modelValue:{ required:true },
		readonly:  { type:Boolean, required:false, default:false }
	},
	computed:{
		// simple
		maxValid:(s) => s.max > 0 && s.max <= 10 ? s.max : 10,
		iconSrc: (s) => s.iconId === false ? 'images/star1.png' : s.srcBase64(s.iconIdMap[s.iconId].file),
		input:   (s) => `${s.value} / ${s.maxValid}`,
		value:   (s) => s.modelValue === null ? 0 : s.modelValue,

		// stores
		iconIdMap:(s) => s.$store.getters['schema/iconIdMap']
	},
	emits:['update:modelValue'],
	methods:{
		// externals
		srcBase64
	}
};