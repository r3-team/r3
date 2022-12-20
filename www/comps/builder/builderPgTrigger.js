import {copyValueDialog} from '../shared/generic.js';
export {MyBuilderPgTrigger as default};

let MyBuilderPgTrigger = {
	name:'my-builder-pg-trigger',
	template:`<tr>
		<td>
			<div class="row">
				<my-button image="save.png"
					@trigger="set"
					:active="hasChanges && !readonly"
					:caption="isNew ? capGen.button.create : ''"
					:captionTitle="isNew ? capGen.button.create : capGen.button.save"
				/>
				<my-button image="delete.png"
					v-if="!isNew"
					@trigger="delAsk"
					:active="!readonly"
					:cancel="true"
					:captionTitle="capGen.button.delete"
				/>
			</div>
		</td>
		<td>
			<select v-model="fires" :disabled="readonly">
				<option value="BEFORE">BEFORE</option>
				<option value="AFTER">AFTER</option>
			</select>
		</td>
		<td class="minimum">
			<my-button image="visible1.png"
				@trigger="copyValueDialog('',pgTrigger.id,pgTrigger.id)"
				:active="!isNew"
			/>
		</td>
		<td><my-bool v-model="onInsert" :readonly="readonly" /></td>
		<td><my-bool v-model="onUpdate" :readonly="readonly" /></td>
		<td><my-bool v-model="onDelete" :readonly="readonly" /></td>
		<td><my-bool v-model="perRow"   :readonly="readonly" /></td>
		<td>
			<my-bool
				@update:modelValue="setDeferred($event)"
				:readonly="!constraintOk || readonly"
				:modelValue="isDeferred"
			/>
		</td>
		<td>
			<div class="row">
				<my-button image="open.png"
					@trigger="open"
					:active="pgFunctionId !== null"
				/>
				<select v-model="pgFunctionId" :disabled="readonly">
					<option
						v-for="fnc in module.pgFunctions.filter(v => v.codeReturns === 'trigger' || v.codeReturns === 'TRIGGER')"
						:value="fnc.id"
					>
						{{ fnc.name }}
					</option>
				</select>
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
		readonly:{ type:Boolean, required:true },
		relation:{ type:Object,  required:true }
	},
	data() {
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
		hasChanges:(s) =>
			s.pgFunctionId     !== s.pgTrigger.pgFunctionId
			|| s.fires         !== s.pgTrigger.fires
			|| s.onDelete      !== s.pgTrigger.onDelete
			|| s.onInsert      !== s.pgTrigger.onInsert
			|| s.onUpdate      !== s.pgTrigger.onUpdate
			|| s.isConstraint  !== s.pgTrigger.isConstraint
			|| s.isDeferrable  !== s.pgTrigger.isDeferrable
			|| s.isDeferred    !== s.pgTrigger.isDeferred
			|| s.perRow        !== s.pgTrigger.perRow
			|| s.codeCondition !== s.pgTrigger.codeCondition,
		
		// simple
		constraintOk:(s) => s.fires === 'AFTER' && s.perRow,
		isNew:       (s) => s.pgTrigger.id === null,
		
		// stores
		module:     (s) => s.moduleIdMap[s.relation.moduleId],
		modules:    (s) => s.$store.getters['schema/modules'],
		moduleIdMap:(s) => s.$store.getters['schema/moduleIdMap'],
		capApp:     (s) => s.$store.getters.captions.builder.pgTrigger,
		capGen:     (s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		copyValueDialog,
		
		// actions
		open() {
			this.$router.push('/builder/pg-function/'+this.pgFunctionId);
		},
		setDeferred(state) {
			// abstract unuseful states into two options
			// either trigger is 'constraint+deferrable+initially' deferred or not all
			this.isConstraint = state;
			this.isDeferrable = state;
			this.isDeferred   = state;
		},
		
		// backend calls
		delAsk() {
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
		del() {
			ws.send('pgTrigger','del',{id:this.pgTrigger.id},true).then(
				() => this.$root.schemaReload(this.module.id),
				this.$root.genericError
			);
		},
		set(atr) {
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