import {getDependentModules} from '../shared/builder.js';
import {srcBase64}           from '../shared/image.js';
export {MyBuilderIconInput as default};

let MyBuilderIconInput = {
	name:'my-builder-icon-input',
	template:`<div class="builder-icon-input">
		<div class="iconLine input-custom" v-if="!naked" :tabindex="readonly ? -1 : 0"
			@click="click"
			:class="{ clickable:!readonly, disabled:readonly }"
		>
			<img class="builder-icon"
				v-if="iconSelected"
				:src="srcBase64(iconSelected.file)"
			/>
			<img class="builder-icon not-set" src="images/noPic.png"
				v-if="!iconSelected"
			/>
		</div>
		
		<template v-if="naked">
			<img class="builder-icon naked"
				v-if="iconSelected"
				@click="click"
				:class="{ clickable:!readonly }"
				:src="srcBase64(iconSelected.file)"
			/>
			<img class="builder-icon naked" src="images/noPic.png"
				v-if="!iconSelected"
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
								@trigger="select(null)"
								:active="iconSelected !== false"
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
								v-for="icon in mod.icons.filter(v => filter === '' || v.name.toLowerCase().includes(filter.toLowerCase()))"
								@click="select(icon.id)"
								:class="{ active:iconIdSelected === icon.id }"
								:src="srcBase64(icon.file)"
								:title="icon.name"
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>`,
	props:{
		iconIdSelected:{ required:true },
		module:        { type:Object,  required:true},
		naked:         { type:Boolean, required:false, default:false },
		readonly:      { type:Boolean, required:false, default:false }
	},
	emits:['input'],
	data() {
		return {
			filter:'',
			showInput:false
		};
	},
	computed:{
		iconSelected:(s) => s.iconIdSelected === null ? false : s.iconIdMap[s.iconIdSelected],
		
		// stores
		iconIdMap:(s) => s.$store.getters['schema/iconIdMap'],
		capGen:   (s) => s.$store.getters.captions.generic
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
		},
		select(iconId) {
			this.$emit('input',iconId);
		}
	}
};
