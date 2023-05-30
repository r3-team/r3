import {getUnixFormat} from '../shared/time.js';
export {MyAdminLicense as default};

let MyAdminLicense = {
	name:'my-admin-license',
	template:`<div class="admin-license contentBox grow">
		
		<div class="top lower">
			<div class="area">
				<img class="icon" src="images/key.png" />
				<h1>{{ menuTitle }}</h1>
			</div>
		</div>
		
		<div class="content">
			
			<template v-if="!licenseInstalled">
				<div class="intro">
					<span v-html="capApp.intro"></span>
					<img src="images/logo_professional.png" />
				</div>
				<h2>{{ capApp.introMore }}</h2>
				<div class="row gap">
					<my-button image="globe.png"
						@trigger="open('https://rei3.de/en/services')"
						:caption="capApp.extLicense"
						:large="true"
					/>
					<my-button image="globe.png"
						@trigger="open('https://community.rei3.de/')"
						:caption="capApp.extCommunity"
						:large="true"
					/>
				</div>
			</template>
			
			<div v-if="licenseInstalled" class="column gap">
				<h2>{{ capApp.active }}</h2>
				<div class="file shade" v-if="licenseInstalled">
					<table>
						<tr>
							<td>{{ capApp.licenseId }}</td>
							<td>{{ license.licenseId }}</td>
						</tr>
						<tr>
							<td>{{ capApp.clientId }}</td>
							<td>{{ license.clientId }}</td>
						</tr>
						<tr>
							<td>{{ capApp.registeredFor }}</td>
							<td>{{ license.registeredFor }}</td>
						</tr>
						<tr>
							<td>{{ capApp.validUntil }}</td>
							<td>{{ getUnixFormat(license.validUntil,settings.dateFormat) }}</td>
						</tr>
					</table>
					<img src="images/logo_license.webp" />
				</div>
				
				<span v-if="licenseValid" class="valid">
					{{ capApp.licenseValid.replace('{COUNT}',this.licenseDays) }}
				</span>
				
				<span v-if="!licenseValid" class="invalid">
					{{ capApp.licenseExpired }}
				</span>
				
				<span>
					<my-button image="cancel.png"
						@trigger="delAsk"
						:cancel="true"
						:caption="capApp.button.delete"
					/>
				</span>
			</div>
			
			<br />
			<br />
			<br />
			<h2>{{ capApp.upload }}</h2>
			<input type="file" @change="set" />
		</div>
	</div>`,
	props:{
		menuTitle:{ type:String, required:true }
	},
	computed:{
		licenseInstalled:(s) => s.license.validUntil !== 0,
		
		// stores
		token:       (s) => s.$store.getters['local/token'],
		capApp:      (s) => s.$store.getters.captions.admin.license,
		capGen:      (s) => s.$store.getters.captions.generic,
		license:     (s) => s.$store.getters.license,
		licenseDays: (s) => s.$store.getters.licenseDays,
		licenseValid:(s) => s.$store.getters.licenseValid,
		settings:    (s) => s.$store.getters.settings
	},
	mounted() {
		this.$store.commit('pageTitle',this.menuTitle);
	},
	methods:{
		// externals
		getUnixFormat,
		
		// actions
		open(url) {
			window.open(url);
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
			ws.send('license','del',{},true).then(
				res => {}, this.$root.genericError
			);
		},
		get() {
			ws.send('license','get',{},true).then(
				res => this.$store.commit('license',res.payload),
				this.$root.genericError
			);
		},
		set(evt) {
			let that = this;
			let formData    = new FormData();
			let httpRequest = new XMLHttpRequest();
			
			httpRequest.upload.onprogress = function(event) {
				if(event.lengthComputable) {
					//
				}
			}
			httpRequest.onload = function(event) {
				let res = JSON.parse(httpRequest.response);
				
				if(res.error !== '')
					return that.$root.genericError('license upload failed');
				
				that.$root.initPublic();
				that.get();
			}
			
			let file = evt.target.files[0];
			formData.append('token',this.token);
			formData.append('file',file);
			httpRequest.open('POST','license/upload',true);
			httpRequest.send(formData);
		}
	}
};