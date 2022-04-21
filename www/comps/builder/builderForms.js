import MyBuilderCaption      from './builderCaption.js';
import MyBuilderIconInput    from './builderIconInput.js';
import {getDependentModules} from '../shared/builder.js';
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
			<my-button image="open.png"
				v-if="!isNew"
				@trigger="open"
			/>
		</td>
		<td>
			<my-builder-icon-input
				@input="iconId = $event"
				:iconIdSelected="iconId"
				:module="moduleIdMap[moduleId]"
			/>
		</td>
		<td>
			<input class="long" v-model="name" :placeholder="isNew ? capApp.new : ''" />
		</td>
		<td>
			<my-button image="visible1.png"
				@trigger="showInfo"
				:active="!isNew"
			/>
		</td>
		<td>
			<my-builder-caption
				v-model="captions.formTitle"
				:language="builderLanguage"
			/>
		</td>
		<td>
			<select v-model="presetIdOpen">
				
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
		builderLanguage:{ type:String, required:true },
		moduleId:       { type:String, required:true },
		form:           { type:Object, required:false,
			default:function() { return{
				id:null,
				presetIdOpen:null,
				iconId:null,
				name:'',
				query:null,
				fields:[],
				functions:[],
				states:[],
				captions:{
					formTitle:{}
				}
			}}
		}
	},
	data:function() {
		return {
			captions:JSON.parse(JSON.stringify(this.form.captions)),
			name:this.form.name,
			presetIdOpen:this.form.presetIdOpen,
			iconId:this.form.iconId
		};
	},
	computed:{
		hasChanges:function() {
			return this.name !== this.form.name
				|| this.presetIdOpen !== this.form.presetIdOpen
				|| this.iconId !== this.form.iconId
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
		getQueryTemplate,
		
		// actions
		open:function() {
			this.$router.push('/builder/form/'+this.form.id);
		},
		showInfo:function() {
			this.$store.commit('dialog',{
				captionBody:this.form.id,
				captionTop:this.form.name,
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
			ws.send('form','del',{id:this.form.id},true).then(
				(res) => this.$root.schemaReload(this.moduleId),
				(err) => this.$root.genericError(err)
			);
		},
		set:function() {
			let form = JSON.parse(JSON.stringify(this.form));
			if(form.query === null)
				form.query = this.getQueryTemplate();
			
			// set overwritable values
			form.moduleId     = this.moduleId;
			form.presetIdOpen = this.presetIdOpen;
			form.iconId       = this.iconId;
			form.name         = this.name;
			form.captions     = this.captions;
			
			ws.send('form','set',form,true).then(
				res => {
					if(this.isNew) {
						this.name     = '';
						this.captions = {formTitle:{}};
					}
					this.$root.schemaReload(this.moduleId);
				},
				err => this.$root.genericError(err)
			);
		}
	}
};

let MyBuilderForms = {
	name:'my-builder-forms',
	components:{MyBuilderFormsItem},
	template:`<div class="contentBox grow">
		
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
						<th>{{ capGen.icon }}</th>
						<th>{{ capGen.name }}</th>
						<th>{{ capGen.id }}</th>
						<th>{{ capGen.title }}</th>
						<th>{{ capApp.presetOpen }}</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					<!-- new record -->
					<my-builder-forms-item
						:builder-language="builderLanguage"
						:module-id="module.id"
					/>
					
					<!-- existing records -->
					<my-builder-forms-item
						v-for="frm in module.forms"
						:builder-language="builderLanguage"
						:form="frm"
						:key="frm.id"
						:module-id="module.id"
					/>
				</tbody>
			</table>
			
			<!-- form copy -->
			<div class="builder-form-copy">
				<h2>{{ capApp.copy }}</h2>
				<table>
					<tr>
						<td>
							<select v-model="copyFormId" @change="copySelected">
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
								:placeholder="capApp.copyNewName"
							/>
						</td>
						<td>
							<my-button image="save.png"
								@trigger="copy"
								:active="canCopy"
							/>
						</td>
					</tr>
				</table>
			</div>
		</div>
	</div>`,
	props:{
		builderLanguage:{ type:String, required:true },
		id:             { type:String, required:true }
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
				(res) => {
					this.copyFormId  = null;
					this.copyNewName = '';
					this.$root.schemaReload(this.module.id);
				},
				(err) => this.$root.genericError(err)
			);
		}
	}
};