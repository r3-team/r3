import MyBuilderCaption      from './builderCaption.js';
import MyBuilderIconInput    from './builderIconInput.js';
import {getDependentModules} from '../shared/builder.js';
import {copyValueDialog}     from '../shared/generic.js';
import {getQueryTemplate}    from '../shared/query.js';
export {MyBuilderForms as default};

let MyBuilderFormsItem = {
	name:'my-builder-forms-item',
	components:{
		MyBuilderCaption,
		MyBuilderIconInput
	},
	template:`<tr>
		<td>
			<div class="row">
				<my-button image="save.png"
					@trigger="set"
					:active="hasChanges && !readonly"
					:caption="isNew ? capGen.button.create : ''"
					:captionTitle="isNew ? capGen.button.create : capGen.button.save"
				/>
				<my-button image="open.png"
					v-if="!isNew"
					@trigger="open"
					:captionTitle="capGen.button.open"
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
			<my-builder-icon-input
				@input="iconId = $event"
				:iconIdSelected="iconId"
				:module="moduleIdMap[moduleId]"
				:readonly="readonly"
			/>
		</td>
		<td>
			<input class="long"
				v-model="name"
				:disabled="readonly"
				:placeholder="isNew ? capApp.new : ''"
			/>
		</td>
		<td>
			<my-button image="visible1.png"
				@trigger="copyValueDialog(form.name,form.id,form.id)"
				:active="!isNew"
			/>
		</td>
		<td>
			<my-builder-caption
				v-model="captions.formTitle"
				:language="builderLanguage"
				:readonly="readonly"
			/>
		</td>
		<td>
			<my-bool v-model="noDataActions" :readonly="readonly" />
		</td>
		<td>
			<select v-model="presetIdOpen" :disabled="readonly">
				
				<option :value="null" v-if="presetCandidates.length === 0">
					{{ capGen.nothingThere }}
				</option>
				<option :value="null" v-if="presetCandidates.length !== 0">
					{{ capGen.nothingSelected }}
				</option>
				
				<option
					v-for="p in presetCandidates"
					:key="p.id"
					:value="p.id"
				>
					{{ p.name }}
				</option>
			</select>
		</td>
	</tr>`,
	props:{
		builderLanguage:{ type:String, required:true },
		moduleId:       { type:String, required:true },
		form:           { type:Object, required:false,
			default:function() { return{
				id:null,
				presetIdOpen:null,
				iconId:null,
				name:'',
				noDataActions:false,
				query:null,
				fields:[],
				functions:[],
				states:[],
				articleIdsHelp:[],
				captions:{
					formTitle:{}
				}
			}}
		},
		readonly:{ type:Boolean, required:true }
	},
	data:function() {
		return {
			captions:JSON.parse(JSON.stringify(this.form.captions)),
			name:this.form.name,
			noDataActions:this.form.noDataActions,
			presetIdOpen:this.form.presetIdOpen,
			iconId:this.form.iconId
		};
	},
	computed:{
		hasChanges:function() {
			return this.name          !== this.form.name
				|| this.noDataActions !== this.form.noDataActions
				|| this.presetIdOpen  !== this.form.presetIdOpen
				|| this.iconId        !== this.form.iconId
				|| JSON.stringify(this.captions) !== JSON.stringify(this.form.captions)
			;
		},
		presetCandidates:function() {
			return this.isNew || !this.isQueryActive
				? [] : this.relationIdMap[this.form.query.relationId].presets;
		},
		
		// simple states
		isQueryActive:function() { return !this.isNew && this.form.query.relationId !== null; },
		isNew:        function() { return this.form.id === null; },
		
		// stores
		moduleIdMap:  function() { return this.$store.getters['schema/moduleIdMap']; },
		relationIdMap:function() { return this.$store.getters['schema/relationIdMap']; },
		capApp:       function() { return this.$store.getters.captions.builder.form; },
		capGen:       function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		// externals
		copyValueDialog,
		getQueryTemplate,
		
		// actions
		open:function() {
			this.$router.push('/builder/form/'+this.form.id);
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
			ws.send('form','del',{id:this.form.id},true).then(
				() => this.$root.schemaReload(this.moduleId),
				this.$root.genericError
			);
		},
		set:function() {
			let form = JSON.parse(JSON.stringify(this.form));
			if(form.query === null)
				form.query = this.getQueryTemplate();
			
			// set overwritable values
			form.moduleId      = this.moduleId;
			form.presetIdOpen  = this.presetIdOpen;
			form.iconId        = this.iconId;
			form.name          = this.name;
			form.noDataActions = this.noDataActions;
			form.captions      = this.captions;
			
			ws.send('form','set',form,true).then(
				() => {
					if(this.isNew) {
						this.name     = '';
						this.captions = {formTitle:{}};
					}
					this.$root.schemaReload(this.moduleId);
				},
				this.$root.genericError
			);
		}
	}
};

