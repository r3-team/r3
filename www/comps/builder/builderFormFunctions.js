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
			<div class="row">
				<my-button image="open.png"
					@trigger="openFunction"
					:active="jsFunctionId !== ''"
				/>
				<select v-model="jsFunctionId">
					<option value="">-</option>
					<optgroup v-for="mod in getDependentModules(module,modules).filter(v => v.jsFunctions.length !== 0)"
						:label="mod.name"
					>
						<option v-for="f in mod.jsFunctions.filter(v => v.formId === null || v.formId === formId)"
							:value="f.id"
						>{{ f.name }}</option>
					</optgroup>
				</select>
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
	emits:['remove','update:modelValue'],
	computed:{
		// inputs
		event:{
			get:function()  { return this.modelValue.event; },
			set:function(v) { this.update('event',v); }
		},
		eventBefore:{
			get:function()  { return this.modelValue.eventBefore; },
			set:function(v) { this.update('eventBefore',v); }
		},
		jsFunctionId:{
			get:function()  { return this.modelValue.jsFunctionId; },
			set:function(v) { this.update('jsFunctionId',v); }
		},
		
		// store
		module:         function() { return this.moduleIdMap[this.formIdMap[this.formId].moduleId]; },
		modules:        function() { return this.$store.getters['schema/modules']; },
		moduleIdMap:    function() { return this.$store.getters['schema/moduleIdMap']; },
		formIdMap:      function() { return this.$store.getters['schema/formIdMap']; },
		jsFunctionIdMap:function() { return this.$store.getters['schema/jsFunctionIdMap']; },
		capApp:         function() { return this.$store.getters.captions.builder.form.functions; },
		capGen:         function() { return this.$store.getters.captions.generic; },
	},
	methods:{
		// externals
		getDependentModules,
		
		// actions
		openFunction:function() {
			this.$router.push('/builder/js-function/'+this.jsFunctionId);
		},
		update:function(name,value) {
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
	emits:['update:modelValue'],
	computed:{
		// stores
		capApp:function() { return this.$store.getters.captions.builder.form.functions },
		capGen:function() { return this.$store.getters.captions.generic }
	},
	methods:{
		// actions
		add:function() {
			let v = JSON.parse(JSON.stringify(this.modelValue));
			v.unshift({
				event:'open',
				eventBefore:false,
				jsFunctionId:''
			});
			this.$emit('update:modelValue',v);
		},
		move:function(i,down) {
			let v   = JSON.parse(JSON.stringify(this.modelValue));
			let pos = down ? i+1 : i-1;
			v.splice(pos,0,v.splice(i,1)[0]);
			this.$emit('update:modelValue',v);
		},
		remove:function(i) {
			let v = JSON.parse(JSON.stringify(this.modelValue));
			v.splice(i,1);
			this.$emit('update:modelValue',v);
		},
		update:function(i,value) {
			let v = JSON.parse(JSON.stringify(this.modelValue));
			v[i] = value;
			this.$emit('update:modelValue',v);
		}
	}
};