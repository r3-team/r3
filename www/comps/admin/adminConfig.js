import {getBuildFromVersion} from '../shared/generic.js';
import {srcBase64}           from '../shared/image.js';
export {MyAdminConfig as default};

let MyAdminConfig = {
	name:'my-admin-config',
	components:{
		'chrome-picker':VueColor.Chrome
	},
	template:`<div class="contentBox admin-config" v-if="ready">
		<div class="top">
			<div class="area">
				<img class="icon" src="images/server.png" />
				<h1>{{ capApp.title }}</h1>
			</div>
		</div>
		<div class="top lower">
			<div class="area">
				<my-button image="save.png"
					@trigger="set"
					:active="hasChanges"
					:caption="capApp.button.apply"
				/>
				<my-button image="refresh.png"
					@trigger="configInput = JSON.parse(JSON.stringify(config))"
					:active="hasChanges"
					:caption="capGen.button.refresh"
				/>
			</div>
		</div>
		
		<div class="content no-padding">
			
			<!-- general -->
			<div class="contentPart">
				<div class="contentPartHeader">
					<img class="icon" src="images/settings.png" />
					<h1>{{ capApp.titleGeneral }}</h1>
				</div>
				
				<table class="default-inputs">
					<tr>
						<td>{{ capApp.appVersion }}</td>
						<td>{{ appVersion }}</td>
					</tr>
					<tr>
						<td>{{ capApp.updateCheck }}</td>
						<td v-if="updateCheckText !== capApp.updateCheckOlder">
							{{ updateCheckText }}
						</td>
						<td v-else>
							<a href="https://rei3.de/download" target="_blank">{{ updateCheckText }}</a>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.licenseState }}</td>
						<td v-if="licenseValid">{{ capApp.licenseStateOk.replace('{COUNT}',this.licenseDays) }}</td>
						<td v-if="!licenseValid">{{ capApp.licenseStateNok }}</td>
					</tr>
					<tr>
						<td>{{ capApp.publicHostName }}</td>
						<td><input v-model="configInput.publicHostName" /></td>
					</tr>
					<tr>
						<td>{{ capApp.defaultLanguageCode }}</td>
						<td>
							<select v-model="configInput.defaultLanguageCode">
								<option v-for="l in languageCodes" :value="l">
									{{ l }}
								</option>
							</select>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.productionMode }}</td>
						<td>
							<my-bool-string-number
								v-model="configInput.productionMode"
								@update:modelValue="informProductionMode"
								:reversed="true"
								:readonly="configInput.builderMode === '1'"
							/>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.builderMode }}</td>
						<td>
							<my-bool-string-number
								v-model="configInput.builderMode"
								@update:modelValue="informBuilderMode"
								:readonly="configInput.productionMode === '1'"
							/>
						</td>
					</tr>
				</table>
			</div>
			
			<!-- application -->
			<div class="contentPart">
				<div class="contentPartHeader">
					<img class="icon" src="images/edit.png" />
					<h1>{{ capApp.titleCustom }}</h1>
				</div>
				
				<div v-if="!licenseValid" class="license-required">
					{{ capGen.licenseRequired }}
				</div>
				
				<table class="default-inputs">
					<tr>
						<td>{{ capApp.appName }}</td>
						<td><input :disabled="!activated" v-model="configInput.appName" /></td>
					</tr>
					<tr>
						<td>{{ capApp.appNameShort }}</td>
						<td><input :disabled="!activated" v-model="configInput.appNameShort" /></td>
					</tr>
					<tr>
						<td>{{ capApp.companyName }}</td>
						<td><input :disabled="!activated" v-model="configInput.companyName" /></td>
					</tr>
					<tr>
						<td>{{ capApp.companyColorLogin }}</td>
						<td>
							<div class="colorInputWrap">
								<input v-model="configInput.companyColorLogin"
									:disabled="!activated"
									:placeholder="capApp.colorHint"
								/>
								<div class="preview clickable"
									v-if="activated"
									@click="showColorLogin = !showColorLogin"
									:style="'background-color:#'+configInput.companyColorLogin"
								></div>
							</div>
							
							<chrome-picker
								v-if="showColorLogin"
								@update:modelValue="applyColor('login',$event)"
								:disableAlpha="true"
								:disableFields="true"
								:modelValue="configInput.companyColorLogin"
							/>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.companyColorHeader }}</td>
						<td>
							<div class="colorInputWrap">
								<input v-model="configInput.companyColorHeader"
									:disabled="!activated"
									:placeholder="capApp.colorHint"
								/>
								<div class="preview clickable"
									v-if="activated"
									@click="showColorHeader = !showColorHeader"
									:style="'background-color:#'+configInput.companyColorHeader"
								></div>
							</div>
							
							<chrome-picker
								v-if="showColorHeader"
								@update:modelValue="applyColor('header',$event)"
								:disableAlpha="true"
								:disableFields="true"
								:modelValue="configInput.companyColorHeader"
							/>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.companyWelcome }}</td>
						<td>
							<textarea class="companyWelcome"
								v-model="configInput.companyWelcome"
								:disabled="!activated"
							></textarea>
						</td>
					</tr>
					<tr>
						<td>
							{{ capApp.companyLogo }}
							<br />
							{{ capApp.companyLogoDesc }}
						</td>
						<td>
							<img class="logo"
								v-if="configInput.companyLogo !== ''"
								:src="srcBase64(configInput.companyLogo)"
							/>
							<br />
							<input type="file"
								v-if="configInput.companyLogo === ''"
								@change="applyLogo"
								:disabled="!activated"
							/>
							<my-button image="cancel.png"
								@trigger="configInput.companyLogo = ''"
								v-if="configInput.companyLogo !== ''"
								:cancel="true"
								:caption="capApp.button.removeLogo"
							/>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.companyLogoUrl }}</td>
						<td>
							<input
								v-model="configInput.companyLogoUrl"
								:disabled="!activated"
								:placeholder="capApp.companyLogoUrlDesc"
							/>
						</td>
					</tr>
				</table>
			</div>
			
			<!-- security -->
			<div class="contentPart">
				<div class="contentPartHeader">
					<img class="icon" src="images/admin.png" />
					<h1>{{ capApp.titleLogins }}</h1>
				</div>
				
				<table class="default-inputs">
					<tr>
						<td>{{ capApp.tokenExpiryHours }}</td>
						<td><input v-model="configInput.tokenExpiryHours" /></td>
					</tr>
					<tr>
						<td colspan="2"><br /><h3>{{ capApp.pwTitle }}</h3></td>
					</tr>
					<tr>
						<td>{{ capApp.pwLengthMin }}</td>
						<td><input v-model="configInput.pwLengthMin" /></td>
					</tr>
					<tr>
						<td>{{ capApp.pwForceDigit }}</td>
						<td>
							<my-bool-string-number
								v-model="configInput.pwForceDigit"
							/>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.pwForceLower }}</td>
						<td>
							<my-bool-string-number
								v-model="configInput.pwForceLower"
							/>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.pwForceUpper }}</td>
						<td>
							<my-bool-string-number
								v-model="configInput.pwForceUpper"
							/>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.pwForceSpecial }}</td>
						<td>
							<my-bool-string-number
								v-model="configInput.pwForceSpecial"
							/>
						</td>
					</tr>
				</table>
			</div>
			
			<!-- logging -->
			<div class="contentPart">
				<div class="contentPartHeader">
					<img class="icon" src="images/log.png" />
					<h1>{{ capApp.titleLogging }}</h1>
				</div>
				
				<table class="default-inputs">
					<tr>
						<td>{{ capApp.logLevelServer }}</td>
						<td>
							<select v-model="configInput.logServer">
								<option value="1">{{ capApp.logLevel1 }}</option>
								<option value="2">{{ capApp.logLevel2 }}</option>
								<option value="3">{{ capApp.logLevel3 }}</option>
							</select>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.logLevelApplication }}</td>
						<td>
							<select v-model="configInput.logApplication">
								<option value="1">{{ capApp.logLevel1 }}</option>
								<option value="2">{{ capApp.logLevel2 }}</option>
								<option value="3">{{ capApp.logLevel3 }}</option>
							</select>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.logLevelCache }}</td>
						<td>
							<select v-model="configInput.logCache">
								<option value="1">{{ capApp.logLevel1 }}</option>
								<option value="2">{{ capApp.logLevel2 }}</option>
								<option value="3">{{ capApp.logLevel3 }}</option>
							</select>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.logLevelCsv }}</td>
						<td>
							<select v-model="configInput.logCsv">
								<option value="1">{{ capApp.logLevel1 }}</option>
								<option value="2">{{ capApp.logLevel2 }}</option>
								<option value="3">{{ capApp.logLevel3 }}</option>
							</select>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.logLevelMail }}</td>
						<td>
							<select v-model="configInput.logMail">
								<option value="1">{{ capApp.logLevel1 }}</option>
								<option value="2">{{ capApp.logLevel2 }}</option>
								<option value="3">{{ capApp.logLevel3 }}</option>
							</select>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.logLevelLdap }}</td>
						<td>
							<select v-model="configInput.logLdap">
								<option value="1">{{ capApp.logLevel1 }}</option>
								<option value="2">{{ capApp.logLevel2 }}</option>
								<option value="3">{{ capApp.logLevel3 }}</option>
							</select>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.logLevelTransfer }}</td>
						<td>
							<select v-model="configInput.logTransfer">
								<option value="1">{{ capApp.logLevel1 }}</option>
								<option value="2">{{ capApp.logLevel2 }}</option>
								<option value="3">{{ capApp.logLevel3 }}</option>
							</select>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.logLevelBackup }}</td>
						<td>
							<select v-model="configInput.logBackup">
								<option value="1">{{ capApp.logLevel1 }}</option>
								<option value="2">{{ capApp.logLevel2 }}</option>
								<option value="3">{{ capApp.logLevel3 }}</option>
							</select>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.logLevelScheduler }}</td>
						<td>
							<select v-model="configInput.logScheduler">
								<option value="1">{{ capApp.logLevel1 }}</option>
								<option value="2">{{ capApp.logLevel2 }}</option>
								<option value="3">{{ capApp.logLevel3 }}</option>
							</select>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.logLevelCluster }}</td>
						<td>
							<select v-model="configInput.logCluster">
								<option value="1">{{ capApp.logLevel1 }}</option>
								<option value="2">{{ capApp.logLevel2 }}</option>
								<option value="3">{{ capApp.logLevel3 }}</option>
							</select>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.logsKeepDays }}</td>
						<td><input v-model="configInput.logsKeepDays" /></td>
					</tr>
				</table>
			</div>
			
			<!-- performance -->
			<div class="contentPart">
				<div class="contentPartHeader">
					<img class="icon" src="images/speedmeter.png" />
					<h1>{{ capApp.titlePerformance }}</h1>
				</div>
				
				<table class="default-inputs">
					<tr>
						<td>{{ capApp.dbTimeoutDataWs }}</td>
						<td><input class="short"
							v-model="configInput.dbTimeoutDataWs"
							:placeholder="capApp.dbTimeoutHint"
						/></td>
					</tr>
					<tr>
						<td>{{ capApp.dbTimeoutDataRest }}</td>
						<td><input class="short"
							v-model="configInput.dbTimeoutDataRest"
							:placeholder="capApp.dbTimeoutHint"
						/></td>
					</tr>
					<tr>
						<td>{{ capApp.dbTimeoutCsv }}</td>
						<td><input class="short"
							v-model="configInput.dbTimeoutCsv"
							:placeholder="capApp.dbTimeoutHint"
						/></td>
					</tr>
					<tr>
						<td>{{ capApp.dbTimeoutIcs }}</td>
						<td><input class="short"
							v-model="configInput.dbTimeoutIcs"
							:placeholder="capApp.dbTimeoutHint"
						/></td>
					</tr>
				</table>
			</div>
			
			<!-- ICS -->
			<div class="contentPart">
				<div class="contentPartHeader">
					<img class="icon" src="images/calendar.png" />
					<h1>{{ capApp.titleIcs }}</h1>
				</div>
				
				<table class="default-inputs">
					<tr>
						<td>{{ capApp.icsDownload }}</td>
						<td>
							<my-bool-string-number
								v-model="configInput.icsDownload"
							/>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.icsDaysPre }}</td>
						<td><input v-model="configInput.icsDaysPre" /></td>
					</tr>
					<tr>
						<td>{{ capApp.icsDaysPost }}</td>
						<td><input v-model="configInput.icsDaysPost" /></td>
					</tr>
				</table>
			</div>
			
			<!-- security settings -->
			<div class="contentPart">
				<div class="contentPartHeader">
					<img class="icon" src="images/lock.png" />
					<h1>{{ capApp.bruteforceTitle }}</h1>
				</div>
				
				<table class="default-inputs">
					<tr>
						<td>{{ capApp.bruteforceProtection }}</td>
						<td>
							<my-bool-string-number
								v-model="configInput.bruteforceProtection"
							/>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.bruteforceAttempts }}</td>
						<td><input v-model="configInput.bruteforceAttempts" /></td>
					</tr>
					<tr>
						<td>{{ capApp.bruteforceCountTracked }}</td>
						<td>{{ bruteforceCountTracked }}</td>
					</tr>
					<tr>
						<td>{{ capApp.bruteforceCountBlocked }}</td>
						<td>{{ bruteforceCountBlocked }}</td>
					</tr>
				</table>
			</div>
			
			<!-- backup -->
			<div class="contentPart">
				<div class="contentPartHeader">
					<img class="icon" src="images/backup.png" />
					<h1>{{ capApp.titleBackup }}</h1>
				</div>
				
				<h3 class="backup-note"
					v-if="!system.embeddedDb"
					v-html="capApp.backupEmbeddedNote"
				/>
				
				<template v-if="system.embeddedDb">
					<table class="default-inputs">
						<tr class="backup-dir">
							<td>{{ capApp.backupDir }}</td>
							<td colspan="3">
								<input v-model="configInput.backupDir" />
							</td>
						</tr>
						
						<!-- daily -->
						<tr>
							<td>{{ capApp.backupDaily }}</td>
							<td>
								<my-bool-string-number
									v-model="configInput.backupDaily"
								/>
							</td>
							
							<template v-if="configInput.backupDaily === '1'">
								<td class="versions">{{ capApp.backupCount }}</td>
								<td><input v-model="configInput.backupCountDaily" /></td>
							</template>
						</tr>
						
						<!-- weekly -->
						<tr>
							<td>{{ capApp.backupWeekly }}</td>
							<td>
								<my-bool-string-number
									v-model="configInput.backupWeekly"
								/>
							</td>
							
							<template v-if="configInput.backupWeekly === '1'">
								<td class="versions">{{ capApp.backupCount }}</td>
								<td><input v-model="configInput.backupCountWeekly" /></td>
							</template>
						</tr>
						
						<!-- monthly -->
						<tr>
							<td>{{ capApp.backupMonthly }}</td>
							<td>
								<my-bool-string-number
									v-model="configInput.backupMonthly"
								/>
							</td>
							
							<template v-if="configInput.backupMonthly === '1'">
								<td class="versions">{{ capApp.backupCount }}</td>
								<td><input v-model="configInput.backupCountMonthly" /></td>
							</template>
						</tr>
					</table>
					
					<div class="note">{{ capApp.backupDirNote }}</div>
				</template>
			</div>
			
			<!-- repository -->
			<div class="contentPart">
				<div class="contentPartHeader">
					<img class="icon" src="images/box.png" />
					<h1>{{ capApp.titleRepo }}</h1>
				</div>
				
				<table class="default-inputs">
					<tr>
						<td>{{ capApp.repoUrl }}</td>
						<td><input v-model="configInput.repoUrl" /></td>
					</tr>
					<tr>
						<td>{{ capApp.repoSkipVerify }}</td>
						<td>
							<my-bool-string-number
								v-model="configInput.repoSkipVerify"
							/>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.repoFeedback }}</td>
						<td>
							<my-bool-string-number
								v-model="configInput.repoFeedback"
							/>
						</td>
					</tr>
					<tr>
						<td colspan="2"><br /><h3>{{ capApp.repoKeyManagement }}</h3></td>
					</tr>
					<tr>
						<td>{{ capApp.repoPublicKeys }}</td>
						<td>
							<div class="repo-key" v-for="(key,name) in publicKeys">
								<my-button
									:active="false"
									:caption="name"
									:naked="true"
								/>
								<div>
									<my-button image="search.png"
										@trigger="publicKeyShow(name,key)"
									/>
									<my-button image="cancel.png"
										@trigger="publicKeyRemove(name)"
										:cancel="true"
									/>
								</div>
							</div>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.repoPublicKeyAdd }}</td>
						<td>
							<div class="repo-key-input">
								<input v-model="publicKeyInputName"
									:placeholder="capApp.repoPublicKeyInputNameHint"
								/>
								<textarea v-model="publicKeyInputValue"
									:placeholder="capApp.repoPublicKeyInputValueHint"
								></textarea>
								
								<my-button image="add.png"
									@trigger="publicKeyAdd"
									:active="publicKeyInputName !== '' && publicKeyInputValue !== ''"
									:caption="capGen.button.add"
								/>
							</div>
						</td>
					</tr>
				</table>
			</div>
		</div>
	</div>`,
	props:{
		menuTitle:{ type:String, required:true }
	},
	watch:{
		config:{
			handler:function(v) {
				this.configInput = JSON.parse(JSON.stringify(v));
			},
			immediate:true
		}
	},
	data:function() {
		return {
			ready:false,
			configInput:{},
			bruteforceCountBlocked:0,
			bruteforceCountTracked:0,
			publicKeyInputName:'',
			publicKeyInputValue:'',
			showColorHeader:false,
			showColorLogin:false
		};
	},
	mounted:function() {
		this.get();
		this.$store.commit('pageTitle',this.menuTitle);
	},
	computed:{
		hasChanges:function() {
			return JSON.stringify(this.config) !== JSON.stringify(this.configInput);
		},
		publicKeys:{
			get:function()  { return JSON.parse(this.configInput.repoPublicKeys); },
			set:function(v) { this.configInput.repoPublicKeys = JSON.stringify(v); }
		},
		updateCheckText:function() {
			if(this.config.updateCheckVersion === '')
				return this.capApp.updateCheckUnknown;
			
			let buildNew = this.getBuildFromVersion(this.config.updateCheckVersion);
			let buildOld = this.getBuildFromVersion(this.appVersion);
			
			if(buildNew === buildOld)
				return this.capApp.updateCheckCurrent;
			
			if(buildNew > buildOld)
				return this.capApp.updateCheckOlder;
			
			return this.capApp.updateCheckNewer;
		},
		
		// stores
		activated:    function() { return this.$store.getters['local/activated']; },
		appVersion:   function() { return this.$store.getters['local/appVersion']; },
		token:        function() { return this.$store.getters['local/token']; },
		languageCodes:function() { return this.$store.getters['schema/languageCodes']; },
		modules:      function() { return this.$store.getters['schema/modules']; },
		config:       function() { return this.$store.getters.config; },
		license:      function() { return this.$store.getters.license; },
		licenseDays:  function() { return this.$store.getters.licenseDays; },
		licenseValid: function() { return this.$store.getters.licenseValid; },
		capApp:       function() { return this.$store.getters.captions.admin.config; },
		capGen:       function() { return this.$store.getters.captions.generic; },
		system:       function() { return this.$store.getters.system; }
	},
	methods:{
		// externals
		getBuildFromVersion,
		srcBase64,
		
		applyColor:function(target,value) {
			switch(target) {
				case 'header': this.configInput.companyColorHeader = value.hex.substr(1); break;
				case 'login':  this.configInput.companyColorLogin  = value.hex.substr(1); break;
			}
		},
		applyLogo:function(evt) {
			let that = this;
			let file = evt.target.files[0];
			
			var reader = new FileReader();
			reader.readAsDataURL(file);
			reader.onload = function() {
				that.configInput.companyLogo = reader.result.split(',')[1];
			};
			reader.onerror = function(error) {
				that.$root.genericError(error);
			};
		},
		informBuilderMode:function() {
			if(this.configInput.builderMode === '0')
				return;
			
			this.$store.commit('dialog',{
				captionBody:this.capApp.dialog.builderMode,
				captionTop:this.capApp.dialog.pleaseRead,
				buttons:[{
					caption:this.capGen.button.close,
					cancel:true,
					image:'cancel.png'
				}]
			});
		},
		informProductionMode:function() {
			if(this.configInput.productionMode !== '0')
				return;
			
			this.$store.commit('dialog',{
				captionBody:this.capApp.dialog.productionMode,
				captionTop:this.capApp.dialog.pleaseRead,
				buttons:[{
					caption:this.capGen.button.close,
					cancel:true,
					image:'cancel.png'
				}]
			});
		},
		publicKeyShow:function(name,key) {
			this.$store.commit('dialog',{
				captionBody:key,
				captionTop:name,
				image:'key.png',
				textDisplay:'textarea',
				buttons:[{
					caption:this.capGen.button.close,
					cancel:true,
					image:'cancel.png'
				}]
			});
		},
		publicKeyAdd:function() {
			this.publicKeys[this.publicKeyInputName] = this.publicKeyInputValue;
			this.publicKeys = this.publicKeys;
		},
		publicKeyRemove:function(keyName) {
			if(typeof this.publicKeys[keyName] !== 'undefined')
				delete this.publicKeys[keyName];
			
			this.publicKeys = this.publicKeys;
		},
		
		// backend calls
		get:function() {
			ws.send('bruteforce','get',{},true).then(
				res => {
					this.bruteforceCountBlocked = res.payload.hostsBlocked;
					this.bruteforceCountTracked = res.payload.hostsTracked;
					this.ready = true;
				},
				this.$root.genericError
			);
		},
		set:function() {
			ws.send('config','set',this.configInput,true).then(
				() => {},
				this.$root.genericError
			);
		}
	}
};