let MyBuilderForms = {
	name:'my-builder-forms',
	components:{MyBuilderFormsItem},
	template:`<div class="contentBox grow">
		
		<div class="top lower">
			<div class="area nowrap">
				<h1 class="title">{{ capApp.title }}</h1>
			</div>
		</div>
		
		<div class="content default-inputs" v-if="module">
			<table>
				<thead>
					<tr>
						<th>{{ capGen.actions }}</th>
						<th>{{ capGen.icon }}</th>
						<th>{{ capGen.name }}</th>
						<th>{{ capGen.id }}</th>
						<th>{{ capGen.title }}</th>
						<th>{{ capApp.noDataActions }}</th>
						<th>{{ capApp.presetOpen }}</th>
					</tr>
				</thead>
				<tbody>
					<!-- new record -->
					<my-builder-forms-item
						:builder-language="builderLanguage"
						:module-id="module.id"
						:readonly="readonly"
					/>
					
					<!-- existing records -->
					<my-builder-forms-item
						v-for="frm in module.forms"
						:builder-language="builderLanguage"
						:form="frm"
						:key="frm.id"
						:module-id="module.id"
						:readonly="readonly"
					/>
				</tbody>
			</table>
			
			<!-- form copy -->
			<div class="builder-form-copy">
				<h2>{{ capApp.copy }}</h2>
				<table>
					<tr>
						<td>
							<select v-model="copyFormId" @change="copySelected" :disabled="readonly">
								<option :value="null">{{ capApp.copyForm }}</option>
								<optgroup
									v-for="mod in getDependentModules(module,modules)"
									:label="mod.name"
								>
									<option v-for="f in mod.forms" :value="f.id">
										{{ f.name }}
									</option>
								</optgroup>
							</select>
						</td>
						<td>
							<input
								v-model="copyNewName"
								:disabled="readonly"
								:placeholder="capApp.copyNewName"
							/>
						</td>
						<td>
							<my-button image="save.png"
								@trigger="copy"
								:active="canCopy && !readonly"
							/>
						</td>
					</tr>
				</table>
			</div>
		</div>
	</div>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		id:             { type:String,  required:true },
		readonly:       { type:Boolean, required:true }
	},
	data:function() {
		return {
			copyFormId:null,
			copyNewName:''
		};
	},
	computed:{
		module:function() {
			if(typeof this.moduleIdMap[this.id] === 'undefined')
				return false;
			
			return this.moduleIdMap[this.id];
		},
		canCopy:function() {
			return this.copyFormId !== null && this.copyNewName !== '';
		},
		
		// stores
		modules:    function() { return this.$store.getters['schema/modules']; },
		moduleIdMap:function() { return this.$store.getters['schema/moduleIdMap']; },
		formIdMap:  function() { return this.$store.getters['schema/formIdMap']; },
		capApp:     function() { return this.$store.getters.captions.builder.form; },
		capGen:     function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		// externals
		getDependentModules,
		
		// actions
		copySelected:function() {
			if(this.copyFormId === null)
				return;
			
			let form = this.formIdMap[this.copyFormId];
			let name = `${form.name}_`;
			
			// check if name is free in this module
			for(let i = 1; i < 10; i++) {
				
				if(typeof this.module.formNameMap[name+i] === 'undefined') {
					this.copyNewName = name+i;
					break;
				}
			}
		},
		copy:function() {
			ws.send('form','copy',{
				id:this.copyFormId,
				moduleId:this.module.id,
				newName:this.copyNewName
			},true).then(
				() => {
					this.copyFormId  = null;
					this.copyNewName = '';
					this.$root.schemaReload(this.module.id);
				},
				this.$root.genericError
			);
		}
	}
};