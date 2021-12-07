import {set as setSetting} from './shared/settings.js';
export {MySettings as default};

let MySettingsSecurity = {
	name:'my-settings-security',
	template:`<div>
		<table class="default-inputs">
			<tbody>
				<!-- pw change -->
				<tr>
					<td>{{ capGen.username }}</td>
					<td>	<input disabled="disabled" :value="loginName" /></td>
				</tr>
				<tr>
					<td>{{ capApp.pwOld }}</td>
					<td>	<input v-model="pwOld" @input="messageClear" type="password" /></td>
				</tr>
				<tr>
					<td>{{ capApp.pwNew0 }}</td>
					<td>	<input v-model="pwNew0" @input="messageClear" type="password" /></td>
				</tr>
				<tr>
					<td>{{ capApp.pwNew1 }}</td>
					<td>	<input v-model="pwNew1" @input="messageClear" type="password" /></td>
				</tr>
			</tbody>
		</table>
		
		<div>
			<my-button image="save.png" class="right spaced"
				@trigger="set"
				:active="canSave"
				:caption="capGen.button.save"
			/>
		</div>
		
		<div class="message" v-if="messageOutput !== ''">{{ messageOutput }}</div>
	</div>`,
	data:function() {
		return {
			message:'',
			pwNew0:'',
			pwNew1:'',
			pwOld:''
		};
	},
	computed:{
		canSave:function() {
			return this.pwMatch && this.pwNew0.length !== 0 && this.pwOld.length !== 0;
		},
		pwMatch:function() {
			return this.pwNew0 === this.pwNew1;
		},
		messageOutput:function() {
			if(this.message !== '')
				return this.message;
			
			if(this.pwNew0 !== '' && !this.pwMatch)
				return this.capApp.messagePwDiff;
			
			return '';
		},
		
		// stores
		loginName:function() { return this.$store.getters.loginName; },
		capApp:   function() { return this.$store.getters.captions.settings.security; },
		capGen:   function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		// actions
		messageClear:function() {
			this.message = '';
		},
		
		// backend calls
		set:function() {
			let trans = new wsHub.transactionBlocking();
			trans.add('password','set',{
				pwNew0:this.pwNew0,
				pwNew1:this.pwNew1,
				pwOld:this.pwOld
			},this.setOk);
			trans.send(this.$root.genericError);
		},
		setOk:function(res) {
			switch(res.payload.code){
				case 'PW_CURRENT_WRONG':    this.message = this.capApp.messagePwCurrentWrong; break;
				case 'PW_REQUIRES_DIGIT':   this.message = this.capApp.messagePwRequiresDigit; break;
				case 'PW_REQUIRES_LOWER':   this.message = this.capApp.messagePwRequiresLower; break;
				case 'PW_REQUIRES_SPECIAL': this.message = this.capApp.messagePwRequiresSpecial; break;
				case 'PW_REQUIRES_UPPER':   this.message = this.capApp.messagePwRequiresUpper; break;
				case 'PW_TOO_SHORT':        this.message = this.capApp.messagePwShort; break;
			}
			this.pwNew0 = '';
			this.pwNew1 = '';
			this.pwOld  = '';
		}
	}
};

