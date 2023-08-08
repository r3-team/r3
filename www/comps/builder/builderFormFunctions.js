import { getDependentModules } from '../shared/builder.js';
export {MyBuilderFormFunctions as default};

let MyBuilderFormFunction = {
	name:'my-builder-form-function',
	template:`<tr class="builder-form-function">
		<td>
			<div class="row centered gap">
				<img class="dragAnchor" src="images/drag.png" />
				<select v-model="event">
					<option value="open"  >{{ capApp.option.open   }}</option>
					<option value="save"  >{{ capApp.option.save   }}</option>
					<option value="delete">{{ capApp.option.delete }}</option>
				</select>
			</div>
		</td>
		<td>
			<my-bool v-model="eventBefore" />
		</td>
		<td>
			<div class="row gap">
				<select v-model="jsFunctionId">
					<option value="">-</option>
					<option v-for="f in module.jsFunctions.filter(v => v.formId === null || v.formId === formId)"
						:value="f.id"
					>{{ f.name }}</option>
					<optgroup v-for="mod in getDependentModules(module,modules).filter(v => v.id !== module.id && v.jsFunctions.length !== 0)"
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
		<td>
			<my-button image="delete.png"
				@trigger="$emit('remove')"
				:cancel="true"
				:captionTitle="capGen.button.delete"
			/>
		</td>
	</tr>`,
	props:{
		formId:    { type:String, required:true },
		modelValue:{ type:Object, required:true }
	},
	emits:['createNew','remove','update:modelValue'],
	computed:{
		// inputs
		event:{
			get()  { return this.modelValue.event; },
			set(v) { this.update('event',v); }
		},
		eventBefore:{
			get()  { return this.modelValue.eventBefore; },
			set(v) { this.update('eventBefore',v); }
		},
		jsFunctionId:{
			get()  { return this.modelValue.jsFunctionId; },
			set(v) { this.update('jsFunctionId',v); }
		},
		
		// store
		module:         (s) => s.moduleIdMap[s.formIdMap[s.formId].moduleId],
		modules:        (s) => s.$store.getters['schema/modules'],
		moduleIdMap:    (s) => s.$store.getters['schema/moduleIdMap'],
		formIdMap:      (s) => s.$store.getters['schema/formIdMap'],
		jsFunctionIdMap:(s) => s.$store.getters['schema/jsFunctionIdMap'],
		capApp:         (s) => s.$store.getters.captions.builder.form.functions,
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

let MyBuilderFormFunctions = {
	name:'my-builder-form-functions',
	components:{ MyBuilderFormFunction },
	template:`<div class="builder-form-functions">
		<div>
			<my-button image="add.png"
				@trigger="add"
				:caption="capGen.button.add"
			/>
		</div>
		<table class="default-inputs" v-if="modelValue.length !== 0">
			<thead>
				<tr>
					<th>{{ capApp.event }}</th>
					<th>{{ capApp.eventBefore }}</th>
					<th>{{ capApp.jsFunctionId }}</th>
				</tr>
			</thead>
			<draggable handle=".dragAnchor" tag="tbody" group="functions" itemKey="id" animation="100"
				:fallbackOnBody="true"
				:list="modelValue"
			>
				<template #item="{element,index}">
					<my-builder-form-function
						@createNew="(...args) => $emit('createNew',...args)"
						@remove="remove(index)"
						@update:modelValue="update(index,$event)"
						:formId="formId"
						:key="index"
						:modelValue="element"
					/>
				</template>
			</draggable>
		</table>
	</div>`,
	props:{
		formId:    { type:String, required:true },
		modelValue:{ type:Array,  required:true }
	},
	emits:['createNew','update:modelValue'],
	computed:{
		// stores
		capApp:(s) => s.$store.getters.captions.builder.form.functions,
		capGen:(s) => s.$store.getters.captions.generic
	},
	methods:{
		// actions
		add() {
			let v = JSON.parse(JSON.stringify(this.modelValue));
			v.unshift({
				event:'open',
				eventBefore:false,
				jsFunctionId:''
			});
			this.$emit('update:modelValue',v);
		},
		move(i,down) {
			let v   = JSON.parse(JSON.stringify(this.modelValue));
			let pos = down ? i+1 : i-1;
			v.splice(pos,0,v.splice(i,1)[0]);
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