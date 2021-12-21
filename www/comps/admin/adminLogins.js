import srcBase64Icon          from '../shared/image.js';
import MyInputOffset          from '../inputOffset.js';
import MyInputSelect          from '../inputSelect.js';
import MyForm                 from '../form.js';
import {
	getCaptionForModule,
	getValidLanguageCode
} from '../shared/language.js';
export {MyAdminLogins as default};

let MyAdminLoginsItem = {
	name:'my-admin-logins-item',
	components:{MyInputSelect},
	template:`<tbody>
		<tr class="default-inputs">
			<td>
				<input class="long"
					v-model="name"
					:disabled="ldapId !== null"
					:placeholder="isNew ? capApp.newLogin : ''"
				/>
			</td>
			<td>
				<my-bool
					v-model="noAuth"
					:readonly="!isNew && ldapId !== null"
				/>
			</td>
			<td>
				<select v-if="ldapId !== null" v-model="ldapId" disabled="disabled">
					<option :value="l.id" v-for="l in ldaps">LDAP: {{ l.name }}</option>
				</select>
				
				<input type="password"
					v-if="ldapId === null"
					v-model="pass"
					:disabled="noAuth"
					:placeholder="!noAuth ? capApp.passwordHint : capApp.passwordHintNoAuth"
				/>
			</td>
			<td>
				<my-button
					@trigger="showRoles = !showRoles"
					:active="anyRoles && !isLdapAssignedRoles"
					:caption="String(roleTotalNonHidden)"
					:captionTitle="!isLdapAssignedRoles ? '' : capApp.ldapAssignActive"
					:image="showRoles ? 'triangleDown.png' : 'triangleRight.png'"
				/>
			</td>
			<td>
				<select class="short" v-model="languageCode">
					<option
						v-for="l in languageCodes"
						:value="l"
					>{{ l }}</option>
				</select>
			</td>
			<td><my-bool v-model="admin" /></td>
			<td><my-bool v-model="active" /></td>
			<td><input class="short" disabled="disabled" :value="id" /></td>
			<td>
				<div class="row">
					<my-button image="save.png"
						@trigger="set"
						:active="hasChanges"
						:captionTitle="capGen.button.save"
					/>
					<my-button image="delete.png"
						v-if="!isNew"
						@trigger="delAsk"
						:cancel="true"
						:captionTitle="capGen.button.delete"
					/>
				</div>
			</td>
			<td></td>
			<td class="left-border" v-for="(lf,lfi) in loginForms">
				<div class="login-record" v-if="!isNew && !loginFormsHidden.includes(lfi)">
					<my-button
						@trigger="openLoginForm(lfi)"
						:captionTitle="login.records[lfi].id !== null ? capGen.button.edit : capGen.button.create"
						:image="login.records[lfi].id ? 'open.png' : 'add.png'"
					/>
					
					<div class="login-record-input">
					
						<input disabled="disabled"
							v-if="login.records[lfi].id !== null"
							:value="login.records[lfi].label"
						/>
						<my-input-select
							v-if="login.records[lfi].id === null"
							@request-data="getRecords(lfi)"
							@updated-text-input="loginRecordInput = $event"
							@update:selected="$emit('set-record',lfi,login.id,$event)"
							:nakedIcons="false"
							:options="loginRecordList"
							:placeholder="capApp.recordSelectHint"
						/>
						<my-button image="cancel.png"
							v-if="login.records[lfi].id !== null"
							@trigger="$emit('set-record',lfi,null,login.records[lfi].id)"
							:cancel="true"
						/>
					</div>
				</div>
			</td>
		</tr>
		
		<tr v-if="showRoles" class="default-inputs">
			<td colspan="999">
				<div class="role-select shade">
					<table class="table-default">
						<thead>
							<tr>
								<th>
									<div class="row">
										<my-button image="save.png"
											@trigger="set"
											:active="hasChanges"
											:caption="capGen.button.save"
										/>
										<my-button image="cancel.png"
											@trigger="showRoles = false"
											:cancel="true"
											:caption="capGen.button.close"
										/>
									</div>
								</th>
								<th>{{ capApp.roles }}</th>
								<th class="minimum"><input v-model="filter" placeholder="..." /></th>
							</tr>
						</thead>
						<tbody>
							<tr
								v-for="m in modules.filter(v => getCaptionForModule(v.captions['moduleTitle'],v.name,v).includes(filter))"
								:class="{ grouping:m.parentId === null }"
								:key="m.id"
							>
								<td class="minimum">
									<div class="row centered">
										<my-button image="dash.png"
											v-if="m.parentId !== null"
											:active="false"
											:naked="true"
										/>
										<img class="module-icon"
											:src="srcBase64Icon(m.iconId,'images/module.png')"
										/>
										<span>
											{{ getCaptionForModule(m.captions['moduleTitle'],m.name,m) }}
										</span>
									</div>
								</td>
								<td class="module-roles" colspan="2" v-if="!m.hidden">
									<div
										v-for="r in m.roles.filter(v => v.assignable && v.name !== 'everyone')"
										:key="r.id"
									>
										<my-button
											@trigger="toggleRoleId(r.id)"
											:caption="getCaptionForModule(r.captions['roleTitle'],r.name,m)"
											:captionTitle="getCaptionForModule(r.captions['roleDesc'],'',m)"
											:image="roleIds.includes(r.id) ? 'checkbox1.png' : 'checkbox0.png'"
											:naked="true"
										/>
									</div>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</td>
		</tr>
	</tbody>`,
	props:{
		ldaps:{ type:Array, required:true },
		login:{
			type:Object,
			required:false,
			default:function() { return{
				id:0,
				ldapId:null,
				ldapKey:null,
				name:'',
				languageCode:'',
				active:true,
				admin:false,
				noAuth:false,
				records:[],
				roleIds:[]
			}}
		},
		loginForms:      { type:Array, required:true },
		loginFormsHidden:{ type:Array, required:true }
	},
	watch:{
		login:{
			handler:function(){
				this.id      = this.login.id;
				this.ldapId  = this.login.ldapId;
				this.ldapKey = this.login.ldapKey;
				this.name    = this.login.name;
				this.languageCode = this.login.languageCode;
				this.active  = this.login.active;
				this.admin   = this.login.admin;
				this.noAuth  = this.login.noAuth;
				this.roleIds = JSON.parse(JSON.stringify(this.login.roleIds));
				this.pass    = '';
			},
			immediate:true
		}
	},
	emits:['open-login-form','set-record','updated'],
	data:function() {
		return {
			id:0,
			ldapId:null,
			ldapKey:null,
			name:'',
			languageCode:'',
			active:false,
			admin:false,
			noAuth:false,
			roleIds:[],
			pass:'',
			
			// states
			filter:'',
			loginRecordInput:'',
			loginRecordList:[],
			showRoles:false
		};
	},
	mounted:function() {
		if(this.languageCode === '')
			this.languageCode = this.config.defaultLanguageCode;
	},
	computed:{
		anyRoles:function() {
			for(let i = 0, j = this.modules.length; i < j; i++) {
				if(this.modules[i].roles.length !== 1)
					return true;
			}
			return false;
		},
		isLdapAssignedRoles:function() {
			if(this.ldapId === null)
				return false;
			
			for(let i = 0, j = this.ldaps.length; i < j; i++) {
				if(this.ldaps[i].id === this.ldapId)
					return this.ldaps[i].assignRoles;
			}
			return false;
		},
		hasChanges:function() {
			return this.name !== this.login.name
				|| (!this.isNew && this.languageCode !== this.login.languageCode)
				|| this.active !== this.login.active
				|| this.admin !== this.login.admin
				|| this.noAuth !== this.login.noAuth
				|| this.pass !== ''
				|| JSON.stringify(this.roleIds) !== JSON.stringify(this.login.roleIds)
			;
		},
		roleTotalNonHidden:function() {
			let cnt = 0;
			for(let i = 0, j = this.roleIds.length; i < j; i++) {
				if(!this.moduleIdMap[this.roleIdMap[this.roleIds[i]].moduleId].hidden)
					cnt++
			}
			return cnt;
		},
		
		// simple states
		isNew:function() { return this.login.id === 0; },
		
		// stores
		languageCodes:function() { return this.$store.getters['schema/languageCodes']; },
		modules:      function() { return this.$store.getters['schema/modules']; },
		moduleIdMap:  function() { return this.$store.getters['schema/moduleIdMap']; },
		formIdMap:    function() { return this.$store.getters['schema/formIdMap']; },
		roleIdMap:    function() { return this.$store.getters['schema/roleIdMap']; },
		backendCodes: function() { return this.$store.getters.constants.backendCodes; },
		capApp:       function() { return this.$store.getters.captions.admin.login; },
		capGen:       function() { return this.$store.getters.captions.generic; },
		config:       function() { return this.$store.getters.config; }
	},
	methods:{
		// externals
		getCaptionForModule,
		getValidLanguageCode,
		srcBase64Icon,
		
		handleError:function(requests,message) {
			
			if(message.startsWith(this.backendCodes.errKnown)) {
				
				// unique constraint violation
				let matches = message.match(/ERROR\: duplicate key value violates unique constraint \".*\"/);
				if(matches !== null && matches.length === 1)
					message = this.capApp.error.uniqueConstraint;
			}
			
			// display message with default error handler
			this.$root.genericError(null,message);
		},
		openLoginForm:function(index) {
			let frm = this.formIdMap[this.loginForms[index].formId];
			let mod = this.moduleIdMap[frm.moduleId];
			
			this.$store.commit('moduleLanguage',this.getValidLanguageCode(mod));
			this.$emit('open-login-form',index,this.id,this.login.records[index].id);
		},
		toggleRoleId:function(roleId) {
			let pos = this.roleIds.indexOf(roleId);
			
			if(pos === -1)
				this.roleIds.push(roleId);
			else if(pos !== -1)
				this.roleIds.splice(pos,1);
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
			let trans = new wsHub.transactionBlocking();
			trans.add('login','del',{id:this.login.id},this.delOk);
			trans.send(this.handleError);
		},
		delOk:function(res,req) {
			this.$emit('updated');
			
			let trans = new wsHub.transaction();
			trans.add('login','kick',{id:req.payload.id});
			trans.send(this.handleError);
		},
		set:function() {
			let trans = new wsHub.transactionBlocking();
			trans.add('login','set',{
				id:this.login.id,
				ldapId:this.login.ldapId,
				ldapKey:this.login.ldapKey,
				name:this.name,
				pass:this.pass,
				languageCode:this.languageCode,
				active:this.active,
				admin:this.admin,
				noAuth:this.noAuth,
				roleIds:this.roleIds
			},this.setOk);
			trans.send(this.handleError);
		},
		setOk:function(res,req) {
			if(this.isNew) {
				this.name      = '';
				this.showRoles = false;
			}
			
			this.pass = '';
			this.$emit('updated');
			
			// login was changed, reauth. or kick client
			if(req.payload.id !== 0) {
				let trans = new wsHub.transaction();
				
				if(req.payload.active)
					trans.add('login','reauth',{id:req.payload.id});
				else
					trans.add('login','kick',{id:req.payload.id});
				
				trans.send(this.handleError);
			}
		},
		
		// record calls
		getRecords:function(loginFormIndex) {
			let loginForm  = this.loginForms[loginFormIndex];
			let excludeIds = [];
			
			if(this.login.records[loginFormIndex].id !== null)
				excludeIds.push(this.login.records[loginFormIndex].id);
			
			let trans = new wsHub.transactionBlocking();
			trans.add('login','getRecords',{
				attributeIdLookup:loginForm.attributeIdLookup,
				byString:this.loginRecordInput,
				idsExclude:excludeIds
			},this.getRecordsOk);
			trans.send(this.$root.genericError);
		},
		getRecordsOk:function(res) {
			this.loginRecordList = res.payload;
		}
	}
};

let MyAdminLogins = {
	name:'my-admin-logins',
	components:{
		MyAdminLoginsItem,
		MyForm,
		MyInputOffset
	},
	template:`<div class="admin-logins contentBox grow">
		
		<div class="top">
			<div class="area">
				<img class="icon" src="images/admin.png" />
				<h1>{{ menuTitle }}</h1>
			</div>
		</div>
		<div class="top lower">
			<div class="area">
				<my-button image="refresh.png"
					@trigger="get"
					:caption="capGen.button.refresh"
					:darkBg="true"
				/>
			</div>
			<div class="area default-inputs">
				<my-input-offset class-input="selector"
					@input="offsetSet"
					:caption="true"
					:darkBg="true"
					:limit="limit"
					:offset="offset"
					:total="total"
				/>
			</div>
			<div class="area nowrap default-inputs">
				<my-button
					@trigger="limitSet(20)"
					:caption="capGen.limit"
					:darkBg="true"
					:naked="true"
				/>
				<select class="short selector"
					@change="limitSet($event.target.value)"
					:value="limit"
				>
					<option :value="20">{{ 20 }}</option>
					<option :value="30">{{ 30 }}</option>
					<option :value="50">{{ 50 }}</option>
					<option :value="100">{{ 100 }}</option>
					<option :value="200">{{ 200 }}</option>
					<option :value="500">{{ 500 }}</option>
				</select>
				<input class="selector"
					v-model="byString"
					@keyup.enter.space="byStringSet"
					:placeholder="capGen.username"
				/>
			</div>
		</div>
		
		<div class="content no-padding grow">
			<table class="table-default">
				<thead>
					<tr>
						<th>
							<div class="mixed-header">
								<img src="images/person.png" />
								<span>{{ capGen.username }}</span>
							</div>
						</th>
						<th :title="capApp.noAuthHint">
							<div class="mixed-header">
								<img src="images/warning.png" />
								<span>{{ capApp.noAuth }}</span>
							</div>
						</th>
						<th>
							<div class="mixed-header">
								<img src="images/key.png" />
								<span>{{ capApp.authentication }}</span>
							</div>
						</th>
						<th>
							<div class="mixed-header">
								<img src="images/admin.png" />
								<span>{{ capApp.roles }}</span>
							</div>
						</th>
						<th>
							<div class="mixed-header">
								<img src="images/languages.png" />
								<span>{{ capApp.language }}</span>
							</div>
						</th>
						<th :title="capApp.adminHint">
							<div class="mixed-header">
								<img src="images/settings.png" />
								<span>{{ capApp.admin }}</span>
							</div>
						</th>
						<th>
							<div class="mixed-header">
								<img src="images/remove.png" />
								<span>{{ capGen.active }}</span>
							</div>
						</th>
						<th>
							<div class="mixed-header">
								<img src="images/form.png" />
								<span>{{ capGen.id }}</span>
							</div>
						</th>
						<th></th>
						<th class="gab"></th>
						<th class="left-border" v-for="(lf,lfi) in loginForms">
							<div class="mixed-header">
								<img class="clickable"
									@click="toggleLoginForms(lfi)"
									:src="loginFormsHidden.includes(lfi) ? 'images/triangleRight.png' : 'images/triangleDown.png'"
								/>
								<my-button
									@trigger="toggleLoginForms(lfi)"
									:caption="loginFormsHidden.includes(lfi) ? '' : getCaptionForModule(lf.captions['loginFormTitle'],lf.name,moduleIdMap[lf.moduleId])"
									:imageBase64="srcBase64Icon(moduleIdMap[lf.moduleId].iconId,'images/module.png')"
									:naked="true"
								/>
							</div>
						</th>
					</tr>
				</thead>
				
				<!-- login form -->
				<div class="app-sub-window" v-if="loginFormIndexOpen !== null">
					<my-form class="form-pop-up shade"
						@close="loginFormIndexOpen = null"
						@record-updated="setRecord(loginFormIndexOpen,loginFormLogin,$event);loginFormIndexOpen = null"
						:allowDel="false"
						:allowNew="false"
						:formId="loginForms[loginFormIndexOpen].formId"
						:isInline="true"
						:module="moduleIdMap[formIdMap[loginForms[loginFormIndexOpen].formId].moduleId]"
						:recordId="loginFormRecord"
					/>
				</div>
				
				<!-- new login -->
				<my-admin-logins-item
					@updated="get"
					:key="0"
					:ldaps="ldaps"
					:loginForms="loginForms"
					:loginFormsHidden="loginFormsHidden"
				/>
				
				<!-- existing logins -->
				<my-admin-logins-item
					v-for="l in logins"
					@open-login-form="openLoginForm"
					@set-record="setRecord"
					@updated="get"
					:key="l.id"
					:ldaps="ldaps"
					:login="l"
					:loginForms="loginForms"
					:loginFormsHidden="loginFormsHidden"
				/>
			</table>
		</div>
	</div>`,
	props:{
		menuTitle:{ type:String, required:true }
	},
	data:function() {
		return {
			logins:[],
			ldaps:[],
			total:0,
			
			// login form
			loginFormIndexOpen:null,
			loginFormLogin:null,
			loginFormRecord:null,
			
			// state
			byString:'',
			limit:30,
			offset:0,
			loginFormsHidden:[]
		};
	},
	mounted:function() {
		this.get();
		this.getLdaps();
		this.$store.commit('pageTitle',this.menuTitle);
	},
	computed:{
		loginForms:function() {
			let out = [];
			for(let i = 0, j = this.modules.length; i < j; i++) {
				for(let x = 0, y = this.modules[i].loginForms.length; x < y; x++) {
					out.push(this.modules[i].loginForms[x]);
				}
			}
			return out;
		},
		
		// stores
		modules:    function() { return this.$store.getters['schema/modules']; },
		moduleIdMap:function() { return this.$store.getters['schema/moduleIdMap']; },
		formIdMap:  function() { return this.$store.getters['schema/formIdMap']; },
		capApp:     function() { return this.$store.getters.captions.admin.login; },
		capGen:     function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		// externals
		getCaptionForModule,
		srcBase64Icon,
		
		byStringSet:function() {
			this.offset = 0;
			this.get();
		},
		limitSet:function(newLimit) {
			this.limit  = parseInt(newLimit);
			this.offset = 0;
			this.get();
		},
		offsetSet:function(newOffset) {
			this.offset = newOffset;
			this.get();
		},
		openLoginForm:function(index,loginId,recordId) {
			this.loginFormIndexOpen = index;
			this.loginFormLogin     = loginId;
			this.loginFormRecord    = recordId !== null ? recordId : 0;
		},
		toggleLoginForms:function(index) {
			let pos = this.loginFormsHidden.indexOf(index);
			
			if(pos === -1)
				return this.loginFormsHidden.push(index);
			
			this.loginFormsHidden.splice(pos,1);
		},
		
		// backend calls
		get:function() {
			let trans    = new wsHub.transactionBlocking();
			let requests = [];
			
			for(let i = 0, j = this.loginForms.length; i < j; i++) {
				requests.push({
					attributeIdLogin:this.loginForms[i].attributeIdLogin,
					attributeIdLookup:this.loginForms[i].attributeIdLookup
				});
			}
			
			trans.add('login','get',{
				byString:this.byString,
				limit:this.limit,
				offset:this.offset,
				recordRequests:requests
			},this.getOk);
			trans.send(this.$root.genericError);
		},
		getOk:function(res) {
			this.logins = res.payload.logins;
			this.total  = res.payload.total;
		},
		getLdaps:function() {
			let trans = new wsHub.transactionBlocking();
			trans.add('ldap','get',{},this.getLdapsOk);
			trans.send(this.$root.genericError);
		},
		getLdapsOk:function(res) {
			this.ldaps = res.payload.ldaps;
		},
		setRecord:function(index,loginId,recordId) {
			let trans = new wsHub.transactionBlocking();
			trans.add('login','setRecord',{
				attributeIdLogin:this.loginForms[index].attributeIdLogin,
				loginId:loginId,
				recordId:recordId
			},this.setRecordOk);
			trans.send(this.$root.genericError);
		},
		setRecordOk:function(res) {
			this.get();
		}
	}
};