import {srcBase64} from '../shared/image.js';

export default {
	name:'my-builder-tag-input',
	template:`<div class="input-custom item-box" :class="{ dynamic }">
		<div class="column gap grow">
			<div class="row gap wrap" v-if="tagsActive.length !== 0">
				<my-button
					v-for="t in tagsActive"
					@trigger="toggle(t.id)"
					:active="!readonly"
					:caption="t.name"
					:imageBase64="t.iconId !== null ? srcBase64(iconIdMap[t.iconId].file) : ''"
					:images="['checkbox1.png']"
					:key="t.id"
				/>
			</div>
			<div class="builder-tag-input-sep" />

			<span v-if="module.tags.length === 0"><i>{{ capGen.nothingThere }}</i></span>

			<div class="row gap wrap" v-if="tagsRest.length !== 0">
				<my-button
					v-for="t in tagsRest"
					@trigger="toggle(t.id)"
					:active="!readonly"
					:caption="t.name"
					:imageBase64="t.iconId !== null ? srcBase64(iconIdMap[t.iconId].file) : ''"
					:images="['checkbox0.png']"
					:key="t.id"
				/>
			</div>
		</div>
	</div>`,
	props:{
		dynamic:   { type:Boolean, required:false, default:false },
		modelValue:{ type:Array,   required:true },
		module:    { type:Object,  required:true },
		readonly:  { type:Boolean, required:true }
	},
	emits:['update:modelValue'],
	computed: {
		tagsActive:s => s.module.tags.filter(v => s.modelValue.includes(v.id)),
		tagsRest:  s => s.module.tags.filter(v => !s.modelValue.includes(v.id)),

		// stores
		capGen:    s => s.$store.getters.captions.generic,
		iconIdMap: s => s.$store.getters['schema/iconIdMap']
	},
	methods: {
		// externals
		srcBase64,

		// actions
		toggle(id) {
			const pos = this.modelValue.indexOf(id);
			this.$emit('update:modelValue', pos === -1
				? this.modelValue.concat([id])
				: this.modelValue.toSpliced(pos,1)
			);
		}
	}
};
