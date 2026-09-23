import { getDependentModules } from '../shared/builder.js';

export default {
	name: 'my-builder-articles-input',
	template: `<div class="column gap">
		<draggable handle=".dragAnchor" group="articles" itemKey="id" animation="100" class="builder-article-lines"
			:fallbackOnBody="true"
			:list="articleIds"
		>
			<template #item="{element,index}">
		    	<div class="builder-article-line">
					<img v-if="!readonly" class="action dragAnchor" src="images/drag.png" />

					<span v-if="articleIdMap[element].moduleId === module.id">{{ articleIdMap[element].name }}</span>
					<span v-else>{{ moduleIdMap[articleIdMap[element].moduleId].name + ': ' + articleIdMap[element].name }}</span>

					<my-button image="cancel.png"
						@trigger="remove(element)"
						:active="!readonly"
						:naked="true"
					/>
				</div>
			</template>
		</draggable>
		<div class="row gap centered">
			<span>{{ capGen.button.add }}</span>
			<select @change="add($event.target.value)" :disabled="readonly" :value="articleIdAdd">
				<option value="">-</option>
				<option v-for="a in module.articles.filter(v => !articleIds.includes(v.id))" :value="a.id">{{ a.name }}</option>
				<optgroup
					v-for="mod in getDependentModules(module).filter(v => v.id !== module.id && v.articles.length !== 0)"
					:label="mod.name"
				>
					<option v-for="a in mod.articles.filter(v => !articleIds.includes(v.id))" :value="a.id">
						{{ mod.name + ': ' + a.name }}
					</option>
				</optgroup>
			</select>
		</div>
	</div>`,
	emits: ['update:modelValue'],
	props: {
		modelValue: { type: Array, required: true },
		module: { type: Object, required: true },
		readonly: { type: Boolean, required: false, default: false },
	},
	data() {
		return {
			// inputs
			articleIds: [],
			articleIdAdd: '',
		};
	},
	watch: {
		articleIds(vNew, vOld) {
			if (JSON.stringify(vNew) !== JSON.stringify(vOld))
				this.$emit('update:modelValue', vNew);
		},
		modelValue: {
			handler() { this.reset(); },
			immediate: true
		}
	},
	computed: {
		// stores
		articleIdMap: s => s.$store.getters['schema/articleIdMap'],
		moduleIdMap: s => s.$store.getters['schema/moduleIdMap'],
		capGen: s => s.$store.getters.captions.generic,
	},
	methods: {
		// externals
		getDependentModules,

		// actions
		add(id) {
			const pos = this.articleIds.indexOf(id);
			if (pos === -1)
				this.articleIds.push(id);

			this.articleIdAdd = '';
		},
		remove(id) {
			const pos = this.articleIds.indexOf(id);
			if (pos !== -1)
				this.articleIds.splice(pos, 1);
		},
		reset() {
			if (JSON.stringify(this.articleIds) !== JSON.stringify(this.modelValue))
				this.articleIds = JSON.parse(JSON.stringify(this.modelValue));
		}
	}
};
