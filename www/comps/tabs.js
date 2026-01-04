export default {
	name:'my-tabs',
	template:`<div class="tabs" :class="{ 'tabs-small':small }">
		<div class="tab-entry" tabindex="0"
			v-for="(e,i) in entries"
			@click="$emit('update:modelValue',e)"
			@dragover="$emit('update:modelValue',e)"
			@key.enter="$emit('update:modelValue',e)"
			:class="{ active:e === modelValue, clickable:e !== modelValue }"
		>
			<div></div>
			<div class="row centered gap">
				<img v-if="entriesIcon.length !== 0 && entriesIcon[i] !== null" :src="entriesIcon[i]" />
				<span>{{ entriesText[i] }}</span>
			</div>
			<div>
				<my-button image="cancel.png"
					v-if="actionDel"
					@trigger="$emit('del',e)"
					:blockBubble="true"
					:naked="true"
				/>
			</div>
		</div>
		
		<div class="tab-entry" v-if="actionAdd">
			<my-button image="add.png"
				@trigger="$emit('add')"
				:caption="actionAddCap"
				:blockBubble="true"
				:naked="true"
			/>
		</div>
	</div>`,
	props:{
		actionAdd:   { type:Boolean, required:false, default:false },    // show add action
		actionAddCap:{ type:String , required:false, default:'' },
		actionDel:   { type:Boolean, required:false, default:false },    // show delete action
		entries:     { type:Array,   required:true },
		entriesIcon: { type:Array,   required:false, default:() => [] }, // icons for entries, same order
		entriesText: { type:Array,   required:true },                    // labels for entries, same order
		modelValue:  { required:true },                                  // modelValue must match any entry to be valid
		small:       { type:Boolean, required:false, default:false }
	},
	emits:['add','del','update:modelValue']
};