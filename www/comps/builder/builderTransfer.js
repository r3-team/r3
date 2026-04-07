import {MyModuleSelect} from '../input.js';
import srcBase64Icon    from '../shared/image.js';
import {getCaption}     from '../shared/language.js';
import {
	aesGcmEncryptBase64WithPhrase,
	aesGcmDecryptBase64WithPhrase,
	getRandomString,
	rsaDecrypt,
	rsaEncrypt
} from '../shared/crypto.js';


const MyBuilderTransferKeyCreate = {
	name:'my-builder-transfer-key-create',
	template:`<div class="app-sub-window" @click.self="$emit('close')">
		<div class="builder-transfer-key-create float contentBox">
			<div class="top lower">
				<div class="area">
					<img class="icon" src="images/add.png" />
					<div class="caption">{{ capApp.keyCreate }}</div>
				</div>
				<div class="area">
					<my-button image="cancel.png"
						@trigger="$emit('close')"
						:cancel="true"
						:caption="capGen.button.close"
					/>
				</div>
			</div>
			<div class="content default-inputs gap column flex">
			
				<my-label :caption="capApp.keyCreateLength" />
				<div class="row gap centered">
					<select v-model="keyLength" :disabled="running">
						<option value="2048">2048</option>
						<option value="4096">4096</option>
						<option value="8192">8192</option>
						<option value="16384">16384</option>
					</select>
					<my-button
						@trigger="createKey"
						:active="!running"
						:caption="capGen.button.ok"
						:image="!running ? 'ok.png' : 'load.gif'"
					/>
				</div>
				
				<div class="column" v-if="keyPrivate !== ''">
					<p><b>{{ capApp.keyCreateInfo }}</b></p>
					<div class="row gap-large">
						<div class="column grow gap">
							<div class="row gap space-between">
								<my-label image="key.png" :caption="capGen.keyPrivate" />
								<my-button image="copyClipboard.png" @trigger="copyToClipboard(keyPrivate)" :caption="capGen.button.copyClipboard" />
							</div>
							<textarea :value="keyPrivate"></textarea>
						</div>
						<div class="column grow gap">
							<div class="row gap space-between">
								<my-label image="key.png" :caption="capGen.keyPublic" />
								<my-button image="copyClipboard.png" @trigger="copyToClipboard(keyPublic)" :caption="capGen.button.copyClipboard" />
							</div>
							<textarea :value="keyPublic"></textarea>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>`,
	emits:['close'],
	computed:{
		capApp:s => s.$store.getters.captions.builder.transfer,
		capGen:s => s.$store.getters.captions.generic
	},
	data() {
		return {
			keyLength:'4096',
			keyPrivate:'',
			keyPublic:'',
			running:false
		};
	},
	methods:{
		copyToClipboard(txt) {
			navigator.clipboard.writeText(txt);
		},
		createKey() {
			this.running = true;
			ws.send('key','create',{keyLength:parseInt(this.keyLength)},true).then(
				res => {
					this.keyPrivate = res.payload.private;
					this.keyPublic  = res.payload.public;
					this.running    = false;
				},
				this.$root.genericError
			);
		}
	}
};

