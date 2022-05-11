import {getUnixFormat} from '../shared/time.js';
export {MyAdminLicense as default};

let MyAdminLicense = {
	name:'my-admin-license',
	template:`<div class="admin-license contentBox grow">
		
		<div class="top">
			<div class="area">
				<img class="icon" src="images/key.png" />
				<h1>{{ menuTitle }}</h1>
			</div>
		</div>
		<div class="top lower"></div>
		
		<div class="content">
			
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
				<img src="images/logo_license.png" />
			</div>
			
			<span v-if="!licenseInstalled">
				{{ capApp.licenseEmpty }}
			</span>
			
			<span v-if="licenseInstalled && licenseValid" class="valid">
				{{ capApp.licenseValid.replace('{COUNT}',this.licenseDays) }}
			</span>
			
			<span v-if="licenseInstalled && !licenseValid" class="invalid">
				{{ capApp.licenseExpired }}
			</span>
			
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
		licenseInstalled:function() {
			return this.license.validUntil !== 0;
		},
		
		// stores
		token:       function() { return this.$store.getters['local/token']; },
		capApp:      function() { return this.$store.getters.captions.admin.license; },
		license:     function() { return this.$store.getters.license; },
		licenseDays: function() { return this.$store.getters.licenseDays; },
		licenseValid:function() { return this.$store.getters.licenseValid; },
		settings:    function() { return this.$store.getters.settings; }
	},
	methods:{
		// externals
		getUnixFormat,
		
		// backend calls
		get:function() {
			ws.send('license','get',{},true).then(
				res => this.$store.commit('license',res.payload),
				this.$root.genericError
			);
		},
		set:function(evt) {
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