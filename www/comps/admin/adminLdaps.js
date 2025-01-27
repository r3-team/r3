import {hasAnyAssignableRole} from '../shared/access.js';
export {MyAdminLdaps as default};

let MyAdminLdaps = {
	name:'my-admin-ldaps',
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
										@trigger="runImport(l.id)"
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
					<my-button
						@trigger="showExpert = !showExpert"
						:caption="capApp.button.expert"
						:image="showExpert ? 'visible1.png' : 'visible0.png'"
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
							<td><input v-model="name" :placeholder="capApp.nameHint" /></td>
						</tr>
						<tr>
							<td>{{ capApp.template }}</td>
							<td>
								<select v-model="loginTemplateId">
									<option v-for="t in templates" :title="t.comment" :value="t.id">
										{{ t.name }}
									</option>
								</select>
							</td>
						</tr>
						<tr>
							<td>{{ capApp.host }}</td>
							<td><input v-model="host" :placeholder="capApp.hostHint" /></td>
						</tr>
						<tr>
							<td>{{ capApp.port }}</td>
							<td><input v-model.number="port" :placeholder="capApp.portHint" /></td>
						</tr>
						<tr>
							<td>{{ capApp.bindUserDn }}</td>
							<td><input v-model="bindUserDn" :placeholder="capApp.bindUserDnHint" /></td>
						</tr>
						<tr>
							<td>{{ capApp.bindUserPw }}</td>
							<td><input v-model="bindUserPw" type="password" /></td>
						</tr>
						<tr>
							<td>{{ capApp.searchDn }}</td>
							<td>
								<input
									v-model="searchDn"
									:disabled="!isNew"
									:placeholder="capApp.searchDnHint"
								/>
							</td>
						</tr>
						<template v-if="showExpert">
							<tr>
								<td>{{ capApp.searchClass }}</td>
								<td><input v-model="searchClass" :placeholder="capApp.searchClassHint" /></td>
							</tr>
							<tr>
								<td>{{ capApp.keyAttribute }}</td>
								<td><input v-model="keyAttribute" :placeholder="capApp.keyAttributeHint" /></td>
							</tr>
							<tr>
								<td>{{ capApp.loginAttribute }}</td>
								<td><input v-model="loginAttribute" :placeholder="capApp.loginAttributeHint" /></td>
							</tr>
							<tr>
								<td colspan="2"><b>{{ capGen.details }}</b></td>
							</tr>
							<tr>
								<td>{{ capAppLogin.meta.department }}</td>
								<td><input v-model="loginMetaAttributes.department" :placeholder="capApp.metaHint.department" /></td>
							</tr>
							<tr>
								<td>{{ capAppLogin.meta.email }}</td>
								<td><input v-model="loginMetaAttributes.email" :placeholder="capApp.metaHint.email" /></td>
							</tr>
							<tr>
								<td>{{ capAppLogin.meta.location }}</td>
								<td><input v-model="loginMetaAttributes.location" :placeholder="capApp.metaHint.location" /></td>
							</tr>
							<tr>
								<td>{{ capAppLogin.meta.nameDisplay }}</td>
								<td><input v-model="loginMetaAttributes.nameDisplay" :placeholder="capApp.metaHint.nameDisplay" /></td>
							</tr>
							<tr>
								<td>{{ capAppLogin.meta.nameFore }}</td>
								<td><input v-model="loginMetaAttributes.nameFore" :placeholder="capApp.metaHint.nameFore" /></td>
							</tr>
							<tr>
								<td>{{ capAppLogin.meta.nameSur }}</td>
								<td><input v-model="loginMetaAttributes.nameSur" :placeholder="capApp.metaHint.nameSur" /></td>
							</tr>
							<tr>
								<td>{{ capAppLogin.meta.notes }}</td>
								<td><input v-model="loginMetaAttributes.notes" :placeholder="capApp.metaHint.notes" /></td>
							</tr>
							<tr>
								<td>{{ capAppLogin.meta.organization }}</td>
								<td><input v-model="loginMetaAttributes.organization" :placeholder="capApp.metaHint.organization" /></td>
							</tr>
							<tr>
								<td>{{ capAppLogin.meta.phoneFax }}</td>
								<td><input v-model="loginMetaAttributes.phoneFax" :placeholder="capApp.metaHint.phoneFax" /></td>
							</tr>
							<tr>
								<td>{{ capAppLogin.meta.phoneLandline }}</td>
								<td><input v-model="loginMetaAttributes.phoneLandline" :placeholder="capApp.metaHint.phoneLandline" /></td>
							</tr>
							<tr>
								<td>{{ capAppLogin.meta.phoneMobile }}</td>
								<td><input v-model="loginMetaAttributes.phoneMobile" :placeholder="capApp.metaHint.phoneMobile" /></td>
							</tr>
						</template>
						<tr>
							<td>{{ capApp.tls }}</td>
							<td><my-bool v-model="tls" :readonly="starttls" /></td>
						</tr>
						<tr>
							<td>{{ capApp.starttls }}</td>
							<td><my-bool v-model="starttls" :readonly="tls" /></td>
						</tr>
						<tr>
							<td>{{ capApp.tlsVerify }}</td>
							<td><my-bool v-model="tlsVerify" :readonly="!tls && !starttls" /></td>
						</tr>
						<tr v-if="showExpert">
							<td>{{ capApp.msAdExt }}</td>
							<td>
								<my-bool v-model="msAdExt" />
								<span>{{ capApp.msAdExtHint }}</span>
							</td>
						</tr>
						<tr>
							<td><span v-html="capApp.assignRoles" /></td>
							<td><my-bool v-model="assignRoles" /></td>
						</tr>
						<tr v-if="showExpert && assignRoles">
							<td>{{ capApp.memberAttribute }}</td>
							<td>
								<input v-model="memberAttribute"
									:placeholder="capApp.memberAttributeHint"
								/>
							</td>
						</tr>
					</tbody>
				</table>
				
				<template v-if="assignRoles">
				
					<h2 class="roles-title">{{ capApp.titleRoles }}</h2>
					<div>
						<my-button image="add.png"
							@trigger="roleAdd()"
							:caption="capGen.button.add"
						/>
					</div>
					<br />
					
					<table v-if="roles.length !== 0">
						<thead>
							<tr>
								<th>{{ capApp.groupDn }}</th>
								<th>{{ capApp.role }}</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							<tr v-for="(r,i) in roles" class="default-inputs">
								<td>
									<input v-model="r.groupDn"
										:placeholder="capApp.groupDnHint"
									/>
								</td>
								<td>
									<select v-model="r.roleId">
										<option :value="null">-</option>
										<optgroup
											v-for="m in modules.filter(v => !v.hidden && hasAnyAssignableRole(v.roles))"
											:label="m.name"
										>
											<option
												v-for="rr in m.roles.filter(v => v.assignable && v.name !== 'everyone')"
												:value="rr.id"
											>{{ rr.name }}</option>
										</optgroup>
									</select>
								</td>
								<td>
									<my-button image="delete.png"
										@trigger="roleRemove(i)"
										:cancel="true"
									/>
								</td>
							</tr>
						</tbody>
					</table>
				</template>
			</div>
		</div>
	</div>`,
	props:{
		menuTitle:{ type:String, required:true }
	},
	data() {
		return {
			// inputs
			name:'',
			host:'',
			port:'',
			bindUserDn:'',
			bindUserPw:'',
			keyAttribute:'',
			loginAttribute:'',
			loginMetaAttributes:{
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
			loginTemplateId:'',
			memberAttribute:'',
			searchClass:'',
			searchDn:'',
			assignRoles:'',
			msAdExt:'',
			starttls:'',
			tls:'',
			tlsVerify:'',
			roles:'',
			
			// states
			idEdit:-1,         // ID of LDAP connection being edited (0 = new)
			inputKeys:[
				'name','host','port','bindUserDn','bindUserPw',
				'keyAttribute','loginAttribute','loginMetaAttributes',
				'loginTemplateId','memberAttribute','searchClass','searchDn',
				'assignRoles','msAdExt','starttls','tls','tlsVerify','roles'
			],
			inputsOrg:{},      // map of original input values, key = input key
			ldaps:[],
			showExpert:false,
			templates:[]
		};
	},
	mounted() {
		this.get();
		this.$store.commit('pageTitle',this.menuTitle);
	},
	computed:{
		hasChanges:(s) => {
			if(s.idEdit === -1)
				return false;
			
			for(let k of s.inputKeys) {
				if(JSON.stringify(s.inputsOrg[k]) !== JSON.stringify(s[k]))
					return true;
			}
			return false;
		},
		
		// simple
		canSave:(s) => s.hasChanges && s.searchDn !== '',
		isNew:  (s) => s.idEdit === 0,
		
		// stores
		modules:     (s) => s.$store.getters['schema/modules'],
		roleIdMap:   (s) => s.$store.getters['schema/roleIdMap'],
		capApp:      (s) => s.$store.getters.captions.admin.ldaps,
		capAppLogin: (s) => s.$store.getters.captions.admin.login,
		capGen:      (s) => s.$store.getters.captions.generic,
		licenseValid:(s) => s.$store.getters.licenseValid
	},
	methods:{
		// externals
		hasAnyAssignableRole,
		
		// actions
		close() {
			this.idEdit = -1;
		},
		open(id) {
			let ldap = {
				name:'',
				host:'',
				port:636,
				bindUserDn:'',
				bindUserPw:'',
				keyAttribute:'objectGUID',
				loginMetaAttributes:{
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
				loginTemplateId:null,
				memberAttribute:'memberOf',
				searchClass:'user',
				searchDn:'',
				assignRoles:false,
				msAdExt:true,
				starttls:false,
				tls:true,
				tlsVerify:true,
				roles:[]
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
			
			for(let k of this.inputKeys) {
				this[k]           = JSON.parse(JSON.stringify(ldap[k]));
				this.inputsOrg[k] = JSON.parse(JSON.stringify(ldap[k]));
			}
			this.idEdit = id;
		},
		roleAdd() {
			this.roles.push({
				ldapId:this.idEdit,
				roleId:null,
				groupDn:''
			});
		},
		roleRemove(i) {
			this.roles.splice(i,1);
		},
		
		// backend calls
		runImport(id) {
			ws.send('ldap','import',{id:id},true).then(
				() => {
					this.$store.commit('dialog',{
						captionBody:this.capApp.dialog.importDone
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
				name:this.name,
				host:this.host,
				port:this.port,
				bindUserDn:this.bindUserDn,
				bindUserPw:this.bindUserPw,
				keyAttribute:this.keyAttribute,
				loginAttribute:this.loginAttribute,
				loginMetaAttributes:this.loginMetaAttributes,
				loginTemplateId:this.loginTemplateId,
				memberAttribute:this.memberAttribute,
				searchClass:this.searchClass,
				searchDn:this.searchDn,
				assignRoles:this.assignRoles,
				msAdExt:this.msAdExt,
				starttls:this.starttls,
				tls:this.tls,
				tlsVerify:this.tlsVerify,
				roles:this.roles
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