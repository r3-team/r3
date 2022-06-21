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
			<input class="long" v-model="name" :placeholder="isNew ? capApp.newLoginForm : ''" />
		</td>
		<td>
			<my-builder-caption
				v-model="captions.loginFormTitle"
				:language="builderLanguage"
			/>
		</td>
		<td>
			<select v-model="attributeIdLogin" @change="attributeIdLookup = null">
				<option :value="null">-</option>
				<option v-for="a in loginAttributeCandidates" :value="a.id">
					{{ relationIdMap[a.relationId].name + ': ' + a.name }}
				</option>
			</select>
		</td>
		<td>
			<select v-model="attributeIdLookup">
				<option :value="null">-</option>
				<option v-for="a in lookupAttributeCandidates" :value="a.id">
					{{ relationIdMap[a.relationId].name + ': ' + a.name }}
				</option>
			</select>
		</td>
		<td>
			<select v-model="formId">
				<option :value="null">-</option>
				<option v-for="f in module.forms" :value="f.id">
					{{ f.name }}
				</option>
			</select>
		</td>
		<td>
			<div class="row">
				<my-button image="save.png"
					@trigger="set"
					:active="hasChanges && formId !== null && attributeIdLogin !== null && attributeIdLookup !== null && name !== ''"
				/>
				<my-button image="delete.png"
					v-if="!isNew"
					@trigger="del"
					:cancel="true"
				/>
			</div>
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
		}
	},
	data:function() {
		return {
			attributeIdLogin:this.loginForm.attributeIdLogin,
			attributeIdLookup:this.loginForm.attributeIdLookup,
			formId:this.loginForm.formId,
			name:this.loginForm.name,
			captions:JSON.parse(JSON.stringify(this.loginForm.captions))
		};
	},
	computed:{
		loginAttributeCandidates:function() {
			let atrs = [];
			for(let i = 0, j = this.module.relations.length; i < j; i++) {
				let r = this.module.relations[i];
				
				for(let x = 0, y = r.attributes.length; x < y; x++) {
					let a = r.attributes[x];
					
					if(a.name !== 'id' && this.isAttributeInteger(a.content))
						atrs.push(a);
				}
			}
			return atrs;
		},
		lookupAttributeCandidates:function() {
			if(this.attributeIdLogin === null)
				return [];
			
			// get lookup attribute from same relation as login attribute
			let r = this.relationIdMap[this.attributeIdMap[this.attributeIdLogin].relationId];
			
			let atrs = [];
			for(let i = 0, j = r.attributes.length; i < j; i++) {
				let a = r.attributes[i];
				
				if(this.isAttributeString(a.content))
					atrs.push(a);
			}
			return atrs;
		},
		hasChanges:function() {
			return this.name              !== this.loginForm.name
				|| this.attributeIdLogin  !== this.loginForm.attributeIdLogin
				|| this.attributeIdLookup !== this.loginForm.attributeIdLookup
				|| this.formId            !== this.loginForm.formId
				|| JSON.stringify(this.captions) !== JSON.stringify(this.loginForm.captions)
			;
		},
		
		// simple states
		isNew:function() { return this.loginForm.id === null; },
		
		// stores
		moduleIdMap:   function() { return this.$store.getters['schema/moduleIdMap']; },
		relationIdMap: function() { return this.$store.getters['schema/relationIdMap']; },
		attributeIdMap:function() { return this.$store.getters['schema/attributeIdMap']; },
		capApp:        function() { return this.$store.getters.captions.builder.loginForm; }
	},
	methods:{
		// externals
		isAttributeInteger,
		isAttributeString,
		
		// actions
		del:function() {
			ws.send('loginForm','del',{id:this.loginForm.id},true).then(
				() => this.$root.schemaReload(this.module.id),
				this.$root.genericError
			);
		},
		set:function() {
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
				<h1 class="title">{{ capApp.title }}</h1>
			</div>
		</div>
		
		<div class="content default-inputs" v-if="module">
			<table>
				<thead>
					<tr>
						<th>{{ capGen.name }}</th>
						<th>{{ capGen.title }}</th>
						<th>{{ capApp.attributeLogin }}</th>
						<th>{{ capApp.attributeLookup }}</th>
						<th>{{ capApp.formOpen }}</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					<!-- new record -->
					<my-builder-login-forms-item
						:builderLanguage="builderLanguage"
						:module="module"
					/>
					
					<!-- existing records -->
					<my-builder-login-forms-item
						v-for="l in module.loginForms"
						:builderLanguage="builderLanguage"
						:loginForm="l"
						:key="l.id"
						:module="module"
					/>
				</tbody>
			</table>
		</div>
	</div>`,
	props:{
		builderLanguage:{ type:String, required:true },
		id:             { type:String, required:true }
	},
	computed:{
		module:function() {
			if(typeof this.moduleIdMap[this.id] === 'undefined')
				return false;
			
			return this.moduleIdMap[this.id];
		},
		
		// stores
		moduleIdMap:function() { return this.$store.getters['schema/moduleIdMap']; },
		formIdMap:  function() { return this.$store.getters['schema/formIdMap']; },
		capApp:     function() { return this.$store.getters.captions.builder.loginForm; },
		capGen:     function() { return this.$store.getters.captions.generic; }
	}
};