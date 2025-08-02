import MyAdminLoginMeta        from './adminLoginMeta.js';
import MyAdminLoginRolesAssign from './adminLoginRolesAssign.js';
import MyInputDateWrap         from '../inputDateWrap.js';
import {deepIsEqual}           from '../shared/generic.js';
import {getUnixNowDate}        from '../shared/time.js';
export {MyAdminOauthClient as default};

let MyAdminOauthClient = {
	name:'my-admin-oauth-client',
	components:{
		MyAdminLoginMeta,
		MyAdminLoginRolesAssign,
		MyInputDateWrap
	},
	template:`<div v-if="ready" class="app-sub-window under-header at-top with-margin" @mousedown.self="$emit('close')">
		
		<div class="contentBox admin-oauth-client scroll float">
			<div class="top">
				<div class="area nowrap">
					<img class="icon" src="images/lockCog.png" />
					<h1 class="title">{{ isNew ? capApp.titleNew : capApp.title.replace('{NAME}',inputs.name) }}</h1>
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
						:active="canSave"
						:caption="isNew ? capGen.button.create : capGen.button.save"
					/>
					<my-button image="refresh.png"
						v-if="!isNew"
						@trigger="reset"
						:active="hasChanges"
						:caption="capGen.button.refresh"
					/>
					<my-button image="add.png"
						v-if="!isNew"
						@trigger="$emit('makeNew')"
						:active="!readonly"
						:caption="capGen.button.new"
					/>
				</div>
				<div class="area">
					<my-button image="delete.png"
						v-if="!isNew"
						@trigger="delAsk"
						:active="!readonly"
						:cancel="true"
						:caption="capGen.button.delete"
					/>
				</div>
			</div>
			
			<div class="content no-padding default-inputs">
				<table class="generic-table-vertical">
					<tbody>
						<tr>
							<td>{{ capGen.name }}*</td>
							<td><input v-model="inputs.name" :disabled="readonly" v-focus /></td>
							<td>{{ capApp.nameHint }}</td>
						</tr>
						<tr>
							<td>{{ capApp.flow }}*</td>
							<td colspan="2">
								<div class="column">
									<select v-model="inputs.flow" :disabled="readonly || !isNew">
										<option value="authCodePkce">{{ capApp.option.flow.authCodePkce }}</option>
										<option value="clientCreds">{{ capApp.option.flow.clientCreds }}</option>
									</select>
									<span v-html="capApp.option.flowHint[inputs.flow]" />
								</div>
							</td>
						</tr>
						<tr>
							<td>{{ capApp.clientId }}*</td>
							<td><input v-model="inputs.clientId" :disabled="readonly" /></td>
							<td>{{ capApp.clientIdHint }}</td>
						</tr>
						<tr>
							<td>{{ capApp.clientSecret }}*</td>
							<td><input v-model="inputs.clientSecret" :disabled="readonly" type="password" /></td>
							<td>{{ capApp.clientSecretHint }}</td>
						</tr>
						<tr>
							<td>{{ capApp.dateExpiry }}</td>
							<td>
								<my-input-date-wrap
									@set-unix-from="inputs.dateExpiry = $event"
									:isDate="true"
									:isTime="false"
									:isReadonly="readonly"
									:isValid="true"
									:unixFrom="inputs.dateExpiry"
								/>
							</td>
							<td>{{ capApp.dateExpiryHint }}</td>
						</tr>
						<tr>
							<td>{{ capApp.scopes }}*</td>
							<td colspan="2">
								<div class="column gap">
									<my-button image="cancel.png"
										v-for="(s,i) in inputs.scopes"
										@trigger="inputs.scopes.splice(i,1)"
										:active="!readonly"
										:caption="s"
										:naked="true"
									/>
									<div class="row gap centered">
										<input v-model="scopeLine" :disabled="readonly" />
										<my-button image="add.png"
											@trigger="inputs.scopes.push(scopeLine);scopeLine = ''"
											:active="scopeLine !== ''"
										/>
									</div>
									<span v-html="capApp.scopesHint" />
									<div class="row gap">
										<my-button image="add.png"
											@trigger="applyTemplate('o365')"
											:caption="capApp.button.defaultO365"
										/>
										<my-button image="add.png"
											@trigger="applyTemplate('openId')"
											:caption="capApp.button.defaultOpenId"
										/>
									</div>
								</div>
							</td>
						</tr>
						<template v-if="isFlowAuthCodePkce">
							<tr>
								<td>{{ capApp.providerUrl }}*</td>
								<td><input v-model="inputs.providerUrl" :disabled="readonly" /></td>
								<td>{{ capApp.providerUrlHint }}</td>
							</tr>
							<tr>
								<td>{{ capApp.redirectUrl }}*</td>
								<td><input v-model="inputs.redirectUrl" :disabled="readonly" /></td>
								<td>{{ capApp.redirectUrlHint }}</td>
							</tr>
							<tr>
								<td>{{ capGen.loginTemplate }}</td>
								<td>
									<select v-model="inputs.loginTemplateId" :disabled="readonly">
										<option v-for="t in loginTemplates" :title="t.comment" :value="t.id">{{ t.name }}</option>
									</select>
								</td>
								<td>{{ capGen.loginTemplateHint }}</td>
							</tr>
							<tr>
								<td>{{ capApp.claimUsername }}*</td>
								<td><input v-model="inputs.claimUsername" :disabled="readonly" /></td>
								<td>{{ capApp.claimUsernameHint }}</td>
							</tr>
							<tr>
								<td>{{ capApp.claimRoles }}</td>
								<td colspan="2">
									<div class="column gap">
										<input v-model="inputs.claimRoles" :disabled="readonly" />
										<span>{{ capApp.claimRolesHint }}</span>
										<my-admin-login-roles-assign
											v-model="inputs.loginRolesAssign"
											:readonly="readonly || !isClaimRolesSet"
										/>
									</div>
								</td>
							</tr>
							<tr>
								<td colspan="3">
									<span>{{ capApp.loginMetaMap }}</span>
									<my-admin-login-meta
										v-model="inputs.loginMetaMap"
										:is-mapper="true"
										:readonly="readonly"
									/>
								</td>
							</tr>
						</template>
						<tr v-if="isFlowClientCreds">
							<td>{{ capApp.tokenUrl }}*</td>
							<td colspan="2">
								<div class="column gap">
									<input v-model="inputs.tokenUrl" :disabled="readonly" />
									<span>{{ capApp.tokenUrlHint }}</span>
									<span>{{ capApp.tokenUrlExample }}</span>
								</div>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>`,
	props:{
		id:              { type:Number,  required:true },
		loginTemplates:  { type:Array,   required:true },
		oauthClientIdMap:{ type:Object,  required:true },
		readonly:        { type:Boolean, required:true }
	},
	emits:['close','makeNew'],
	watch:{
		id:{
			handler(v) { this.reset(); },
			immediate:true
		},
	},
	data() {
		return {
			inputs:{},
			ready:false,
			scopeLine:''
		};
	},
	computed:{
		canSave:(s) =>
			s.ready &&
			!s.readonly &&
			s.hasChanges &&
			s.inputs.name          !== '' &&
			s.inputs.clientId      !== '' &&
			s.inputs.clientSecret  !== '' &&
			s.inputs.scopes.length !== 0 &&
			(!s.isFlowAuthCodePkce || s.inputs.claimUsername !== '') &&
			(!s.isFlowAuthCodePkce || s.inputs.providerUrl !== '') &&
			(!s.isFlowAuthCodePkce || s.inputs.redirectUrl !== '') &&
			(!s.isFlowClientCreds  || s.isTokenUrlSet),
		inputsOrg:(s) => s.isNew ? {
			id:0,
			name:'',
			flow:'authCodePkce',
			clientId:'',
			clientSecret:'',
			dateExpiry:s.getUnixNowDate(),
			scopes:[],
			loginTemplateId:null,
			loginMetaMap:{},
			loginRolesAssign:[],
			claimRoles:null,
			claimUsername:null,
			providerUrl:null,
			redirectUrl:null,
			tokenUrl:null
		} : s.oauthClientIdMap[s.id],
		
		// simple states
		hasChanges:        (s) => !s.deepIsEqual(s.inputsOrg,s.inputs),
		isClaimRolesSet:   (s) => s.inputs.claimRoles !== null && s.inputs.claimRoles !== '',
		isFlowAuthCodePkce:(s) => s.inputs.flow === 'authCodePkce',
		isFlowClientCreds: (s) => s.inputs.flow === 'clientCreds',
		isTokenUrlSet:     (s) => s.inputs.tokenUrl   !== null && s.inputs.tokenUrl   !== '',
		isNew:             (s) => s.id === 0,
		
		// stores
		capApp:(s) => s.$store.getters.captions.admin.oauthClient,
		capGen:(s) => s.$store.getters.captions.generic
	},
	mounted() {
		this.$store.commit('keyDownHandlerSleep');
		this.$store.commit('keyDownHandlerAdd',{fnc:this.set,key:'s',keyCtrl:true});
		this.$store.commit('keyDownHandlerAdd',{fnc:this.close,key:'Escape'});
	},
	unmounted() {
		this.$store.commit('keyDownHandlerDel',this.set);
		this.$store.commit('keyDownHandlerDel',this.close);
		this.$store.commit('keyDownHandlerWake');
	},
	methods:{
		// external
		deepIsEqual,
		getUnixNowDate,
		
		// actions
		applyTemplate(value) {
			switch(value) {
				case 'o365':   this.inputs.scopes = ['https://outlook.office.com/.default']; break;
				case 'openId': this.inputs.scopes = ['openid'];                              break;
			}
		},
		close() {
			this.$emit('close');
		},
		reloadAndClose() {
			ws.send('oauthClient','reload',{},true).then(
				() => this.$emit('close'),
				this.$root.genericError
			);
		},
		reset() {
			this.inputs = JSON.parse(JSON.stringify(this.inputsOrg));

			if(this.isNew && this.loginTemplates.length > 0)
				this.inputs.loginTemplateId = this.loginTemplates[0].id;

			this.ready = true;
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
			ws.send('oauthClient','del',this.id,true).then(
				this.reloadAndClose,
				this.$root.genericError
			);
		},
		set() {
			if(!this.canSave) return;
			
			ws.send('oauthClient','set',{
				id:this.id,
				name:this.inputs.name,
				flow:this.inputs.flow,
				clientId:this.inputs.clientId,
				clientSecret:this.inputs.clientSecret,
				dateExpiry:this.inputs.dateExpiry,
				scopes:this.inputs.scopes,
				loginMetaMap:this.inputs.loginMetaMap,
				loginRolesAssign:this.inputs.loginRolesAssign,
				loginTemplateId:this.inputs.loginTemplateId,
				claimRoles:   this.inputs.claimRoles    !== '' ? this.inputs.claimRoles    : null,
				claimUsername:this.inputs.claimUsername !== '' ? this.inputs.claimUsername : null,
				providerUrl:  this.inputs.providerUrl   !== '' ? this.inputs.providerUrl   : null,
				redirectUrl:  this.inputs.redirectUrl   !== '' ? this.inputs.redirectUrl   : null,
				tokenUrl:     this.inputs.tokenUrl      !== '' ? this.inputs.tokenUrl      : null
			},true).then(
				this.reloadAndClose,
				this.$root.genericError
			);
		}
	}
};