export {MyBuilderRelations as default};

let MyBuilderRelationsItemPolicy = {
	name:'my-builder-relations-item-policy',
	template:`<tr>
		<td>#{{ position+1 }}</td>
		<td>
			<select v-model="roleId">
				<option v-for="r in module.roles" :value="r.id">
					{{ r.name }}
				</option>
			</select>
		</td>
		<td><my-bool v-model="actionSelect" /></td>
		<td><my-bool v-model="actionUpdate" /></td>
		<td><my-bool v-model="actionDelete" /></td>
		<td>
			<select v-model="pgFunctionIdExcl">
				<option :value="null">[{{ capApp.policyNotSet }}]</option>
				<option v-for="f in filterFunctions" :value="f.id">
					{{ f.name }}
				</option>
			</select>
		</td>
		<td>
			<select v-model="pgFunctionIdIncl">
				<option :value="null">[{{ capApp.policyNotSet }}]</option>
				<option v-for="f in filterFunctions" :value="f.id">
					{{ f.name }}
				</option>
			</select>
		</td>
		<td>
			<div class="row centered">
				<my-button image="arrowDown.png"
					v-if="!isLast"
					@trigger="$emit('moveDown')"
					:naked="true"
				/>
				<my-button image="arrowUp.png"
					v-if="position !== 0"
					@trigger="$emit('moveUp')"
					:naked="true"
				/>
			</div>
		</td>
		<td>
			<my-button image="cancel.png"
				@trigger="$emit('remove')"
				:naked="true"
			/>
		</td>
	</tr>`,
	props:{
		isLast:    { type:Boolean, required:true },
		modelValue:{ type:Object,  required:true },
		moduleId:  { type:String,  required:true },
		position:  { type:Number,  required:true }
	},
	emits:['moveDown','moveUp','remove','update:modelValue'],
	computed:{
		filterFunctions:function() {
			// limit to integer array returns, as in: INTEGER[], bigint[], INT [] or integer ARRAY
			let pat = /^(integer|bigint|int)(\s?\[\]|\sarray)$/i;
			let out = [];
			for(let i = 0, j = this.module.pgFunctions.length; i < j; i++) {
				let f = this.module.pgFunctions[i];
				
				if(pat.test(f.codeReturns))
					out.push(f);
			}
			return out;
		},
		
		// inputs
		actionDelete:{
			get:function()  { return this.modelValue.actionDelete; },
			set:function(v) { this.update('actionDelete',v); }
		},
		actionSelect:{
			get:function()  { return this.modelValue.actionSelect; },
			set:function(v) { this.update('actionSelect',v); }
		},
		actionUpdate:{
			get:function()  { return this.modelValue.actionUpdate; },
			set:function(v) { this.update('actionUpdate',v); }
		},
		pgFunctionIdExcl:{
			get:function()  { return this.modelValue.pgFunctionIdExcl; },
			set:function(v) { this.update('pgFunctionIdExcl',v); }
		},
		pgFunctionIdIncl:{
			get:function()  { return this.modelValue.pgFunctionIdIncl; },
			set:function(v) { this.update('pgFunctionIdIncl',v); }
		},
		roleId:{
			get:function()  { return this.modelValue.roleId; },
			set:function(v) { this.update('roleId',v); }
		},
		
		// stores
		module:function() { return this.$store.getters['schema/moduleIdMap'][this.moduleId]; },
		capApp:function() { return this.$store.getters.captions.builder.relation; }
	},
	methods:{
		update:function(name,value) {
			let v = JSON.parse(JSON.stringify(this.modelValue));
			v[name] = value;
			
			this.$emit('update:modelValue',v);
		}
	}
};