export default {
	name:'my-builder-transfer',
	components:{
		MyBuilderTransferKeyCreate,
		MyModuleSelect
	},
	template:`<div class="contentBox grow">
		<div class="content default-inputs builder-transfer">

			<my-builder-transfer-key-create v-if="showKeyCreate" @close="showKeyCreate = false" />

			<div class="contentPart long">
				<div class="contentPartHeader space-between">
					<my-label
						:caption="capApp.selectModule"
						:image="moduleId === null ? 'question.png' : 'ok.png'"
						:large="true"
					/>
				</div>
				<my-module-select
					v-model="moduleId"
					@update:modelValue="checkModule"
					:allowEmpty="true"
					:preSelectOne="false"
				/>
			</div>

			<template v-if="moduleId !== null">

				<!-- change state -->
				<div class="contentPart long">
					<div class="contentPartHeader space-between">
						<my-label
							:caption="changesOk ? capApp.moduleChangesOk1 : capApp.moduleChangesOk0"
							:image="changesOk ? 'ok.png' : 'question.png'"
							:large="true"
						/>
						<my-button image="refresh.png"
							v-if="changesOk"
							@trigger="checkModule"
							:caption="capGen.button.refresh"
						/>
					</div>
					<table class="generic-table" v-if="!changesOk">
						<tbody>
							<template v-for="(changed,moduleId) in moduleIdMapChanged">
								<tr v-if="moduleIdMapMeta[moduleId].owner && changed">
									<td>
										<div class="row gap no-wrap">
											<my-label
												:caption="getCaption('moduleTitle',moduleId,moduleId,moduleIdMap[moduleId].captions,moduleIdMap[moduleId].name)"
												:imageBase64="srcBase64Icon(moduleIdMap[moduleId].iconId,'images/module.png')"
											/>
										</div>
									</td>
									<td class="minimum">
										<my-button image="add.png"
											@trigger="addVersion(moduleId)"
											:caption="capGen.versionNew"
										/>
									</td>
								</tr>
							</template>
						</tbody>
					</table>
				</div>

				<!-- private key for signing -->
				<div class="contentPart long">
					<div class="contentPartHeader space-between">
						<my-label
							:caption="isExportKeySet ? capApp.keyEntryOk1 : capApp.keyEntryOk0"
							:image="isExportKeySet ? 'ok.png' : 'question.png'"
							:large="true"
						/>
						<my-button image="cancel.png"
							v-if="isExportKeySet"
							@trigger="resetKey"
							:caption="capGen.button.reset"
						/>
					</div>
					<div class="column gap-large">
						<textarea
							v-if="!isExportKeySet"
							v-model="exportKeyPrivate"
							:placeholder="capApp.exportPrivateKeyHint"
						></textarea>
						<div class="row" v-if="!isExportKeySet">
							<my-button image="add.png"
								@trigger="showKeyCreate = true"
								:caption="capApp.button.generate"
							/>
						</div>
						
						<div class="row gap-large" v-if="!isExportKeySet">
							<my-button image="ok.png"
								@trigger="setKey"
								:active="exportKeyPrivate !== ''"
								:caption="capGen.button.ok"
							/>
							<my-button-check
								v-model="exportKeyPrivateAsE2ee"
								:caption="capApp.button.storeE2ee"
							/>
						</div>
						<my-label
							v-if="!isExportKeySet && exportKeyPrivateAsE2ee"
							:caption="capApp.keyStoreHint"
						/>
					</div>
				</div>

				<!-- transfer method / file download -->
				<div class="contentPart long">
					<div class="contentPartHeader space-between">
						<my-label image="ok.png"
							:caption="capApp.transferTargetOk1"
							:large="true"
						/>
					</div>
					<div class="column gap-large">
						<select @input="transferTarget = $event.target.value; getRepoCred()" :value="transferTarget">
							<option value="fileDownload">{{ capApp.option.method.fileDownload }}</option>
							<optgroup :label="capApp.option.method.repoUpload">
								<option v-for="r in repos.filter(v => v.active)" :value="r.id">{{ r.name }}</option>
							</optgroup>
						</select>
						<div class="row gap" v-if="transferTarget === 'fileDownload'">
							<a target="_blank" :href="exportUrl" :download="exportName">
								<my-button image="download.png"
									:active="isExportKeySet && changesOk"
									:caption="capGen.button.download"
								/>
							</a>
						</div>
					</div>
				</div>

				<!-- repo upload -->
				<div class="contentPart long" v-if="repoId !== null">
					<div class="contentPartHeader space-between">
						<my-label
							:caption="isRepoCredSet ? capApp.repositoryCredentialsOk1 : capApp.repositoryCredentialsOk0"
							:image="isRepoCredSet ? 'ok.png' : 'question.png'"
							:large="true"
						/>
						<my-button image="cancel.png"
							v-if="isRepoCredSet"
							@trigger="resetRepoCred"
							:caption="capGen.button.reset"
						/>
					</div>
					<div class="column gap-large">
						<template v-if="!isRepoCredSet">
							<input type="text"     v-model="repoCredUser" :placeholder="capGen.username" />
							<input type="passwort" v-model="repoCredPass" :placeholder="capGen.password" />
							<div class="row gap-large">
								<my-button image="ok.png"
									@trigger="setRepoCred"
									:active="repoCredUser !== '' && repoCredPass !== ''"
									:caption="capGen.button.ok"
								/>
								<my-button-check
									v-model="repoAsE2ee"
									:caption="capApp.button.storeE2ee"
								/>
							</div>
							<my-label
								v-if="repoAsE2ee"
								:caption="capApp.keyStoreHint"
							/>
						</template>
						<template v-if="isRepoCredSet">
							<div class="row gap">
								<my-button image="upload.png"
									@trigger="exportToRepo"
									:active="isExportKeySet && changesOk"
									:caption="capApp.option.method.repoUpload"
								/>
							</div>
						</template>
					</div>
				</div>
			</template>
		</div>
	</div>`,
	computed:{
		moduleIdsChanged:s => {
			if(s.moduleIdMapChanged === null) return [];

			let out = [];
			for(const id in s.moduleIdMapChanged) {
				if(s.moduleIdMapChanged[id] && s.moduleIdMapMeta[id].owner)
					out.push(id);
			}
			return out;
		},

		// simple
		changesOk:  s => s.moduleIdsChanged.length === 0,
		exportName: s => `${s.module.name}_${s.module.releaseBuild}.rei3`,
		exportUrl:  s => !s.isExportKeySet || !s.changesOk ? null : `/export/${s.exportName}?token=${s.token}&module_id=${s.moduleId}&date=${Math.floor(new Date().getTime() / 1000)}`,
		isE2eeReady:s => s.loginEncEnabled && !s.loginEncLocked,
		repoId:     s => s.transferTarget === 'fileDownload' ? null : s.transferTarget,
		repoUrl:    s => s.repoId === null ? '' : s.repos.filter(v => v.id === s.repoId)[0].url,
		
		// stores
		token:          s => s.$store.getters['local/token'],
		modules:        s => s.$store.getters['schema/modules'],
		moduleIdMap:    s => s.$store.getters['schema/moduleIdMap'],
		capApp:         s => s.$store.getters.captions.builder.transfer,
		capGen:         s => s.$store.getters.captions.generic,
		keyLength:      s => s.$store.getters.constants.keyLength,
		loginEncEnabled:s => s.$store.getters.loginEncEnabled,
		loginEncLocked: s => s.$store.getters.loginEncLocked,
		loginPrivateKey:s => s.$store.getters.loginPrivateKey,
		loginPublicKey :s => s.$store.getters.loginPublicKey,
		module:         s => s.moduleIdMap[s.moduleId] !== undefined ? s.moduleIdMap[s.moduleId] : false,
		moduleIdMapMeta:s => s.$store.getters.moduleIdMapMeta
	},
	data() {
		return {
			exportKeyPrivate:'',          // private key for export
			exportKeyPrivateAsE2ee:false, // store export key via E2EE (to reuse in new session)
			isExportKeySet:false,         // private key for export ready?
			isRepoCredSet:false,          // credentials for repository upload ready?
			moduleId:null,                // selected module
			moduleIdMapChanged:null,      // list of module IDs that have changes
			repoAsE2ee:false,             // store repository credentials via E2EE (to reuse in new session)
			repoCredPass:'',
			repoCredUser:'',
			repos:[],
			showKeyCreate:false,
			transferTarget:'fileDownload' // either 'fileDownload' or ID of repository to commit to
		};
	},
	mounted() {
		// fetch repos
		ws.send('repo','get',{},true).then(
			res => this.repos = res.payload,
			this.$root.genericError
		);

		if(this.isE2eeReady) {
			// fetch stored export key for current login
			ws.send('loginExportKey','get',{},true).then(
				res => {
					if(res.payload === null)
						return;

					// if available, decrypt export key and apply it
					this.rsaDecrypt(this.loginPrivateKey, res.payload.dataKeyEnc).then(
						dataKey => {
							this.aesGcmDecryptBase64WithPhrase(res.payload.dataEnc,dataKey).then(
								data => {
									this.exportKeyPrivate = data;
									this.setKeyForExport();
								},
								console.warn
							);
						},
						console.warn
					);
				},
				this.$root.genericError
			);
		}
	},
	methods:{
		// externals
		aesGcmDecryptBase64WithPhrase,
		aesGcmEncryptBase64WithPhrase,
		getCaption,
		getRandomString,
		rsaDecrypt,
		rsaEncrypt,
		srcBase64Icon,

		// versioning
		addVersion(moduleId) {
			ws.send('transfer','addVersion',moduleId,true).then(
				() => {
					ws.send('schema','reload',{moduleId},true).then(
						this.checkModule,
						this.$root.genericError
					);
				},
				this.$root.genericError
			);
		},

		// repository commit
		exportToRepo() {
			ws.send('repo','commit',{
				credPass:this.repoCredPass,
				credUser:this.repoCredUser,
				fileName:this.exportName,
				moduleId:this.moduleId,
				repoId:this.repoId
			},true,true).then(
				() => {
					this.$store.commit('dialog',{
						captionBody:this.capApp.dialog.repoCommitSuccess
					});
				},
				this.$root.genericError
			);
		},

		// repository credentials
		getRepoCred() {
			this.repoCredPass  = '';
			this.repoCredUser  = '';
			this.isRepoCredSet = false;
			if(this.repoId === null)
				return;

			ws.send('loginRepoCred','get',this.repoId,true).then(
				res => {
					if(res.payload === null)
						return;

					const dataKeyEnc = res.payload.dataKeyEnc;
					const passEnc    = res.payload.dataPassEnc;
					const userEnc    = res.payload.dataUserEnc;
					
					this.rsaDecrypt(this.loginPrivateKey, dataKeyEnc).then(
						dataKey => {
							Promise.all([
								this.aesGcmDecryptBase64WithPhrase(passEnc,dataKey),
								this.aesGcmDecryptBase64WithPhrase(userEnc,dataKey)
							]).then(
								res => {
									this.repoCredPass  = res[0];
									this.repoCredUser  = res[1];
									this.isRepoCredSet = true
								},
								console.warn
							);
						},
						console.warn
					);
				},
				this.$root.genericError
			);
		},
		resetRepoCred() {
			ws.send('loginRepoCred','del',this.repoId,true).then(
				() => {
					this.repoCredPass  = '';
					this.repoCredUser  = '';
					this.isRepoCredSet = false;
				},
				this.$root.genericError
			);
		},
		setRepoCred() {
			if(!this.repoAsE2ee)
				return this.isRepoCredSet = true;

			const dataKey = this.getRandomString(this.keyLength);
			Promise.all([
				this.rsaEncrypt(this.loginPublicKey,dataKey),
				this.aesGcmEncryptBase64WithPhrase(this.repoCredPass,dataKey),
				this.aesGcmEncryptBase64WithPhrase(this.repoCredUser,dataKey)
			]).then(
				res => {
					ws.send('loginRepoCred','set',{
						dataKeyEnc:res[0],
						dataPassEnc:res[1],
						dataUserEnc:res[2],
						repoId:this.repoId
					},true).then(
						() => this.isRepoCredSet = true,
						this.$root.genericError
					);
				},
				this.$root.genericError
			);
		},

		// module validation
		checkModule() {
			if(this.moduleId !== null) {
				ws.send('module','checkChange',this.moduleId,true).then(
					res => this.moduleIdMapChanged = res.payload.moduleIdMapChanged,
					this.$root.genericError
				);
			}
		},

		// export key
		resetKey() {
			ws.send('loginExportKey','del',{},true).then(
				() => this.isExportKeySet = false,
				this.$root.genericError
			);
		},
		setKey() {
			if(!this.exportKeyPrivate.includes('-----BEGIN RSA PRIVATE KEY-----'))
				return this.$store.commit('dialog',{captionBody:this.capApp.dialog.exportKeyBad});

			if(!this.exportKeyPrivateAsE2ee)
				return this.setKeyForExport();

			// use E2EE to store export key for login
			if(!this.isE2eeReady)
				return this.$store.commit('dialog',{captionBody:this.capApp.dialog.e2eeNotReady});
			
			const dataKey = this.getRandomString(this.keyLength);
			Promise.all([
				this.aesGcmEncryptBase64WithPhrase(this.exportKeyPrivate,dataKey),
				this.rsaEncrypt(this.loginPublicKey,dataKey)
			]).then(
				res => {
					ws.send('loginExportKey','set',{dataEnc:res[0],dataKeyEnc:res[1]},true).then(
						this.setKeyForExport,
						this.$root.genericError
					);
				},
				this.$root.genericError
			);
		},
		setKeyForExport() {
			ws.send('transfer','storeExportKey',this.exportKeyPrivate,true).then(
				() => {
					this.isExportKeySet   = true;
					this.exportKeyPrivate = '';
				},
				this.$root.genericError
			);
		}
	}
};