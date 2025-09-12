export default {
	name:'my-label',
	template:`<div class="label" :class="{ darkBg, error, large }">
		<img draggable="false"
			v-if="image !== '' || imageBase64 !== ''"
			:src="image !== '' ? 'images/'+image : imageBase64"
		/>
		<span v-if="caption !== ''" v-html="caption" />
	</div>`,
	props:{
		// content props
		caption:    { type:String,  required:false, default:'' },
		error:      { type:Boolean, required:false, default:false },
		image:      { type:String,  required:false, default:'' },
		imageBase64:{ type:String,  required:false, default:'' },
		
		// style props
		darkBg:{ type:Boolean, required:false, default:false },
		large: { type:Boolean, required:false, default:false }
	}
};