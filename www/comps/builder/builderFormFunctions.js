import { getDependentModules } from '../shared/builder.js';
export {MyBuilderFormFunctions as default};

let MyBuilderFormFunction = {
	name:'my-builder-form-function',
	template:`<tr class="builder-form-function">
		<td>
			<select v-model="event">
				<option value="open"  >{{ capApp.option.open   }}</option>
				<option value="save"  >{{ capApp.option.save   }}</option>
				<option value="delete">{{ capApp.option.delete }}</option>
			</select>
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
			<my-button image="arrowDown.png"
			 	v-if="!isLast"
				@trigger="$emit('moveDown')"
				:naked="true"
				:tight="true"
			/>
			<my-button image="arrowUp.png"
			 	v-if="!isFirst"
				@trigger="$emit('moveUp')"
				:naked="true"
				:tight="true"
			/>
		</td>
		<td>
			<my-button image="cancel.png"
				@trigger="$emit('remove')"
				:naked="true"
				:tight="true"
			/>
		</td>
	</tr>`,
	props:{
		formId:    { type:String, required:true },
		isFirst:   { type:Boolean,required:true },
		isLast:    { type:Boolean,required:true },
		modelValue:{ type:Object, required:true }
	},
	emits:['moveDown','moveUp','remove','update:modelValue'],
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
	template:`<div class="builder-form-functions contentBox">
		<div class="top lower">
			<div class="area">
				<my-button
					:active="true"
					:caption="capApp.title"
					:naked="true"
				/>
				<my-button image="add.png"
					@trigger="add"
					:caption="capGen.button.add"
				/>
			</div>
			<div class="area">
				<my-button image="cancel.png"
					@trigger="$emit('close')"
					:cancel="true"
				/>
			</div>
		</div>
		
		<div class="content default-inputs">
			<table v-if="modelValue.length !== 0">
				<thead>
					<tr>
						<th>{{ capApp.event }}</th>
						<th>{{ capApp.eventBefore }}</th>
						<th>{{ capApp.jsFunctionId }}</th>
					</tr>
				</thead>
				<tbody>
					<my-builder-form-function
						v-for="(f,i) in modelValue"
						@moveDown="move(i,true)"
						@moveUp="move(i,false)"
						@remove="remove(i)"
						@update:modelValue="update(i,$event)"
						:formId="formId"
						:isFirst="i === 0"
						:isLast="i === modelValue.length-1"
						:key="i"
						:modelValue="f"
					/>
				</tbody>
			</table>
		</div>
	</div>`,
	props:{
		formId:    { type:String, required:true },
		modelValue:{ type:Array,  required:true }
	},
	emits:['close','update:modelValue'],
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