let MyBuilderRelationsItem = {
	name:'my-builder-relations-item',
	components:{
		MyBuilderRelationsItemPolicy
	},
	template:`<tbody>
		<tr>
			<td>
				<my-button image="open.png"
					v-if="!isNew"
					@trigger="open"
				/>
			</td>
			<td>
				<input class="long" v-model="name" :placeholder="isNew ? capApp.newRelation : ''" />
			</td>
			<td>
				<my-button image="visible1.png"
					@trigger="showInfo"
					:active="!isNew"
				/>
			</td>
			<td>
				<my-button
					@trigger="showPolicies = !showPolicies"
					:caption="String(policies.length)"
					:image="showPolicies ? 'triangleDown.png' : 'triangleRight.png'"
				/>
			</td>
			<td>
				<input v-model.number="retentionCountInput" :placeholder="capApp.retentionCount" />
			</td>
			<td>
				<input v-model.number="retentionDaysInput" :placeholder="capApp.retentionDays" />
			</td>
			<td>
				<div class="row">
					<my-button image="save.png"
						@trigger="set"
						:active="hasChanges"
					/>
					<my-button image="delete.png"
						v-if="!isNew"
						@trigger="delAsk"
						:cancel="true"
					/>
				</div>
			</td>
		</tr>
		<tr v-if="showPolicies">
			<td colspan="999">
				<div class="sub-component">
					<table v-if="policies.length !== 0">
						<thead>
							<tr>
								<td></td>
								<td></td>
								<td colspan="3">{{ capApp.policyActions }}</td>
								<td colspan="2">{{ capApp.policyFunctions }}</td>
								<td colspan="2"></td>
							</tr>
							<tr>
								<td>{{ capGen.order }}</td>
								<td>{{ capGen.role }}</td>
								<td>{{ capApp.policyActionSelect }}</td>
								<td>{{ capApp.policyActionUpdate }}</td>
								<td>{{ capApp.policyActionDelete }}</td>
								<td>{{ capApp.policyFunctionExcl }}</td>
								<td>{{ capApp.policyFunctionIncl }}</td>
								<td colspan="2"></td>
							</tr>
						</thead>
						<tbody>
							<my-builder-relations-item-policy
								v-for="(p,i) in policies"
								@moveDown="policies.splice(i+1,0,policies.splice(i,1)[0])"
								@moveUp="policies.splice(i-1,0,policies.splice(i,1)[0])"
								@remove="policies.splice(i,1)"
								@update:modelValue="policies[i] = $event"
								:isLast="i === policies.length-1"
								:modelValue="p"
								:moduleId="moduleId"
								:position="i"
							/>
						</tbody>
					</table>
					<p v-if="policies.length !== 0">
						{{ capApp.policyExplanation }}
					</p>
					
					<my-button image="add.png"
						@trigger="addPolicy"
						:caption="capGen.button.add"
					/>
				</div>
			</td>
		</tr>
	</tbody>`,
	props:{
		moduleId:{ type:String, required:true },
		relation:{ type:Object, required:false,
			default:function() { return{
				id:null,
				name:'',
				retentionCount:null,
				retentionDays:null,
				policies:[]
			}}
		}
	},
	data:function() {
		return {
			name:this.relation.name,
			retentionCount:this.relation.retentionCount,
			retentionDays:this.relation.retentionDays,
			policies:JSON.parse(JSON.stringify(this.relation.policies)),
			
			// states
			showPolicies:false
		};
	},
	computed:{
		hasChanges:function() {
			return this.name !== this.relation.name
				|| this.retentionCount !== this.relation.retentionCount
				|| this.retentionDays !== this.relation.retentionDays
				|| JSON.stringify(this.policies) !== JSON.stringify(this.relation.policies)
			;
		},
		retentionCountInput:{
			get:function()  { return this.retentionCount; },
			set:function(v) { this.retentionCount = v === '' ? null : v; },
		},
		retentionDaysInput:{
			get:function()  { return this.retentionDays; },
			set:function(v) { this.retentionDays = v === '' ? null : v; },
		},
		
		// simple states
		isNew:function() { return this.relation.id === null; },
		
		// stores
		capApp:function() { return this.$store.getters.captions.builder.relation; },
		capGen:function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		addPolicy:function() {
			this.policies.push({
				roleId:null,
				pgFunctionIdExcl:null,
				pgFunctionIdIncl:null,
				actionDelete:false,
				actionSelect:false,
				actionUpdate:false
			});
		},
		open:function() {
			this.$router.push('/builder/relation/'+this.relation.id);
		},
		showInfo:function() {
			this.$store.commit('dialog',{
				captionBody:this.relation.id,
				captionTop:this.relation.name,
				buttons:[{
					caption:this.capGen.button.cancel,
					image:'cancel.png'
				}]
			});
		},
		
		// backend calls
		delAsk:function() {
			this.$store.commit('dialog',{
				captionBody:this.capApp.dialog.deleteRelation,
				buttons:[{
					cancel:true,
					caption:this.capGen.button.delete,
					exec:this.del,
					image:'delete.png'
				},{
					caption:this.capGen.button.cancel,
					image:'cancel.png'
				}]
			});
		},
		del:function() {
			let trans = new wsHub.transactionBlocking();
			trans.add('relation','del',{
				id:this.relation.id
			},this.delOk);
			trans.send(this.$root.genericError);
		},
		delOk:function(res) {
			this.$root.schemaReload(this.moduleId);
		},
		set:function() {
			let trans = new wsHub.transactionBlocking();
			trans.add('relation','set',{
				id:this.relation.id,
				moduleId:this.moduleId,
				name:this.name,
				retentionCount:this.retentionCount,
				retentionDays:this.retentionDays,
				policies:this.policies
			},this.setOk);
			trans.send(this.$root.genericError);
		},
		setOk:function(res) {
			if(this.isNew) {
				this.name     = '';
				this.policies = [];
			}
			this.$root.schemaReload(this.moduleId);
		}
	}
};

let MyBuilderRelations = {
	name:'my-builder-relations',
	components:{MyBuilderRelationsItem},
	template:`<div class="contentBox grow builder-relations">
		
		<div class="top">
			<div class="area nowrap">
				<h1 class="title">{{ capApp.title }}</h1>
			</div>
		</div>
		
		<div class="content default-inputs" v-if="module">
			<table>
				<thead>
					<tr>
						<th>{{ capGen.button.open }}</th>
						<th>{{ capGen.name }}</th>
						<th>{{ capGen.id }}</th>
						<th>{{ capApp.policies }}</th>
						<th colspan="2">{{ capApp.retention }}</th>
						<th></th>
					</tr>
				</thead>
				
				<!-- new record -->
				<my-builder-relations-item
					:module-id="module.id"
				/>
				
				<!-- existing records -->
				<my-builder-relations-item
					v-for="rel in module.relations"
					:key="rel.id"
					:module-id="module.id"
					:relation="rel"
				/>
			</table>
		</div>
	</div>`,
	props:{
		id:{ type:String, required:true }
	},
	computed:{
		module:function() {
			if(typeof this.moduleIdMap[this.id] === 'undefined')
				return false;
			
			return this.moduleIdMap[this.id];
		},
		
		// stores
		moduleIdMap:function() { return this.$store.getters['schema/moduleIdMap']; },
		capApp:     function() { return this.$store.getters.captions.builder.relation; },
		capGen:     function() { return this.$store.getters.captions.generic; }
	}
};