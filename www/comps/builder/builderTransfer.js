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

export default {
	name:'my-builder-transfer',
	components:{MyModuleSelect},
	template:`<div class="contentBox grow">
		<div class="content flex column gap default-inputs">
			<div class="column gap">
				<my-label
					:caption="capApp.selectModule"
					:image="id === null ? 'question.png' : 'ok.png'"
					:large="true"
				/>
				<my-module-select
					v-model="id"
					@update:modelValue="check"
					:allowEmpty="true"
					:preSelectOne="false"
				/>
			</div>

			<template v-if="id !== null">

				<!-- change state -->
				<div class="column gap">
					<my-label
						:caption="changesOk ? capApp.moduleChangesOk1 : capApp.moduleChangesOk0"
						:image="changesOk ? 'ok.png' : 'question.png'"
						:large="true"
					/>
					<table class="generic-table bright noGrow input-custom" v-if="!changesOk">
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
									<td>
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
				<div class="column gap">
					<my-label
						:caption="isKeySet ? capApp.keyEntryOk1 : capApp.keyEntryOk0"
						:image="isKeySet ? 'ok.png' : 'question.png'"
						:large="true"
					/>
					
					<textarea
						v-if="!isKeySet"
						v-model="exportKeyPrivate"
						:placeholder="capApp.exportPrivateKeyHint"
					></textarea>
					
					<div class="row gap">
						<my-button image="ok.png"
							v-if="!isKeySet"
							@trigger="setKey"
							:active="exportKeyPrivate !== ''"
							:caption="capGen.button.ok"
						/>
						<my-button-check
							v-if="!isKeySet"
							v-model="exportKeyPrivateAsE2ee"
							:caption="capApp.button.storeE2ee"
						/>
						<my-button image="cancel.png"
							v-if="isKeySet"
							@trigger="isKeySet = false"
							:caption="capGen.button.reset"
						/>
					</div>
				</div>

				<!-- start transfer -->
				<div class="column gap">
					<my-label image="box.png" :caption="capApp.transferStart" :large="true" />
					<select v-model="method">
						<option v-for="m in methods" :value="m">{{ capApp.option.method[m] }}</option>
					</select>
					<div class="row gap">
						<a target="_blank" v-if="method === 'fileDownload'" :href="href" :download="hrefName">
							<my-button image="download.png"
								:active="isKeySet && changesOk"
								:caption="capGen.button.ok"
							/>
						</a>
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
		href:       s => !s.isKeySet || !s.changesOk ? null : `/export/${s.hrefName}?token=${s.token}&module_id=${s.id}&date=${Math.floor(new Date().getTime() / 1000)}`,
		hrefName:   s => `${s.module.name}_${s.module.releaseBuild}.rei3`,
		isE2eeReady:s => s.loginEncEnabled && !s.loginEncLocked,
		methods:    s => ['fileDownload','repoUpload'],
		
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
		module:         s => s.moduleIdMap[s.id] !== undefined ? s.moduleIdMap[s.id] : false,
		moduleIdMapMeta:s => s.$store.getters.moduleIdMapMeta
	},
	data() {
		return {
			exportKeyPrivate:'',
			exportKeyPrivateAsE2ee:false,
			id:null,
			isKeySet:false,
			method:'fileDownload',
			moduleIdMapChanged:null
		};
	},
	mounted() {
		if(this.isE2eeReady) {
			// fetch stored export key for current login
			ws.send('login','getExportKey',{},true).then(
				res => {
					if(res.payload.dataEnc === '')
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

		// actions
		addVersion(moduleId) {
			ws.send('transfer','addVersion',moduleId,true).then(
				() => {
					ws.send('schema','reload',{moduleId},true).then(
						this.check,
						this.$root.genericError
					);
				},
				this.$root.genericError
			);
		},
		check() {
			if(this.id !== null) {
				ws.send('module','checkChange',this.id,true).then(
					res => this.moduleIdMapChanged = res.payload.moduleIdMapChanged,
					this.$root.genericError
				);
			}
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
					ws.send('login','setExportKey',{dataEnc:res[0],dataKeyEnc:res[1]},true).then(
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
					this.isKeySet         = true;
					this.exportKeyPrivate = '';
				},
				this.$root.genericError
			);
		}
	}
};