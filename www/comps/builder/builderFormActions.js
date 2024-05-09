import MyBuilderCaption        from './builderCaption.js';
import MyBuilderIconInput      from './builderIconInput.js';
import MyInputColor            from '../inputColor.js';
import { getDependentModules } from '../shared/builder.js';
export {MyBuilderFormActions as default};

let MyBuilderFormAction = {
	name:'my-builder-form-action',
	components:{
		MyBuilderCaption,
		MyBuilderIconInput,
		MyInputColor
	},
	template:`<tr class="builder-form-action">
		<td>
			<img class="dragAnchor" src="images/drag.png" />
		</td>
		<td>
			<my-builder-caption
				v-model="captions.formActionTitle"
				:contentName="capGen.title"
				:language="builderLanguage"
			/>
		</td>
		<td>
			<my-builder-icon-input
				@input="iconId = $event"
				:icon-id-selected="iconId"
				:module="module"
			/>
		</td>
		<td>
			<div class="row gap">
				<select v-model="jsFunctionId">
					<option value="">-</option>
					<option v-for="f in module.jsFunctions.filter(v => v.formId === null || v.formId === formId)"
						:value="f.id"
					>{{ f.name }}</option>
					<optgroup v-for="mod in getDependentModules(module).filter(v => v.id !== module.id && v.jsFunctions.length !== 0)"
						:label="mod.name"
					>
						<option v-for="f in mod.jsFunctions.filter(v => v.formId === null || v.formId === formId)"
							:value="f.id"
						>{{ f.name }}</option>
					</optgroup>
				</select>
				<my-button image="add.png"
					v-if="jsFunctionId === ''"
					@trigger="$emit('createNew','jsFunction',{formId:formId})"
					:captionTitle="capGen.button.create"
				/>
				<my-button image="open.png"
					v-if="jsFunctionId !== ''"
					@trigger="$router.push('/builder/js-function/'+jsFunctionId)"
					:captionTitle="capGen.button.open"
				/>
			</div>
		</td>
		<td class="color-input">
			<my-input-color v-model="color" :allowNull="true" :downwards="true" />
		</td>
		<td>
			<my-button image="delete.png"
				@trigger="$emit('remove')"
				:cancel="true"
				:captionTitle="capGen.button.delete"
			/>
		</td>
	</tr>`,
	props:{
		builderLanguage:{ type:String, required:true },
		formId:         { type:String, required:true },
		modelValue:     { type:Object, required:true }
	},
	emits:['createNew','remove','update:modelValue'],
	computed:{
		// inputs
		captions:{
			get()  { return this.modelValue.captions; },
			set(v) { this.update('captions',v); }
		},
		color:{
			get()  { return this.modelValue.color; },
			set(v) { this.update('color',v); }
		},
		iconId:{
			get()  { return this.modelValue.iconId; },
			set(v) { this.update('iconId',v); }
		},
		jsFunctionId:{
			get()  { return this.modelValue.jsFunctionId; },
			set(v) { this.update('jsFunctionId',v); }
		},
		
		// store
		module:         (s) => s.moduleIdMap[s.formIdMap[s.formId].moduleId],
		moduleIdMap:    (s) => s.$store.getters['schema/moduleIdMap'],
		formIdMap:      (s) => s.$store.getters['schema/formIdMap'],
		jsFunctionIdMap:(s) => s.$store.getters['schema/jsFunctionIdMap'],
		capGen:         (s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getDependentModules,
		
		// actions
		update(name,value) {
			let v = JSON.parse(JSON.stringify(this.modelValue));
			v[name] = value;
			this.$emit('update:modelValue',v);
		}
	}
};

let MyBuilderFormActions = {
	name:'my-builder-form-actions',
	components:{ MyBuilderFormAction },
	template:`<div class="builder-form-actions">
		<div>
			<my-button image="add.png"
				@trigger="add"
				:caption="capGen.button.add"
			/>
		</div>
		<table class="default-inputs" v-if="modelValue.length !== 0">
			<thead>
				<tr>
					<th></th>
					<th>{{ capGen.title }}</th>
					<th>{{ capGen.icon }}</th>
					<th>{{ capApp.jsFunctionId }}*</th>
					<th>{{ capGen.color }}</th>
				</tr>
			</thead>
			<draggable handle=".dragAnchor" tag="tbody" group="actions" itemKey="id" animation="100"
				:fallbackOnBody="true"
				:list="modelValue"
			>
				<template #item="{element,index}">
					<my-builder-form-action
						@createNew="(...args) => $emit('createNew',...args)"
						@remove="remove(index)"
						@update:modelValue="update(index,$event)"
						:builderLanguage="builderLanguage"
						:formId="formId"
						:key="index"
						:modelValue="element"
					/>
				</template>
			</draggable>
		</table>
		
		<div v-if="anyWithoutFunction" class="warning">
			<img src="images/warning.png" />
			<span>{{ capApp.warning.noJsFunction }}</span>
		</div>
	</div>`,
	props:{
		builderLanguage:{ type:String, required:true },
		formId:         { type:String, required:true },
		modelValue:     { type:Array,  required:true }
	},
	emits:['createNew','update:modelValue'],
	computed:{
		anyWithoutFunction:(s) => {
			for(const f of s.modelValue) {
				if(f.jsFunctionId === '')
					return true;
			}
			return false;
		},
		
		// stores
		capApp:(s) => s.$store.getters.captions.builder.form.actions,
		capGen:(s) => s.$store.getters.captions.generic
	},
	methods:{
		// actions
		add() {
			let v = JSON.parse(JSON.stringify(this.modelValue));
			v.unshift({
				captions:{
					formActionTitle:{}
				},
				color:null,
				iconId:null,
				jsFunctionId:''
			});
			this.$emit('update:modelValue',v);
		},
		remove(i) {
			let v = JSON.parse(JSON.stringify(this.modelValue));
			v.splice(i,1);
			this.$emit('update:modelValue',v);
		},
		update(i,value) {
			let v = JSON.parse(JSON.stringify(this.modelValue));
			v[i] = value;
			this.$emit('update:modelValue',v);
		}
	}
};