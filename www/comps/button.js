export {MyButtonCheck};
export {MyButton as default};

const MyButton = {
	name:'my-button',
	template:`<div class="button" data-is-input="1"
		@click.ctrl.exact="triggerMiddle"
		@click.left.exact="trigger"
		@click.shift.exact="triggerShift"
		@click.prevent.middle="triggerMiddle"
		@click.prevent.right="triggerRight"
		@keyup.enter.space="trigger"
		:class="classes"
		:tabindex="active ? 0 : -1"
		:title="captionTitle"
	>
		<img draggable="false"
			v-if="image !== '' || imageBase64 !== ''"
			:src="image !== '' ? 'images/'+image : imageBase64"
			:title="captionTitle"
		/>
		<img draggable="false"
			v-for="img in images"
			:src="'images/'+img"
			:title="captionTitle"
		/>
		<span
			v-if="caption !== ''"
			:title="captionTitle"
		>{{ caption }}</span>
	</div>`,
	props:{
		// content props
		active:      { type:Boolean, required:false, default:true },
		blockBubble: { type:Boolean, required:false, default:false },
		caption:     { type:String,  required:false, default:'' },
		captionTitle:{ type:String,  required:false, default:'' },
		image:       { type:String,  required:false, default:'' },
		images:      { type:Array,   required:false, default:() => [] },
		imageBase64: { type:String,  required:false, default:'' },
		
		// style props
		adjusts:{ type:Boolean, required:false, default:false }, // adjusts its length to avail. space (text is ellipsed if too small)
		cancel: { type:Boolean, required:false, default:false },
		darkBg: { type:Boolean, required:false, default:false },
		large:  { type:Boolean, required:false, default:false },
		naked:  { type:Boolean, required:false, default:false }
	},
	emits:['trigger','trigger-middle','trigger-right','trigger-shift'],
	computed:{
		classes:(s) => {
			return {
				adjusts:s.adjusts,
				background:!s.naked,
				cancel:s.cancel,
				clickable:s.active,
				darkBg:s.darkBg,
				large:s.large,
				naked:s.naked
			};
		}
	},
	methods:{
		trigger(ev) {
			if(!this.active) return;
			
			if(this.blockBubble)
				ev.stopPropagation();
			
			this.$emit('trigger');
		},
		triggerMiddle(ev) {
			if(!this.active) return;
			
			if(this.blockBubble)
				ev.stopPropagation();
			
			this.$emit('trigger-middle');
		},
		triggerRight(ev) {
			if(!this.active) return;
			
			if(this.blockBubble)
				ev.stopPropagation();
			
			this.$emit('trigger-right');
		},
		triggerShift(ev) {
			if(!this.active) return;
			
			if(this.blockBubble)
				ev.stopPropagation();
			
			this.$emit('trigger-shift');
		}
	}
};

const MyButtonCheck = {
	name:'my-button-check',
	template:`<my-button
		@trigger="$emit('update:modelValue',!modelValue)"
		:active="!readonly"
		:caption="caption"
		:captionTitle="captionTitle"
		:image="(reversed ? !modelValue : modelValue) ? 'checkbox1.png' : 'checkbox0.png'"
		:naked="true"
	/>`,
	props:{
		caption:     { type:String,  required:true },
		captionTitle:{ type:String,  required:false, default:'' },
		modelValue:  { type:Boolean, required:true },
		readonly:    { type:Boolean, required:false, default:false },
		reversed:    { type:Boolean, required:false, default:false }
	},
	emits:['update:modelValue']
};