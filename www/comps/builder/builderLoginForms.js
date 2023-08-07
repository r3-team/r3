import MyBuilderCaption from './builderCaption.js';
import {
	isAttributeInteger,
	isAttributeString
} from '../shared/attribute.js';
export {MyBuilderLoginForms as default};

let MyBuilderLoginFormsItem = {
	name:'my-builder-login-forms-item',
	components:{ MyBuilderCaption },
	template:`<tr>
		<td>
			<div class="row gap">
				<my-button image="save.png"
					@trigger="set"
					:active="hasChanges && formId !== null && attributeIdLogin !== null && attributeIdLookup !== null && name !== '' && !readonly"
					:caption="isNew ? capGen.button.create : ''"
					:captionTitle="isNew ? capGen.button.create : capGen.button.save"
				/>
				<my-button image="delete.png"
					v-if="!isNew"
					@trigger="del"
					:active="!readonly"
					:cancel="true"
					:captionTitle="capGen.button.delete"
				/>
			</div>
		</td>
		<td>
			<input class="long"
				v-model="name"
				:disabled="readonly"
				:placeholder="isNew ? capApp.newLoginForm : ''"
			/>
		</td>
		<td>
			<my-builder-caption
				v-model="captions.loginFormTitle"
				:language="builderLanguage"
				:readonly="readonly"
			/>
		</td>
		<td>
			<select v-model="attributeIdLogin" @change="attributeIdLookup = null" :disabled="readonly">
				<option :value="null">-</option>
				<option v-for="a in loginAttributeCandidates" :value="a.id">
					{{ relationIdMap[a.relationId].name + ': ' + a.name }}
				</option>
			</select>
		</td>
		<td>
			<select v-model="attributeIdLookup" :disabled="readonly">
				<option :value="null">-</option>
				<option v-for="a in lookupAttributeCandidates" :value="a.id">
					{{ relationIdMap[a.relationId].name + ': ' + a.name }}
				</option>
			</select>
		</td>
		<td>
			<select v-model="formId" :disabled="readonly">
				<option :value="null">-</option>
				<option v-for="f in module.forms" :value="f.id">
					{{ f.name }}
				</option>
			</select>
		</td>
	</tr>`,
	props:{
		builderLanguage:{ type:String, required:true },
		module:         { type:Object, required:true },
		loginForm:      { type:Object, required:false,
			default:function() { return{
				id:null,
				attributeIdLogin:null,
				attributeIdLookup:null,
				formId:null,
				name:'',
				captions:{
					loginFormTitle:{}
				}
			}}
		},
		readonly:{ type:Boolean, required:true }
	},
	data() {
		return {
			attributeIdLogin:this.loginForm.attributeIdLogin,
			attributeIdLookup:this.loginForm.attributeIdLookup,
			formId:this.loginForm.formId,
			name:this.loginForm.name,
			captions:JSON.parse(JSON.stringify(this.loginForm.captions))
		};
	},
	computed:{
		loginAttributeCandidates:(s) => {
			let atrs = [];
			for(let r of s.module.relations) {
				for(let a of r.attributes) {
					if(a.name !== 'id' && s.isAttributeInteger(a.content))
						atrs.push(a);
				}
			}
			return atrs;
		},
		lookupAttributeCandidates:(s) => {
			if(s.attributeIdLogin === null)
				return [];
			
			// get lookup attribute from same relation as login attribute
			let r = s.relationIdMap[s.attributeIdMap[s.attributeIdLogin].relationId];
			
			let atrs = [];
			for(let a of r.attributes) {
				if(s.isAttributeString(a.content))
					atrs.push(a);
			}
			return atrs;
		},
		hasChanges:(s) => s.name   !== s.loginForm.name
			|| s.attributeIdLogin  !== s.loginForm.attributeIdLogin
			|| s.attributeIdLookup !== s.loginForm.attributeIdLookup
			|| s.formId            !== s.loginForm.formId
			|| JSON.stringify(s.captions) !== JSON.stringify(s.loginForm.captions),
		
		// simple states
		isNew:(s) => s.loginForm.id === null,
		
		// stores
		moduleIdMap:   (s) => s.$store.getters['schema/moduleIdMap'],
		relationIdMap: (s) => s.$store.getters['schema/relationIdMap'],
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		capApp:        (s) => s.$store.getters.captions.builder.loginForm,
		capGen:        (s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		isAttributeInteger,
		isAttributeString,
		
		// actions
		del() {
			ws.send('loginForm','del',{id:this.loginForm.id},true).then(
				() => this.$root.schemaReload(this.module.id),
				this.$root.genericError
			);
		},
		set() {
			ws.send('loginForm','set',{
				id:this.loginForm.id,
				moduleId:this.module.id,
				formId:this.formId,
				attributeIdLogin:this.attributeIdLogin,
				attributeIdLookup:this.attributeIdLookup,
				name:this.name,
				captions:this.captions
			},true).then(
				() => {
					if(this.isNew) {
						this.attributeIdLogin  = null;
						this.attributeIdLookup = null;
						this.formId            = null;
						this.name              = '';
					}
					this.$root.schemaReload(this.module.id);
				},
				this.$root.genericError
			);
		}
	}
};

let MyBuilderLoginForms = {
	name:'my-builder-login-forms',
	components:{MyBuilderLoginFormsItem},
	template:`<div class="contentBox grow">
		
		<div class="top lower">
			<div class="area nowrap">
				<img class="icon" src="images/personCog.png" />
				<h1 class="title">{{ capApp.title }}</h1>
			</div>
		</div>
		
		<div class="content default-inputs" v-if="module">
			<table>
				<thead>
					<tr>
						<th>{{ capGen.actions }}</th>
						<th>{{ capGen.name }}</th>
						<th>{{ capGen.title }}</th>
						<th>{{ capApp.attributeLogin }}</th>
						<th>{{ capApp.attributeLookup }}</th>
						<th>{{ capApp.formOpen }}</th>
					</tr>
				</thead>
				<tbody>
					<!-- new record -->
					<my-builder-login-forms-item
						:builderLanguage="builderLanguage"
						:module="module"
						:readonly="readonly"
					/>
					
					<!-- existing records -->
					<my-builder-login-forms-item
						v-for="l in module.loginForms"
						:builderLanguage="builderLanguage"
						:loginForm="l"
						:key="l.id"
						:module="module"
						:readonly="readonly"
					/>
				</tbody>
			</table>
		</div>
	</div>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		id:             { type:String,  required:true },
		readonly:       { type:Boolean, required:true }
	},
	computed:{
		module:(s) => typeof s.moduleIdMap[s.id] === 'undefined' ? false : s.moduleIdMap[s.id],
		
		// stores
		moduleIdMap:(s) => s.$store.getters['schema/moduleIdMap'],
		formIdMap:  (s) => s.$store.getters['schema/formIdMap'],
		capApp:     (s) => s.$store.getters.captions.builder.loginForm,
		capGen:     (s) => s.$store.getters.captions.generic
	}
};