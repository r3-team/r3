import {getDependentModules} from '../shared/builder.js';
import {srcBase64}           from '../shared/image.js';

export default {
	name:'my-builder-icon-input',
	template:`<div class="builder-icon-input">
		<div class="iconLine input-custom" v-if="!naked" :tabindex="readonly ? -1 : 0"
			@click="click"
			:class="{ clickable:!readonly, disabled:readonly }"
		>
			<img class="builder-icon" v-if="icon" :src="srcBase64(icon.file)" />
			<img class="builder-icon not-set" src="images/noPic.png" v-else />
		</div>

		<template v-if="naked">
			<img class="builder-icon naked"
				v-if="icon"
				@click="click"
				:class="{ clickable:!readonly }"
				:src="srcBase64(icon.file)"
			/>
			<img class="builder-icon naked" src="images/noPic.png"
				v-if="!icon"
				@click="click"
				:class="{ clickable:!readonly }"
			/>
		</template>

		<div class="app-sub-window under-header" v-if="showInput && iconIdMap !== null" @click.self="close">
			<div class="build-icon-input-window">
				<div class="contentBox float">
					<div class="top">
						<div class="area">
							<img class="icon" src="images/fileImage.png" />
							<h1 class="title">{{ capGen.icon }}</h1>
						</div>
						<div class="area default-inputs">
							<input v-model="filter" :placeholder="capGen.button.filter" />
						</div>
						<div class="area">
							<my-button image="cancel.png"
								@trigger="close"
								:cancel="true"
							/>
						</div>
					</div>
					<div class="top lower">
						<div class="area">
							<my-button image="ok.png"
								@trigger="close"
								:caption="capGen.button.ok"
							/>
						</div>
						<div class="area">
							<my-button image="remove.png"
								@trigger="$emit('update:modelValue',null)"
								:active="icon !== false"
								:caption="capGen.button.clear"
								:cancel="true"
							/>
						</div>
					</div>
					<div class="content">
						<div class="module" :class="{ first:i === 0 }"
							v-for="(mod,i) in getDependentModules(module).filter(v => v.icons.length !== 0)"
						>
							<span>{{ mod.name }}</span>

							<img class="builder-icon clickable"
								v-for="ic in mod.icons.filter(v => filter === '' || v.name.toLowerCase().includes(filter.toLowerCase()))"
								@click="$emit('update:modelValue',ic.id)"
								:class="{ active:modelValue === ic.id }"
								:src="srcBase64(ic.file)"
								:title="ic.name"
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>`,
	props:{
		module:    { type:Object,        required:true},
		modelValue:{ type:[String,null], required:true },
		naked:     { type:Boolean,       required:false, default:false },
		readonly:  { type:Boolean,       required:false, default:false }
	},
	emits:['update:modelValue'],
	data() {
		return {
			filter:'',
			showInput:false
		};
	},
	computed:{
		icon:s => s.modelValue === null ? false : s.iconIdMap[s.modelValue],

		// stores
		iconIdMap:s => s.$store.getters['schema/iconIdMap'],
		capGen:   s => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getDependentModules,
		srcBase64,

		// actions
		click() {
			if(!this.readonly)
				this.showInput = !this.showInput;
		},
		close() {
			this.showInput = false;
		}
	}
};
