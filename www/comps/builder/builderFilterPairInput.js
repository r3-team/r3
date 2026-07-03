export default {
	name:'my-builder-filter-pair-input',
	template:`<div class="row gap space-between">
		<my-label :image :bold="value0 || value1" :caption />
		<div class="row gap wrap">
			<my-button
				@trigger="$emit('update:value1',!value1);$emit('update')"
				:active="!value0"
				:caption="capGen.option.yes"
				:image="value1 ? 'checkbox1.png' : 'checkbox0.png'"
				:naked="true"
			/>
			<my-button
				@trigger="$emit('update:value0',!value0);$emit('update')"
				:active="!value1"
				:caption="capGen.option.no"
				:image="value0 ? 'checkbox1.png' : 'checkbox0.png'"
				:naked="true"
			/>
		</div>
	</div>`,
	props: {
		caption:{ type:String,  required:true },
		image:  { type:String,  required:true },
		value0: { type:Boolean, required:true },
		value1: { type:Boolean, required:true }
	},
	emits:['update','update:value0','update:value1'],
	computed:{
		capGen:s => s.$store.getters.captions.generic
	}
};