let MySettings = {
	name:'my-settings',
	components:{MySettingsSecurity},
	template:`<div class="settings">
		
		<div class="contentBox grow">
			<div class="top">
				<div class="area">
					<img class="icon" src="images/person.png" />
					<h1>{{ capApp.pageTitle }}</h1>
				</div>
				<div class="area">
					<my-button image="logoff.png"
						@trigger="$emit('logout')"
						:cancel="true"
						:caption="capApp.button.logout"
						:darkBg="true"
					/>
				</div>
			</div>
			<div class="content no-padding">
			
				<!-- display -->
				<div class="contentPart short">
					<div class="contentPartHeader">
						<img class="icon" src="images/visible1.png" />
						<h1>{{ capApp.titleDisplay }}</h1>
					</div>
					<table class="default-inputs">
						<tbody>
							<tr>
								<td>{{ capApp.languageCode }}</td>
								<td>
									<select v-model="settingsInput.languageCode">
										<option
											v-for="l in languageCodes"
											:value="l"
										>{{ l }}</option>
									</select>
								</td>
							</tr>
							<tr>
								<td>{{ capApp.dateFormat }}</td>
								<td>
									<select v-model="settingsInput.dateFormat">
										<option value="Y-m-d">{{ capApp.dateFormat0 }}</option>
										<option value="Y/m/d">{{ capApp.dateFormat1 }}</option>
										<option value="d.m.Y">{{ capApp.dateFormat2 }}</option>
										<option value="d/m/Y">{{ capApp.dateFormat3 }}</option>
										<option value="m/d/Y">{{ capApp.dateFormat4 }}</option>
									</select>
								</td>
							</tr>
							<tr>
								<td>{{ capApp.sundayFirstDow }}</td>
								<td><my-bool v-model="settingsInput.sundayFirstDow" /></td>
							</tr>
							<tr>
								<td>{{ capApp.warnUnsaved }}</td>
								<td><my-bool v-model="settingsInput.warnUnsaved" /></td>
							</tr>
						</tbody>
					</table>
				</div>
				
				<!-- theme -->
				<div class="contentPart short">
					<div class="contentPartHeader">
						<img class="icon" src="images/layout.png" />
						<h1>{{ capApp.titleTheme }}</h1>
					</div>
					<table class="default-inputs">
						<tbody>
							<tr>
								<td>{{ capApp.headerCaptions }}</td>
								<td><my-bool v-model="settingsInput.headerCaptions" /></td>
							</tr>
							<tr>
								<td>{{ capApp.bordersAll }}</td>
								<td><my-bool v-model="settingsInput.bordersAll" /></td>
							</tr>
							<tr>
								<td>{{ capApp.bordersCorners }}</td>
								<td>
									<select v-model="settingsInput.bordersCorner">
										<option value="keep"   >{{ capApp.option.cornerKeep }}</option>
										<option value="rounded">{{ capApp.option.cornerRounded }}</option>
										<option value="squared">{{ capApp.option.cornerSquared }}</option>
									</select>
								</td>
							</tr>
							<tr>
								<td>{{ capApp.fontSize }}</td>
								<td>
									<select v-model="settingsInput.fontSize">
										<option v-for="i in 11"
											:value="70 + (i*5)"
										>{{ (70 + (i*5)) + '%' }}</option>
									</select>
								</td>
							</tr>
							<tr>
								<td>{{ capApp.spacing }}</td>
								<td>
									<select v-model.number="settingsInput.spacing">
										<option :value="1">{{ capGen.option.size0 }}</option>
										<option :value="2">{{ capGen.option.size1 }}</option>
										<option :value="3">{{ capGen.option.size2 }}</option>
										<option :value="4">{{ capGen.option.size3 }}</option>
										<option :value="5">{{ capGen.option.size4 }}</option>
									</select>
								</td>
							</tr>
							<tr>
								<td>{{ capApp.dark }}</td>
								<td><my-bool v-model="settingsInput.dark" /></td>
							</tr>
							<tr>
								<td>{{ capApp.compact }}</td>
								<td><my-bool v-model="settingsInput.compact" /></td>
							</tr>
							<tr v-if="!settingsInput.compact">
								<td>{{ capApp.pageLimit }}</td>
								<td>
									<div class="settings-page-limit">
										<my-button image="remove.png"
											@trigger="settingsInput.pageLimit -= 50"
											:active="settingsInput.pageLimit > 1200"
										/>
										<div>{{ settingsInput.pageLimit + 'px' }}</div>
										<my-button image="add.png"
											@trigger="settingsInput.pageLimit += 50"
										/>
									</div>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
				
				<!-- admin -->
				<div class="contentPart short" v-if="isAdmin">
					<div class="contentPartHeader">
						<img class="icon" src="images/settings.png" />
						<h1>{{ capApp.titleAdmin }}</h1>
					</div>
					<table class="default-inputs">
						<tbody>
							<tr>
								<td>{{ capApp.hintFirstSteps }}</td>
								<td><my-bool v-model="settingsInput.hintFirstSteps" /></td>
							</tr>
						</tbody>
					</table>
				</div>
				
				<!-- security -->
				<div class="contentPart short">
					<div class="contentPartHeader">
						<img class="icon" src="images/lock.png" />
						<h1>{{ capApp.titleSecurity }}</h1>
					</div>
					<my-settings-security />
				</div>
			</div>
		</div>
	</div>`,
	emits:['logout'],
	data:function() {
		return {
			settingsInput:{},
			settingsLoaded:false
		};
	},
	watch:{
		settingsInput:{
			handler:function() {
				if(this.settingsLoaded)
					this.setSetting(this.settingsInput);
			},
			deep:true
		}
	},
	computed:{
		// stores
		languageCodes:function() { return this.$store.getters['schema/languageCodes']; },
		capGen:       function() { return this.$store.getters.captions.generic; },
		capApp:       function() { return this.$store.getters.captions.settings; },
		isAdmin:      function() { return this.$store.getters.isAdmin; },
		settings:     function() { return this.$store.getters.settings; }
	},
	mounted:function() {
		this.settingsInput = JSON.parse(JSON.stringify(this.settings));
		this.$store.commit('moduleColor1','');
		this.$store.commit('pageTitle',this.capApp.pageTitle);
		
		this.$nextTick(function() {
			this.settingsLoaded = true;
		});
	},
	methods:{
		// externals
		setSetting
	}
};