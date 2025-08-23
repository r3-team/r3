const MyButtonGroupPart = {
	template: `<div class="buttonGroup-part"
		@click.ctrl.exact="onClick('middle')"
		@click.left.exact="onClick('left')"
		@click.shift.exact="onClick('shift')"
		@click.prevent.middle="onClick('middle')"
		@click.prevent.right="onClick('right')"
		@keyup.enter.space="onClick('left')"
		:class="{ cancel:isCancel, clickable:!isReadonly, justImage:!isFirst && image !== '' && caption === '' }"
		:tabindex="isFirst && !isReadonly ? 0 : -1"
		:title="captionTitle !== '' ? captionTitle : caption"
	>
		<img v-if="image   !== ''" :src="'images/' + image" class="buttonGroup-part-img" />
		<div v-if="caption !== ''">{{ caption }}</div>
	</div>`,
	props:{
		caption:      { type:String,   required:false, default:'' },
		captionTitle: { type:String,   required:false, default:'' },
		isCancel:     { type:Boolean,  required:false, default:false },
		isFirst:      { type:Boolean,  required:false, default:false },
		isReadonly:   { type:Boolean,  required:false, default:false },
		image:        { type:String,   required:false, default:'' },
		onClickLeft:  { type:Function, required:false },
		onClickMiddle:{ type:Function, required:false },
		onClickRight: { type:Function, required:false },
		onClickShift: { type:Function, required:false }
	},
	methods:{
		onClick(mode) {
			if(this.isReadonly)
				return;

			switch(mode) {
				case 'left':   if(this.onClickLeft   !== undefined) this.onClickLeft();   break;
				case 'middle': if(this.onClickMiddle !== undefined) this.onClickMiddle(); break;
				case 'right':  if(this.onClickRight  !== undefined) this.onClickRight();  break;
				case 'shift':  if(this.onClickShift  !== undefined) this.onClickShift();  break;
			}
		}
	}
};

export default {
	components:{ MyButtonGroupPart },
	template: `<div class="buttonGroup" :class="{ anyClickable, cancel:allCancel }">
		<my-button-group-part
			v-for="(g,i) in group"
			:caption="g.caption"
			:captionTitle="g.captionTitle"
			:image="g.image"
			:isCancel="g.isCancel"
			:isFirst="i === 0"
			:isReadonly="g.isReadonly"
			:onClickLeft="g.onClickLeft"
			:onClickMiddle="g.onClickMiddle"
			:onClickRight="g.onClickRight"
			:onClickShift="g.onClickShift"
		/>
	</div>`,
	props:{
		group:{ type:Array, required:true }
	},
	emits:[],
	computed:{
		allCancel:   (s) => s.group.filter(v => v.isCancel   === undefined || v.isCancel).length === s.group.length,
		anyClickable:(s) => s.group.filter(v => v.isReadonly === undefined || !v.isReadonly).length > 0
	}
};