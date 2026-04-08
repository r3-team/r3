import MyBuilderCaption        from './builderCaption.js';
import MyBuilderIconInput      from './builderIconInput.js';
import MyBuilderOpenDoc        from './builderOpenDoc.js';
import MyBuilderOpenForm       from './builderOpenForm.js';
import {getDependentModules}   from '../shared/builder.js';
import {getTemplateFormAction} from '../shared/builderTemplate.js';
import {openLink}              from '../shared/generic.js';

const MyBuilderFormAction = {
	name:'my-builder-form-action',
	components:{
		MyBuilderCaption,
		MyBuilderIconInput,
		MyBuilderOpenDoc,
		MyBuilderOpenForm
	},
	template:`<div class="builder-form-action default-inputs">
		<div class="builder-form-action-top">
			<img v-if="!readonly" class="dragAnchor" src="images/drag.png" />
			<b>A{{ position }}</b>
			<my-button
				@trigger="open = !open"
				:captionTitle="capGen.button.show"
				:image="open ? 'triangleDown.png' : 'triangleRight.png'"
				:naked="true"
			/>
			<my-builder-icon-input
				@input="iconId = $event"
				:icon-id-selected="iconId"
				:module
				:readonly
			/>
			<my-builder-caption
				v-model="captions.formActionTitle"
				:contentName="capGen.title"
				:language="builderLanguage"
				:readonly
			/>
			<span>{{ capGen.state }}</span>
			<select v-model="state" class="auto" :disabled="readonly">
				<option value="hidden">{{ capGen.hidden }}</option>
				<option value="default">{{ capGen.default }}</option>
				<option value="readonly">{{ capGen.readonly }}</option>
			</select>
			<my-button image="delete.png"
				@trigger="$emit('remove')"
				:active="!readonly"
				:cancel="true"
				:captionTitle="capGen.button.delete"
			/>
		</div>

		<table class="generic-table" v-if="open">
			<tbody>
				<tr>
					<td>{{ capGen.button.functionExec }}</td>
					<td>
						<div class="row gap centered">
							<select v-model="jsFunctionId" :disabled="readonly">
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
								:active="!readonly"
								:captionTitle="capGen.button.create"
							/>
							<my-button image="open.png"
								v-if="jsFunctionId !== ''"
								@trigger="$router.push('/builder/js-function/'+jsFunctionId)"
								@trigger-middle="openLink('#/builder/js-function/'+jsFunctionId,true)"
								:captionTitle="capGen.button.open"
							/>
						</div>
					</td>
				</tr>
				<tr>
					<td>{{ capGen.formOpen }}</td>
					<td>
						<my-builder-open-form
							v-model="openForm"
							:allowAllForms="true"
							:joinsIndexMap
							:module
							:readonly
						/>
					</td>
				</tr>
				<tr>
					<td>{{ capGen.button.pdfCreate }}</td>
					<td>
						<my-builder-open-doc
							v-model="openDoc"
							:dataFields
							:joinsIndexMap
							:module
							:readonly
						/>
					</td>
				</tr>
			</tbody>
		</table>
	</div>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		dataFields:     { type:Array,   required:true },
		formId:         { type:String,  required:true },
		joinsIndexMap:  { type:Object,  required:true },
		position:       { type:Number,  required:true },
		modelValue:     { type:Object,  required:true },
		readonly:       { type:Boolean, required:true }
	},
	emits:['createNew','remove','update:modelValue'],
	data() {
		return {
			open:false
		};
	},
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
			get()  { return this.modelValue.jsFunctionId === null ? '' : this.modelValue.jsFunctionId; },
			set(v) { this.update('jsFunctionId',v === '' ? null : v); }
		},
		openDoc:{
			get()  { return this.modelValue.openDoc; },
			set(v) { this.update('openDoc',v); }
		},
		openForm:{
			get()  { return this.modelValue.openForm; },
			set(v) { this.update('openForm',v); }
		},
		state:{
			get()  { return this.modelValue.state; },
			set(v) { this.update('state',v); }
		},
		
		// store
		module:         s => s.moduleIdMap[s.formIdMap[s.formId].moduleId],
		moduleIdMap:    s => s.$store.getters['schema/moduleIdMap'],
		formIdMap:      s => s.$store.getters['schema/formIdMap'],
		jsFunctionIdMap:s => s.$store.getters['schema/jsFunctionIdMap'],
		capApp:         s => s.$store.getters.captions.builder.form.actions,
		capGen:         s => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getDependentModules,
		openLink,
		
		// actions
		update(name,value) {
			let v = JSON.parse(JSON.stringify(this.modelValue));
			v[name] = value;
			this.$emit('update:modelValue',v);
		}
	}
};

export default {
	name:'my-builder-form-actions',
	components:{ MyBuilderFormAction },
	template:`<div class="builder-form-actions">
		<div><my-button image="add.png" @trigger="add" :active="!readonly" :caption="capGen.button.add" /></div>
		<br />

		<draggable handle=".dragAnchor" tag="div" group="actions" itemKey="id" animation="100"
			v-if="modelValue.length !== 0"
			:fallbackOnBody="true"
			:list="modelValue"
		>
			<template #item="{element,index}">
				<my-builder-form-action
					@createNew="(...args) => $emit('createNew',...args)"
					@remove="remove(index)"
					@update:modelValue="update(index,$event)"
					:builderLanguage
					:dataFields
					:formId
					:joinsIndexMap
					:key="index"
					:modelValue="element"
					:position="index"
					:readonly
				/>
			</template>
		</draggable>
	</div>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		dataFields:     { type:Array,   required:true },
		formId:         { type:String,  required:true },
		joinsIndexMap:  { type:Object,  required:true },
		modelValue:     { type:Array,   required:true },
		readonly:       { type:Boolean, required:true }
	},
	emits:['createNew','update:modelValue'],
	computed:{
		// stores
		capGen:s => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getTemplateFormAction,

		// actions
		add() {
			let v = JSON.parse(JSON.stringify(this.modelValue));
			v.unshift(this.getTemplateFormAction());
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