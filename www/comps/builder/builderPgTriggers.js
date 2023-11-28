import {getDependentModules} from '../shared/builder.js';
import {copyValueDialog}     from '../shared/generic.js';
export {MyBuilderPgTriggers as default};

let MyBuilderPgTrigger = {
	name:'my-builder-pg-trigger',
	template:`<tr>
		<td>
			<div class="row gap">
				<my-button image="save.png"
					@trigger="set"
					:active="canSave"
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
			<div class="row gap">
				<select
					v-model="pgFunctionId"
					v-if="isContextRelation"
					:disabled="readonly"
				>
					<option :value="null">[{{ capGen.nothingSelected }}]</option>
					<option
						v-for="fnc in module.pgFunctions.filter(v => v.codeReturns === 'trigger' || v.codeReturns === 'TRIGGER')"
						:value="fnc.id"
					>
						{{ fnc.name }}
					</option>
				</select>
				<select
					v-model="relationId"
					v-if="isContextPgFunction"
					:disabled="readonly"
				>
					<option :value="null">-</option>
					<option v-for="rel in module.relations" :value="rel.id">
						{{ rel.name }}
					</option>
					<optgroup
						v-for="mod in getDependentModules(module,modules).filter(v => v.id !== module.id && v.relations.length !== 0)"
						:label="mod.name"
					>
						<option v-for="rel in mod.relations" :value="rel.id">
							{{ mod.name + ': ' + rel.name }}
						</option>
					</optgroup>
				</select>
				<my-button image="add.png"
					v-if="pgFunctionId === null"
					@trigger="$emit('createNew','pgFunction',{isTrigger:true})"
					:captionTitle="capGen.button.create"
				/>
				<my-button image="open.png"
					v-if="pgFunctionId !== null"
					@trigger="open"
					:captionTitle="capGen.button.open"
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
		pgFunctionIdContext:{ required:false, default:null }, // if trigger is assigned to a PG function
		readonly:           { type:Boolean, required:true },
		relationIdContext:  { required:false, default:null }  // if trigger is assigned to a relation
	},
	emits:['createNew'],
	data() {
		return {
			pgFunctionId:this.pgTrigger.pgFunctionId,
			relationId:this.pgTrigger.relationId,
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
			|| s.relationId    !== s.pgTrigger.relationId
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
		canSave:            (s) => s.hasChanges && !s.readonly && s.pgFunctionId !== null,
		constraintOk:       (s) => s.fires === 'AFTER' && s.perRow,
		isContextPgFunction:(s) => s.pgFunctionIdContext !== null,
		isContextRelation:  (s) => s.relationIdContext !== null,
		isNew:              (s) => s.pgTrigger.id === null,
		
		// stores
		module:         (s) => s.moduleIdMap[
			s.isContextPgFunction
				? s.pgFunctionIdMap[s.pgFunctionIdContext].moduleId
				: s.relationIdMap[s.relationIdContext].moduleId
		],
		modules:        (s) => s.$store.getters['schema/modules'],
		moduleIdMap:    (s) => s.$store.getters['schema/moduleIdMap'],
		pgFunctionIdMap:(s) => s.$store.getters['schema/pgFunctionIdMap'],
		relationIdMap:  (s) => s.$store.getters['schema/relationIdMap'],
		capApp:         (s) => s.$store.getters.captions.builder.pgTrigger,
		capGen:         (s) => s.$store.getters.captions.generic
	},
	mounted() {
		if(this.isContextPgFunction)
			this.pgFunctionId = this.pgFunctionIdContext;
		
		if(this.isContextRelation)
			this.relationId = this.relationIdContext;
	},
	methods:{
		// externals
		copyValueDialog,
		getDependentModules,
		
		// actions
		open() {
			if(this.isContextPgFunction)
				this.$router.push('/builder/relation/'+this.relationId);
			
			if(this.isContextRelation)
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
				relationId:this.relationId,
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


let MyBuilderPgTriggers = {
	name:'my-builder-pg-triggers',
	components:{ MyBuilderPgTrigger },
	template:`<table class="default-inputs">
		<thead>
			<tr>
				<th>{{ capGen.actions }}</th>
				<th>{{ capApp.execute }}</th>
				<th>{{ capApp.fires }}</th>
				<th>{{ capGen.id }}</th>
				<th>{{ capApp.onInsert }}</th>
				<th>{{ capApp.onUpdate }}</th>
				<th>{{ capApp.onDelete }}</th>
				<th>{{ capApp.perRow }}</th>
				<th>{{ capApp.isDeferred }}</th>
			</tr>
		</thead>
		<tbody>
			<!-- new record -->
			<my-builder-pg-trigger
				@createNew="(...args) => $emit('createNew',...args)"
				:pgFunctionIdContext="pgFunctionIdContext"
				:readonly="readonly"
				:relationIdContext="relationIdContext"
			/>
			
			<!-- existing records -->
			<my-builder-pg-trigger
				v-for="t in triggers"
				@createNew="(...args) => $emit('createNew',...args)"
				:key="t.id"
				:pgFunctionIdContext="pgFunctionIdContext"
				:readonly="readonly"
				:relationIdContext="relationIdContext"
				:pg-trigger="t"
			/>
		</tbody>
	</table>`,
	props:{
		pgFunctionIdContext:{ required:false, default:null }, // if trigger is assigned to a PG function
		readonly:           { type:Boolean, required:true },
		relationIdContext:  { required:false, default:null }, // if trigger is assigned to a relation
		triggers:           { type:Array,   required:true }
	},
	emits:['createNew'],
	computed:{
		// stores
		capApp:(s) => s.$store.getters.captions.builder.pgTrigger,
		capGen:(s) => s.$store.getters.captions.generic
	}
};