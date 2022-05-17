export {MyButton as default};

let MyButton = {
	name:'my-button',
	template:`<div class="button"
		@click="trigger"
		@click.prevent.middle="triggerMiddle"
		@click.prevent.right="triggerRight"
		@keyup.enter.space="trigger"
		:class="classes"
		:tabindex="active ? 0 : -1"
		:title="captionTitle"
	>
		<img
			v-if="image !== ''"
			:src="'images/'+image"
			:title="captionTitle"
		/>
		<img
			v-if="imageBase64 !== ''"
			:src="imageBase64"
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
		imageBase64: { type:String,  required:false, default:'' },
		
		// style props
		cancel:{ type:Boolean, required:false, default:false },
		darkBg:{ type:Boolean, required:false, default:false },
		large: { type:Boolean, required:false, default:false },
		naked: { type:Boolean, required:false, default:false },
		right: { type:Boolean, required:false, default:false },
		tight: { type:Boolean, required:false, default:false }
	},
	emits:['trigger','trigger-middle','trigger-right'],
	computed:{
		classes:function() {
			return {
				background:!this.naked,
				darkBg:this.darkBg,
				cancel:this.cancel,
				clickable:this.active,
				inactive:!this.active,
				large:this.large,
				noHighlight:!this.active,
				noMargin:this.tight,
				right:this.right
			};
		}
	},
	methods:{
		trigger:function(ev) {
			if(!this.active) return;
			
			if(this.blockBubble)
				ev.stopPropagation();
			
			this.$emit('trigger');
		},
		triggerMiddle:function(ev) {
			if(!this.active) return;
			
			if(this.blockBubble)
				ev.stopPropagation();
			
			this.$emit('trigger-middle');
		},
		triggerRight:function(ev) {
			if(!this.active) return;
			
			if(this.blockBubble)
				ev.stopPropagation();
			
			this.$emit('trigger-right');
		}
	}
};