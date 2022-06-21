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
				<div v-if="!licenseValid" class="license-required">
					{{ capGen.licenseRequired }}
				</div>
				
				<span v-html="capApp.description"></span>
				<br /><br />
				
				<table class="default-inputs" v-if="ldaps.length !== 0">
					<tbody>
						<tr v-for="l in ldaps">
							<td>{{ l.name }}</td>
							<td>{{ l.host+':'+l.port }}</td>
							<td>
								<my-button image="download.png"
									@trigger="runImport(l.id)"
									:active="licenseValid"
									:caption="capApp.button.import"
								/>
								
								<my-button image="edit.png"
									@trigger="open(l.id)"
									:active="licenseValid"
								/>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
			
			<div class="contentPart long" v-if="showEdit">
				
				<div class="contentPartHeader">
					<img class="icon" src="images/edit.png" />
					<h1>{{ capApp.title }}</h1>
				</div>
				
				<div class="entry-actions">
					<my-button image="save.png"
						@trigger="set"
						:active="hasChanges"
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
					<my-button class="right" image="cancel.png"
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
							<td><input v-model="inputs.searchDn" :placeholder="capApp.searchDnHint" /></td>
						</tr>
						<tr v-if="showExpert">
							<td>{{ capApp.searchClass }}</td>
							<td>
								<input v-model="inputs.searchClass"
									:placeholder="capApp.searchClassHint"
								/>
							</td>
						</tr>
						<tr v-if="showExpert">
							<td>{{ capApp.keyAttribute }}</td>
							<td>
								<input v-model="inputs.keyAttribute"
									:placeholder="capApp.keyAttributeHint"
								/>
							</td>
						</tr>
						<tr v-if="showExpert">
							<td>{{ capApp.loginAttribute }}</td>
							<td>
								<input v-model="inputs.loginAttribute"
									:placeholder="capApp.loginAttributeHint"
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
						<tr v-if="showExpert">
							<td>{{ capApp.msAdExt }}</td>
							<td>
								<my-bool v-model="inputs.msAdExt" />
								<span>{{ capApp.msAdExtHint }}</span>
							</td>
						</tr>
						<tr>
							<td><span v-html="capApp.assignRoles" /></td>
							<td><my-bool v-model="inputs.assignRoles" /></td>
						</tr>
						<tr v-if="showExpert && inputs.assignRoles">
							<td>{{ capApp.memberAttribute }}</td>
							<td>
								<input v-model="inputs.memberAttribute"
									:placeholder="capApp.memberAttributeHint"
								/>
							</td>
						</tr>
					</tbody>
				</table>
				
				<template v-if="inputs.assignRoles">
				
					<h2 class="roles-title">{{ capApp.titleRoles }}</h2>
					<div>
						<my-button image="add.png"
							@trigger="roleAdd()"
							:caption="capGen.button.add"
						/>
					</div>
					<br />
					
					<table v-if="inputs.roles.length !== 0">
						<thead>
							<tr>
								<th>{{ capApp.groupDn }}</th>
								<th>{{ capApp.role }}</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							<tr v-for="(r,i) in inputs.roles" class="default-inputs">
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
	data:function() {
		return {
			ldaps:[],
			inputs:{},
			
			// states
			idEdit:0,
			showEdit:false,
			showExpert:false
		};
	},
	mounted:function() {
		this.get();
		this.$store.commit('pageTitle',this.menuTitle);
	},
	computed:{
		hasChanges:function() {
			return this.ldap.name            !== this.inputs.name
				|| this.ldap.host            !== this.inputs.host
				|| this.ldap.port            !== this.inputs.port
				|| this.ldap.bindUserDn      !== this.inputs.bindUserDn
				|| this.ldap.bindUserPw      !== this.inputs.bindUserPw
				|| this.ldap.keyAttribute    !== this.inputs.keyAttribute
				|| this.ldap.loginAttribute  !== this.inputs.loginAttribute
				|| this.ldap.memberAttribute !== this.inputs.memberAttribute
				|| this.ldap.searchClass     !== this.inputs.searchClass
				|| this.ldap.searchDn        !== this.inputs.searchDn
				|| this.ldap.assignRoles     !== this.inputs.assignRoles
				|| this.ldap.msAdExt         !== this.inputs.msAdExt
				|| this.ldap.starttls        !== this.inputs.starttls
				|| this.ldap.tls             !== this.inputs.tls
				|| this.ldap.tlsVerify       !== this.inputs.tlsVerify
				|| JSON.stringify(this.ldap.roles) !== JSON.stringify(this.inputs.roles)
			;
		},
		isNew:function() {
			return this.idEdit === 0;
		},
		
		ldap:function() {
			for(let i = 0, j = this.ldaps.length; i < j; i++) {
				if(this.ldaps[i].id === this.idEdit)
					return this.ldaps[i];
			}
			return {
				name:'',
				host:'',
				port:636,
				bindUserDn:'',
				bindUserPw:'',
				keyAttribute:'objectGUID',
				loginAttribute:'sAMAccountName',
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
		},
		
		// stores
		modules:     function() { return this.$store.getters['schema/modules']; },
		roleIdMap:   function() { return this.$store.getters['schema/roleIdMap']; },
		capApp:      function() { return this.$store.getters.captions.admin.ldaps; },
		capGen:      function() { return this.$store.getters.captions.generic; },
		licenseValid:function() { return this.$store.getters.licenseValid; }
	},
	methods:{
		// externals
		hasAnyAssignableRole,
		
		// actions
		close:function() {
			this.showEdit = false;
			this.idEdit   = 0;
		},
		open:function(id) {
			this.showEdit = true;
			this.idEdit   = id;
			this.inputs   = JSON.parse(JSON.stringify(this.ldap));
		},
		roleAdd:function() {
			this.inputs.roles.push({
				ldapId:this.idEdit,
				roleId:null,
				groupDn:''
			});
		},
		roleRemove:function(i) {
			this.inputs.roles.splice(i,1);
		},
		
		// backend calls
		runImport:function(id) {
			ws.send('ldap','import',{id:id},true).then(
				() => {
					this.$store.commit('dialog',{
						captionBody:this.capApp.dialog.importDone,
						buttons:[{
							caption:this.capGen.button.close,
							cancel:true,
							image:'cancel.png'
						}]
					});
				},
				this.$root.genericError
			);
		},
		runCheck:function() {
			ws.send('ldap','check',{id:this.idEdit},true).then(
				() => {
					this.$store.commit('dialog',{
						captionBody:this.capApp.dialog.testDone,
						buttons:[{
							caption:this.capGen.button.close,
							cancel:true,
							image:'cancel.png'
						}]
					});
				},
				this.$root.genericError
			);
		},
		reloadBackendCache:function() {
			ws.send('ldap','reload',{},false).then(
				() => {},
				this.$root.genericError
			);
		},
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
			ws.send('ldap','del',{id:this.idEdit},true).then(
				() => {
					this.close();
					this.get();
					this.reloadBackendCache();
				},
				this.$root.genericError
			);
		},
		get:function() {
			ws.send('ldap','get',{},true).then(
				res => this.ldaps = res.payload.ldaps,
				this.$root.genericError
			);
		},
		set:function() {
			ws.send('ldap','set',{
				id:this.idEdit,
				name:this.inputs.name,
				host:this.inputs.host,
				port:this.inputs.port,
				bindUserDn:this.inputs.bindUserDn,
				bindUserPw:this.inputs.bindUserPw,
				keyAttribute:this.inputs.keyAttribute,
				loginAttribute:this.inputs.loginAttribute,
				memberAttribute:this.inputs.memberAttribute,
				searchClass:this.inputs.searchClass,
				searchDn:this.inputs.searchDn,
				assignRoles:this.inputs.assignRoles,
				msAdExt:this.inputs.msAdExt,
				starttls:this.inputs.starttls,
				tls:this.inputs.tls,
				tlsVerify:this.inputs.tlsVerify,
				roles:this.inputs.roles
			},true).then(
				() => {
					if(this.isNew)
						this.showEdit = false;
					
					this.get();
					this.reloadBackendCache();
				},
				this.$root.genericError
			);
		}
	}
};