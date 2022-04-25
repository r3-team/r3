export {MyBuilderPgTrigger as default};

let MyBuilderPgTrigger = {
	name:'my-builder-pg-trigger',
	template:`<tr>
		<td>
			<select v-model="fires">
				<option value="BEFORE">BEFORE</option>
				<option value="AFTER">AFTER</option>
			</select>
		</td>
		<td class="minimum">
			<my-button image="visible1.png"
				@trigger="showInfo"
				:active="!isNew"
			/>
		</td>
		<td><my-bool v-model="onInsert" /></td>
		<td><my-bool v-model="onUpdate" /></td>
		<td><my-bool v-model="onDelete" /></td>
		<td><my-bool v-model="perRow" /></td>
		<td><my-bool v-model="isConstraint" :readonly="!constraintOk" /></td>
		<td><my-bool v-model="isDeferrable" :readonly="!constraintOk || !isConstraint" /></td>
		<td><my-bool v-model="isDeferred"   :readonly="!constraintOk || !isConstraint || !isDeferrable" /></td>
		<td><input v-model="codeCondition" /></td>
		<td>
			<my-button image="open.png"
				@trigger="open"
				:active="pgFunctionId !== null"
			/>
		</td>
		<td>
			<select v-model="pgFunctionId">
				<option
					v-for="fnc in module.pgFunctions.filter(v => v.codeReturns === 'trigger' || v.codeReturns === 'TRIGGER')"
					:value="fnc.id"
				>
					{{ fnc.name }}
				</option>
			</select>
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
	</tr>`,
	props:{
		pgTrigger:{
			type:Object,
			required:false,
			default:function() { return{
				id:null,
				relationId:null,
				pgFunctionId:null,
				fires:'BEFORE',
				onDelete:false,
				onInsert:true,
				onUpdate:false,
				isConstraint:false,
				isDeferrable:false,
				isDeferred:false,
				perRow:true,
				codeCondition:null
			}}
		},
		relation:{ type:Object, required:true }
	},
	data:function() {
		return {
			pgFunctionId:this.pgTrigger.pgFunctionId,
			fires:this.pgTrigger.fires,
			onDelete:this.pgTrigger.onDelete,
			onInsert:this.pgTrigger.onInsert,
			onUpdate:this.pgTrigger.onUpdate,
			isConstraint:this.pgTrigger.isConstraint,
			isDeferrable:this.pgTrigger.isDeferrable,
			isDeferred:this.pgTrigger.isDeferred,
			perRow:this.pgTrigger.perRow,
			codeCondition:this.pgTrigger.codeCondition
		};
	},
	computed:{
		hasChanges:function() {
			return this.pgFunctionId !== this.pgTrigger.pgFunctionId
				|| this.fires !== this.pgTrigger.fires
				|| this.onDelete !== this.pgTrigger.onDelete
				|| this.onInsert !== this.pgTrigger.onInsert
				|| this.onUpdate !== this.pgTrigger.onUpdate
				|| this.isConstraint !== this.pgTrigger.isConstraint
				|| this.isDeferrable !== this.pgTrigger.isDeferrable
				|| this.isDeferred !== this.pgTrigger.isDeferred
				|| this.perRow !== this.pgTrigger.perRow
				|| this.codeCondition !== this.pgTrigger.codeCondition
			;
		},
		
		// simple states
		constraintOk:function() { return this.fires === 'AFTER' && this.perRow; },
		isNew:       function() { return this.pgTrigger.id === null; },
		
		// stores
		module:     function() { return this.moduleIdMap[this.relation.moduleId]; },
		modules:    function() { return this.$store.getters['schema/modules']; },
		moduleIdMap:function() { return this.$store.getters['schema/moduleIdMap']; },
		capApp:     function() { return this.$store.getters.captions.builder.pgTrigger; },
		capGen:     function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		// actions
		open:function() {
			this.$router.push('/builder/pg-function/'+this.pgFunctionId);
		},
		showInfo:function() {
			this.$store.commit('dialog',{
				captionBody:this.pgTrigger.id,
				buttons:[{
					caption:this.capGen.button.cancel,
					image:'cancel.png'
				}]
			});
		},
		
		// backend calls
		delAsk:function() {
			this.$store.commit('dialog',{
				captionBody:this.capApp.dialog.delete,
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
			ws.send('pgTrigger','del',{id:this.pgTrigger.id},true).then(
				() => this.$root.schemaReload(this.module.id),
				this.$root.genericError
			);
		},
		set:function(atr) {
			// fix invalid options
			if(!this.perRow || this.fires !== 'AFTER') {
				this.isConstraint = false;
				this.isDeferrable = false;
				this.isDeferred   = false;
			} else if(!this.isConstraint) {
				this.isDeferrable = false;
				this.isDeferred   = false;
			} else if(!this.isDeferrable) {
				this.isDeferred   = false;
			}
			
			ws.send('pgTrigger','set',{
				id:this.pgTrigger.id,
				relationId:this.relation.id,
				pgFunctionId:this.pgFunctionId,
				fires:this.fires,
				onDelete:this.onDelete,
				onInsert:this.onInsert,
				onUpdate:this.onUpdate,
				isConstraint:this.isConstraint,
				isDeferrable:this.isDeferrable,
				isDeferred:this.isDeferred,
				perRow:this.perRow,
				codeCondition:this.codeCondition
			},true).then(
				() => {
					if(this.isNew) {
						this.codeCondition = '';
						this.pgFunctionId  = null;
					}
					this.$root.schemaReload(this.module.id);
				},
				this.$root.genericError
			);
		}
	}
};