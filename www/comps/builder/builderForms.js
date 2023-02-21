import {getDependentModules} from '../shared/builder.js';
import {srcBase64}           from '../shared/image.js';
export {MyBuilderForms as default};

let MyBuilderForms = {
	name:'my-builder-forms',
	template:`<div class="contentBox grow">
		
		<div class="top lower">
			<div class="area nowrap">
				<img class="icon" src="images/fileText.png" />
				<h1 class="title">{{ capApp.title }}</h1>
			</div>
			<div class="area default-inputs">
				<select v-model="copyFormId" @change="copySelected" :disabled="readonly">
					<option :value="null">{{ capApp.copy }}</option>
					<optgroup
						v-for="mod in getDependentModules(module,modules)"
						:label="mod.name"
					>
						<option v-for="f in mod.forms" :value="f.id">
							{{ f.name }}
						</option>
					</optgroup>
				</select>
				<input
					v-model="copyNewName"
					:disabled="readonly"
					:placeholder="capApp.copyNewName"
				/>
				<my-button image="save.png"
					@trigger="copy"
					:active="canCopy && !readonly"
				/>
			</div>
			
			<div class="area default-inputs">
				<input placeholder="..." v-model="filter" />
			</div>
		</div>
		
		<div class="content default-inputs" v-if="module">
			
			<div class="builder-entry-list">
				<div class="entry"
					v-if="!readonly"
					@click="$emit('createNew','form')"
					:class="{ clickable:!readonly }"
				>
					<div class="row gap centered">
						<img class="icon" src="images/add.png" />
						<span>{{ capGen.button.new }}</span>
					</div>
				</div>
				
				<router-link class="entry clickable"
					v-for="f in module.forms.filter(v => filter === '' || v.name.toLowerCase().includes(filter.toLowerCase()))"
					:key="f.id"
					:to="'/builder/form/'+f.id" 
				>
					<div class="lines">
						<span>{{ f.name }}</span>
						<span class="subtitle" v-if="typeof f.captions.formTitle[builderLanguage] !== 'undefined'">
							[{{ f.captions.formTitle[builderLanguage] }}]
						</span>
					</div>
					<my-button
						v-if="f.iconId !== null"
						:active="false"
						:captionTitle="capGen.icon"
						:imageBase64="srcBase64(iconIdMap[f.iconId].file)"
						:naked="true"
						:tight="true"
					/>
				</router-link>
			</div>
		</div>
	</div>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		id:             { type:String,  required:true },
		readonly:       { type:Boolean, required:true }
	},
	data() {
		return {
			copyFormId:null,
			copyNewName:'',
			filter:''
		};
	},
	computed:{
		// simple
		canCopy:(s) => s.copyFormId !== null && s.copyNewName !== '',
		module: (s) => s.moduleIdMap[s.id] === 'undefined' ? false : s.moduleIdMap[s.id],
		
		// stores
		modules:    (s) => s.$store.getters['schema/modules'],
		moduleIdMap:(s) => s.$store.getters['schema/moduleIdMap'],
		formIdMap:  (s) => s.$store.getters['schema/formIdMap'],
		iconIdMap:  (s) => s.$store.getters['schema/iconIdMap'],
		capApp:     (s) => s.$store.getters.captions.builder.form,
		capGen:     (s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getDependentModules,
		srcBase64,
		
		// actions
		copySelected() {
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
		copy() {
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