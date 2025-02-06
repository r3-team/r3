import {getDependentModules} from '../shared/builder.js';
import {copyValueDialog}     from '../shared/generic.js';
export {MyBuilderPgTrigger as default};

let MyBuilderPgTrigger = {
	name:'my-builder-pg-trigger',
	template:`<div class="app-sub-window under-header" @mousedown.self="$emit('close')">
		<div class="contentBox builder-pg-trigger float" v-if="values !== null">
			<div class="top">
				<div class="area nowrap">
					<img class="icon" src="images/databasePlay.png" />
					<h1 class="title">{{ isNew ? capApp.titleNew : capApp.title }}</h1>
				</div>
				<div class="area">
					<my-button image="cancel.png"
						@trigger="$emit('close')"
						:cancel="true"
					/>
				</div>
			</div>
			<div class="top lower">
				<div class="area">
					<my-button image="save.png"
						@trigger="set"
						:active="canSave && !isExternal"
						:caption="isNew ? capGen.button.create : capGen.button.save"
					/>
					<my-button image="refresh.png"
						@trigger="reset"
						:active="hasChanges"
						:caption="capGen.button.refresh"
					/>
					<my-button image="visible1.png"
						@trigger="copyValueDialog(values.name,id,id)"
						:active="!isNew"
						:caption="capGen.id"
					/>
					<my-button image="delete.png"
						v-if="!isNew"
						@trigger="delAsk"
						:active="!readonly && !isExternal"
						:cancel="true"
						:caption="capGen.button.delete"
					/>
				</div>
			</div>
			
			<div class="content default-inputs">
				<table class="generic-table-vertical">
					<tbody>
						<tr>
							<td>{{ capApp.execute }}*</td>
							<td>
								<div class="row gap centered">
									<select
										v-if="!isExternal"
										v-model="values.pgFunctionId"
										:disabled="readonly || isFromPgFunction"
									>
										<option :value="null">[{{ capGen.nothingSelected }}]</option>
										<option
											v-for="fnc in module.pgFunctions.filter(v => v.codeReturns === 'trigger' || v.codeReturns === 'TRIGGER')"
											:value="fnc.id"
										>{{ fnc.name }}()</option>
									</select>
									<input disabled="disabled"
										v-if="isExternal"
										:value="moduleIdMap[pgFunctionIdMap[values.pgFunctionId].moduleId].name + ': ' + pgFunctionIdMap[values.pgFunctionId].name + '()'"
									/>
									<my-button image="open.png"
										v-if="isFromRelation && values.pgFunctionId !== null"
										@trigger="open"
										:captionTitle="capGen.button.open"
									/>
								</div>
							</td>
						</tr>
						<tr>
							<td>{{ capGen.relation }}*</td>
							<td>
								<div class="row gap centered">
									<select
										v-model="values.relationId"
										:disabled="readonly || isFromRelation || isExternal || !isNew"
									>
										<option :value="null">-</option>
										<option v-for="rel in module.relations" :value="rel.id">
											{{ rel.name }}
										</option>
										<optgroup
											v-for="mod in getDependentModules(module).filter(v => v.id !== module.id && v.relations.length !== 0)"
											:label="mod.name"
										>
											<option v-for="rel in mod.relations" :value="rel.id">
												{{ mod.name + ': ' + rel.name }}
											</option>
										</optgroup>
									</select>
									<my-button image="open.png"
										v-if="isFromPgFunction && values.relationId !== null"
										@trigger="open"
										:captionTitle="capGen.button.open"
									/>
								</div>
							</td>
						</tr>
						<tr>
							<td>{{ capApp.fires }}</td>
							<td>
								<div class="row gap centered">
									<select v-model="values.fires" :disabled="readonly || isExternal">
										<option value="BEFORE">BEFORE</option>
										<option value="AFTER">AFTER</option>
									</select>
								</div>
							</td>
						</tr>
						<tr>
							<td>{{ capApp.onInsert }}</td>
							<td><my-bool v-model="values.onInsert" :readonly="readonly || isExternal" /></td>
						</tr>
						<tr>
							<td>{{ capApp.onUpdate }}</td>
							<td><my-bool v-model="values.onUpdate" :readonly="readonly || isExternal" /></td>
						</tr>
						<tr>
							<td>{{ capApp.onDelete }}</td>
							<td><my-bool v-model="values.onDelete" :readonly="readonly || isExternal" /></td>
						</tr>
						<tr>
							<td>{{ capApp.perRow }}</td>
							<td><my-bool v-model="values.perRow" :readonly="readonly || isExternal" /></td>
						</tr>
						<tr>
							<td>{{ capApp.isDeferred }}</td>
							<td>
								<my-bool
									@update:modelValue="setDeferred($event)"
									:readonly="!constraintOk || readonly || isExternal"
									:modelValue="values.isDeferred"
								/>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>`,
	props:{
		contextEntity:{ type:String,  required:true }, // relation / pgFunction
		contextId:    { type:String,  required:true }, // ID of relation or pgFunction
		id:           { required:true },
		readonly:     { type:Boolean, required:true }
	},
	emits:['close'],
	data() {
		return {
			values:null,
			valuesOrg:null
		};
	},
	computed:{
		// simple
		canSave:         (s) => s.values !== null && s.values.pgFunctionId !== null && s.values.relationId !== null && s.hasChanges,
		constraintOk:    (s) => s.values !== null && s.values.fires === 'AFTER' && s.values.perRow,
		hasChanges:      (s) => JSON.stringify(s.values) !== JSON.stringify(s.valuesOrg),
		isExternal:      (s) => s.isFromRelation && s.values.pgFunctionId !== null && s.module.id !== s.pgFunctionIdMap[s.values.pgFunctionId].moduleId,
		isFromPgFunction:(s) => s.contextEntity === 'pgFunction',
		isFromRelation:  (s) => s.contextEntity === 'relation',
		isNew:           (s) => s.id === null,
		
		// stores
		module:(s) => {
			if(s.isFromRelation)   return s.moduleIdMap[s.relationIdMap[s.contextId].moduleId];
			if(s.isFromPgFunction) return s.moduleIdMap[s.pgFunctionIdMap[s.contextId].moduleId];
			return false;
		},
		moduleIdMap:    (s) => s.$store.getters['schema/moduleIdMap'],
		pgFunctionIdMap:(s) => s.$store.getters['schema/pgFunctionIdMap'],
		relationIdMap:  (s) => s.$store.getters['schema/relationIdMap'],
		pgTriggerIdMap: (s) => s.$store.getters['schema/pgTriggerIdMap'],
		capApp:         (s) => s.$store.getters.captions.builder.pgTrigger,
		capGen:         (s) => s.$store.getters.captions.generic
	},
	mounted() {
		this.reset();
		window.addEventListener('keydown',this.handleHotkeys);
	},
	unmounted() {
		window.removeEventListener('keydown',this.handleHotkeys);
	},
	methods:{
		// externals
		copyValueDialog,
		getDependentModules,
		
		// actions
		handleHotkeys(e) {
			if(e.ctrlKey && e.key === 's' && this.canSave) {
				this.set();
				e.preventDefault();
			}
			if(e.key === 'Escape') {
				this.$emit('close');
				e.preventDefault();
			}
		},
		open() {
			if(this.isFromPgFunction)
				this.$router.push('/builder/relation/'+this.values.relationId);
			
			if(this.isFromRelation)
				this.$router.push('/builder/pg-function/'+this.values.pgFunctionId);
		},
		reset() {
			this.values = this.id !== null
				? JSON.parse(JSON.stringify(this.pgTriggerIdMap[this.id]))
				: {
					id:null,
					moduleId:this.module.id,
					relationId:this.isFromRelation ? this.contextId : null,
					pgFunctionId:this.isFromPgFunction ? this.contextId : null,
					fires:'BEFORE',
					onDelete:false,
					onInsert:true,
					onUpdate:false,
					isConstraint:false,
					isDeferrable:false,
					isDeferred:false,
					perRow:true,
					codeCondition:null
				};
			
			this.valuesOrg = JSON.parse(JSON.stringify(this.values));
		},
		setDeferred(state) {
			// abstract useless states into two options
			// either trigger is 'constraint+deferrable+initially' deferred or not all
			this.values.isConstraint = state;
			this.values.isDeferrable = state;
			this.values.isDeferred   = state;
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
			ws.send('pgTrigger','del',{id:this.id},true).then(
				() => {
					this.$root.schemaReload(this.module.id);
					this.$emit('close');
				},
				this.$root.genericError
			);
		},
		set() {
			// fix invalid options
			if(!this.values.perRow || this.values.fires !== 'AFTER') {
				this.values.isConstraint = false;
				this.values.isDeferrable = false;
				this.values.isDeferred   = false;
			} else if(!this.values.isConstraint) {
				this.values.isDeferrable = false;
				this.values.isDeferred   = false;
			} else if(!this.values.isDeferrable) {
				this.values.isDeferred   = false;
			}
			
			ws.send('pgTrigger','set',this.values,true).then(
				() => {
					this.$root.schemaReload(this.module.id);
					this.$emit('close');
				},
				this.$root.genericError
			);
		}
	}
};