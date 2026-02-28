import {MyModuleSelect} from '../input.js';
import srcBase64Icon    from '../shared/image.js';
import {getCaption}     from '../shared/language.js';

export default {
	name:'my-builder-transfer',
	components:{MyModuleSelect},
	template:`<div class="contentBox grow">
		<div class="content flex column gap default-inputs">
			<div class="column gap">
				<my-label image="module.png" :caption="capApp.selectModule" :large="true" />
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
						:image="changesOk ? 'ok.png' : 'warning.png'"
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
						:image="isKeySet ? 'ok.png' : 'warning.png'"
						:large="true"
					/>
					
					<template v-if="!isKeySet">
						<textarea
							v-model="privateKey"
							:placeholder="capApp.exportPrivateKeyHint"
						></textarea>
						
						<div class="row gap">
							<my-button image="ok.png"
								@trigger="setKey"
								:active="privateKey !== ''"
								:caption="capGen.button.ok"
							/>
						</div>
					</template>
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
				console.log(id,s.moduleIdMapChanged[id]);
				if(s.moduleIdMapChanged[id] && s.moduleIdMapMeta[id].owner)
					out.push(id);
			}
			return out;
		},

		// simple
		changesOk:s => s.moduleIdsChanged.length === 0,
		href:     s => !s.isKeySet || !s.changesOk ? null : `/export/${s.hrefFileName}?token=${s.token}&module_id=${s.id}&date=${Math.floor(new Date().getTime() / 1000)}`,
		hrefName: s => `${s.module.name}_${s.module.releaseBuild}.rei3`,
		methods:  s => ['fileDownload','repoUpload'],
		
		// stores
		token:          s => s.$store.getters['local/token'],
		modules:        s => s.$store.getters['schema/modules'],
		moduleIdMap:    s => s.$store.getters['schema/moduleIdMap'],
		capApp:         s => s.$store.getters.captions.builder.transfer,
		capGen:         s => s.$store.getters.captions.generic,
		module:         s => s.moduleIdMap[s.id] !== undefined ? s.moduleIdMap[s.id] : false,
		moduleIdMapMeta:s => s.$store.getters.moduleIdMapMeta
	},
	data() {
		return {
			privateKey:'',
			id:null,
			isKeySet:false,
			method:'fileDownload',
			moduleIdMapChanged:null
		};
	},
	methods:{
		// externals
		getCaption,
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
			if(!this.privateKey.includes('-----BEGIN RSA PRIVATE KEY-----'))
				return this.$store.commit('dialog',{
					captionBody:this.capApp.exportKeyBad,
					buttons:[{
						cancel:true,
						caption:this.capGen.button.cancel,
						image:'cancel.png'
					}]
				});
			
			ws.send('transfer','storeExportKey',this.privateKey,true).then(
				() => this.isKeySet = true,
				this.$root.genericError
			);
		}
	}
};