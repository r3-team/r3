import MyAdminLoginMeta        from './adminLoginMeta.js';
import MyAdminLoginRolesAssign from './adminLoginRolesAssign.js';
import {deepIsEqual}           from '../shared/generic.js';
export {MyAdminLdaps as default};

let MyAdminLdaps = {
	name:'my-admin-ldaps',
	components:{
		MyAdminLoginMeta,
		MyAdminLoginRolesAssign
	},
	template:`<div class="admin-ldaps contentBox grow">
		
		<div class="top">
			<div class="area">
				<img class="icon" src="images/hierarchy.png" />
				<h1>{{ menuTitle }}</h1>
			</div>
		</div>
		<div class="top lower">
			<div class="area">
				<my-button image="add.png"
					@trigger="open(0)"
					:active="licenseValid"
					:caption="capApp.button.new"
				/>
			</div>
		</div>
		
		<div class="content no-padding">
		
			<div class="contentPart long">
				<span v-html="capApp.description"></span>
				<br /><br />
				
				<table class="default-inputs" v-if="ldaps.length !== 0">
					<tbody>
						<tr v-for="l in ldaps">
							<td>{{ l.name }}</td>
							<td>{{ l.host+':'+l.port }}</td>
							<td>
								<div class="row gap">
									<my-button image="download.png"
										@trigger="runImports"
										:active="licenseValid"
										:caption="capApp.button.import"
									/>
									<my-button image="edit.png"
										@trigger="open(l.id)"
										:active="licenseValid"
									/>
								</div>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
			
			<div class="contentPart long" v-if="idEdit !== -1">
				
				<div class="contentPartHeader">
					<img class="icon" src="images/edit.png" />
					<h1>{{ capApp.title }}</h1>
				</div>
				
				<div class="entry-actions">
					<my-button image="save.png"
						@trigger="set"
						:active="canSave"
						:caption="capGen.button.save"
					/>
					<my-button image="settings.png"
						v-if="!isNew"
						@trigger="runCheck"
						:caption="capApp.button.test"
					/>
					<my-button image="delete.png"
						v-if="!isNew"
						@trigger="delAsk"
						:cancel="true"
						:caption="capGen.button.delete"
					/>
					<my-button image="cancel.png"
						@trigger="close"
						:cancel="true"
						:caption="capGen.button.close"
					/>
				</div>
				
				<table class="default-inputs">
					<tbody>
						<tr>
							<td>{{ capGen.name }}</td>
							<td><input v-model="inputs.name" :placeholder="capApp.nameHint" /></td>
						</tr>
						<tr>
							<td>{{ capGen.loginTemplate }}</td>
							<td>
								<select v-model="inputs.loginTemplateId">
									<option v-for="t in templates" :title="t.comment" :value="t.id">
										{{ t.name }}
									</option>
								</select>
							</td>
						</tr>
						<tr>
							<td>{{ capApp.host }}</td>
							<td><input v-model="inputs.host" :placeholder="capApp.hostHint" /></td>
						</tr>
						<tr>
							<td>{{ capApp.port }}</td>
							<td><input v-model.number="inputs.port" :placeholder="capApp.portHint" /></td>
						</tr>
						<tr>
							<td>{{ capApp.bindUserDn }}</td>
							<td><input v-model="inputs.bindUserDn" :placeholder="capApp.bindUserDnHint" /></td>
						</tr>
						<tr>
							<td>{{ capApp.bindUserPw }}</td>
							<td><input v-model="inputs.bindUserPw" type="password" /></td>
						</tr>
						<tr>
							<td>{{ capApp.searchDn }}</td>
							<td>
								<input
									v-model="inputs.searchDn"
									:disabled="!isNew"
									:placeholder="capApp.searchDnHint"
								/>
							</td>
						</tr>
						<tr>
							<td>{{ capApp.tls }}</td>
							<td><my-bool v-model="inputs.tls" :readonly="inputs.starttls" /></td>
						</tr>
						<tr>
							<td>{{ capApp.starttls }}</td>
							<td><my-bool v-model="inputs.starttls" :readonly="inputs.tls" /></td>
						</tr>
						<tr>
							<td>{{ capApp.tlsVerify }}</td>
							<td><my-bool v-model="inputs.tlsVerify" :readonly="!inputs.tls && !inputs.starttls" /></td>
						</tr>
						<tr>
							<td>{{ capApp.msAdExt }}</td>
							<td>
								<my-bool v-model="inputs.msAdExt" />
								<span>{{ capApp.msAdExtHint }}</span>
							</td>
						</tr>
						<tr>
							<td>{{ capApp.searchClass }}</td>
							<td><input v-model="inputs.searchClass" :placeholder="capApp.searchClassHint" /></td>
						</tr>
						<tr>
							<td>{{ capApp.keyAttribute }}</td>
							<td><input v-model="inputs.keyAttribute" :placeholder="capApp.keyAttributeHint" /></td>
						</tr>
						<tr>
							<td>{{ capApp.loginAttribute }}</td>
							<td><input v-model="inputs.loginAttribute" :placeholder="capApp.loginAttributeHint" /></td>
						</tr>
						<tr>
							<td colspan="2"><b>{{ capApp.loginMetaMap }}</b></td>
						</tr>
						<tr>
							<td colspan="2">
								<my-admin-login-meta
									v-model="inputs.loginMetaMap"
									:is-mapper="true"
									:readonly="!licenseValid"
								/>
							</td>
						</tr>
						<tr>
							<td><span v-html="capApp.assignRoles" /></td>
							<td><my-bool v-model="inputs.assignRoles" /></td>
						</tr>
						<tr v-if="inputs.assignRoles">
							<td>{{ capApp.memberAttribute }}</td>
							<td>
								<input
									v-model="inputs.memberAttribute"
									:placeholder="capApp.memberAttributeHint"
								/>
							</td>
						</tr>
					</tbody>
				</table>
				
				<template v-if="inputs.assignRoles">
					<h2 class="roles-title">{{ capApp.titleRoles }}</h2>
					<my-admin-login-roles-assign
						v-model="inputs.loginRolesAssign"
						:placeholder="capApp.groupDnHint"
						:readonly="!licenseValid"
					/>
				</template>
			</div>
		</div>
	</div>`,
	props:{
		menuTitle:{ type:String, required:true }
	},
	data() {
		return {
			idEdit:-1,    // ID of LDAP connection being edited (0 = new, -1 = edit interface closed)
			inputs:{},    // input values
			inputsOrg:{}, // input values on load
			ldaps:[],
			templates:[]
		};
	},
	mounted() {
		this.get();
		this.$store.commit('pageTitle',this.menuTitle);
	},
	computed:{
		// simple
		canSave:   (s) => s.hasChanges && s.searchDn !== '',
		isNew:     (s) => s.idEdit === 0,
		hasChanges:(s) => s.idEdit === -1 ? false : !s.deepIsEqual(s.inputsOrg,s.inputs),
		
		// stores
		roleIdMap:   (s) => s.$store.getters['schema/roleIdMap'],
		capApp:      (s) => s.$store.getters.captions.admin.ldaps,
		capAppLogin: (s) => s.$store.getters.captions.admin.login,
		capGen:      (s) => s.$store.getters.captions.generic,
		licenseValid:(s) => s.$store.getters.licenseValid
	},
	methods:{
		// externals
		deepIsEqual,
		
		// actions
		close() {
			this.idEdit = -1;
		},
		open(id) {
			// start with defaults
			let ldap = {
				name:'',
				host:'',
				port:636,
				bindUserDn:'',
				bindUserPw:'',
				keyAttribute:'objectGUID',
				loginMetaMap:{
					department:'department',
					email:'mail',
					location:'physicalDeliveryOfficeName',
					nameDisplay:'displayName',
					nameFore:'givenName',
					nameSur:'sn',
					notes:'description',
					organization:'company',
					phoneFax:'facsimileTelephoneNumber',
					phoneLandline:'telephoneNumber',
					phoneMobile:'mobile'
				},
				loginAttribute:'sAMAccountName',
				loginRolesAssign:[],
				loginTemplateId:null,
				memberAttribute:'memberOf',
				searchClass:'user',
				searchDn:'',
				assignRoles:false,
				msAdExt:true,
				starttls:false,
				tls:true,
				tlsVerify:true
			};
			
			if(id > 0) {
				for(let l of this.ldaps) {
					if(l.id === id) {
						ldap = l;
						break;
					}
				}
			}
			
			// apply global template if empty
			if(ldap.loginTemplateId === null && this.templates.length > 0)
				ldap.loginTemplateId = this.templates[0].id;

			this.inputs    = JSON.parse(JSON.stringify(ldap));
			this.inputsOrg = JSON.parse(JSON.stringify(ldap));
			this.idEdit    = id;
		},
		
		// backend calls
		runImports() {
			ws.send('task','run',{
				clusterMasterOnly:true,
				taskName:'importLdapLogins'
			},true).then(
				() => {
					this.$store.commit('dialog',{
						captionBody:this.capApp.dialog.importPlanned
					});
				},
				this.$root.genericError
			);
		},
		runCheck() {
			ws.send('ldap','check',{id:this.idEdit},true).then(
				() => {
					this.$store.commit('dialog',{
						captionBody:this.capApp.dialog.testDone
					});
				},
				this.$root.genericError
			);
		},
		reloadBackendCache() {
			ws.send('ldap','reload',{},false).then(
				() => {},
				this.$root.genericError
			);
		},
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
			ws.send('ldap','del',{id:this.idEdit},true).then(
				() => {
					this.close();
					this.get();
					this.reloadBackendCache();
				},
				this.$root.genericError
			);
		},
		get() {
			ws.sendMultiple([
				ws.prepare('ldap','get',{}),
				ws.prepare('loginTemplate','get',{byId:0})
			],true).then(
				res => {
					this.ldaps     = res[0].payload;
					this.templates = res[1].payload;
				},
				this.$root.genericError
			);
		},
		set() {
			ws.send('ldap','set',{
				id:this.idEdit,
				name:this.inputs.name,
				host:this.inputs.host,
				port:this.inputs.port,
				bindUserDn:this.inputs.bindUserDn,
				bindUserPw:this.inputs.bindUserPw,
				keyAttribute:this.inputs.keyAttribute,
				loginAttribute:this.inputs.loginAttribute,
				loginMetaMap:this.inputs.loginMetaMap,
				loginRolesAssign:this.inputs.loginRolesAssign,
				loginTemplateId:this.inputs.loginTemplateId,
				memberAttribute:this.inputs.memberAttribute,
				searchClass:this.inputs.searchClass,
				searchDn:this.inputs.searchDn,
				assignRoles:this.inputs.assignRoles,
				msAdExt:this.inputs.msAdExt,
				starttls:this.inputs.starttls,
				tls:this.inputs.tls,
				tlsVerify:this.inputs.tlsVerify
			},true).then(
				() => {
					this.idEdit = -1;
					this.get();
					this.reloadBackendCache();
				},
				this.$root.genericError
			);
		}
	}
};