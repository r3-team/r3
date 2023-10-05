import {textAddTab}     from '../shared/generic.js';
import {srcBase64}      from '../shared/image.js';
import {MyModuleSelect} from '../input.js';
import MyInputColor     from '../inputColor.js';
export {MyAdminCustom as default};

let MyAdminCustomLogo = {
	name:'my-admin-custom-logo',
	template:`<td>
		<input type="file"
			v-if="!hasValue"
			@change="set"
			:disabled="readonly"
		/>
		
		<div class="row gap" v-if="hasValue">
			<img class="logo" :src="srcBase64(modelValue)" />
			<my-button image="cancel.png"
				@trigger="$emit('update:modelValue','')"
				:active="!readonly"
				:cancel="true"
			/>
		</div>
	</td>`,
	emits:['update:modelValue'],
	props:{
		maxSizeKb: { type:Number,  required:true },
		modelValue:{ type:String,  required:true },
		readonly:  { type:Boolean, required:true }
	},
	computed:{
		hasValue:(s) => s.modelValue !== '',
		
		// stores
		capApp:(s) => s.$store.getters.captions.admin.customizing
	},
	methods:{
		// externals
		srcBase64,
		
		// actions
		set(evt) {
			let file = evt.target.files[0];
			if(Math.floor(file.size/1024) > this.maxSizeKb)
				return this.$root.genericError(this.capApp.error.fileTooLarge.replace('{SIZE}',this.maxSizeKb));
			
			var reader = new FileReader();
			reader.readAsDataURL(file);
			reader.onload = () => this.$emit('update:modelValue',reader.result.split(',')[1]);
			reader.onerror = function(error) {
				that.$root.genericError(error);
			};
		}
	}
};

let MyAdminCustom = {
	name:'my-admin-custom',
	components:{
		MyAdminCustomLogo,
		MyInputColor,
		MyModuleSelect
	},
	template:`<div class="admin-custom contentBox grow">
		<div class="top">
			<div class="area">
				<img class="icon" src="images/colors.png" />
				<h1>{{ menuTitle }}</h1>
			</div>
		</div>
		<div class="top lower">
			<div class="area">
				<my-button image="save.png"
					@trigger="set"
					:active="hasChanges"
					:caption="capGen.button.save"
				/>
				<my-button image="refresh.png"
					@trigger="reset"
					:caption="capGen.button.refresh"
				/>
			</div>
		</div>
		
		<div class="content" v-if="ready">
			
			<div class="contentPartHeader">
				<img class="icon" src="images/languages.png" />
				<h1>{{ capApp.titleCaptions }}</h1>
			</div>
			
			<table class="generic-table-vertical default-inputs">
				<tr>
					<td>{{ capApp.appName }}</td>
					<td><input class="long" :disabled="!activated" v-model="configInput.appName" /></td>
					<td>{{ capApp.appNameHint }}</td>
				</tr>
				<tr>
					<td>{{ capApp.appNameShort }}</td>
					<td><input class="long" :disabled="!activated" v-model="configInput.appNameShort" /></td>
					<td>{{ capApp.appNameShortHint }}</td>
				</tr>
				<tr>
					<td>{{ capApp.companyName }}</td>
					<td><input class="long" :disabled="!activated" v-model="configInput.companyName" /></td>
					<td>{{ capApp.companyNameHint }}</td>
				</tr>
				<tr>
					<td>{{ capApp.companyWelcome }}</td>
					<td>
						<textarea class="companyWelcome long"
							v-model="configInput.companyWelcome"
							:disabled="!activated"
						></textarea>
					</td>
					<td>{{ capApp.companyWelcomeHint }}</td>
				</tr>
			</table>
			
			<br />
			<div class="contentPartHeader">
				<img class="icon" src="images/colors.png" />
				<h1>{{ capApp.titleColors }}</h1>
			</div>
			<table class="generic-table-vertical default-inputs">
				<tr>
					<td>{{ capApp.companyColorLogin }}</td>
					<td><my-input-color v-model="configInput.companyColorLogin" :readonly="!activated" /></td>
					<td>{{ capApp.companyColorLoginHint }}</td>
				</tr>
				<tr>
					<td>{{ capApp.companyColorHeader }}</td>
					<td><my-input-color v-model="configInput.companyColorHeader" :readonly="!activated" /></td>
					<td>{{ capApp.companyColorHeaderHint }}</td>
				</tr>
			</table>
			
			<br />
			<div class="contentPartHeader">
				<img class="icon" src="images/fileImage.png" />
				<h1>{{ capApp.titleLogos }}</h1>
			</div>
			<table class="generic-table-vertical default-inputs">
				<tr>
					<td>{{ capApp.companyLogo }}</td>
					<td>
						<my-admin-custom-logo
							v-model="configInput.companyLogo"
							:maxSizeKb="64"
							:readonly="!activated"
						/>
					</td>
					<td>{{ capApp.companyLogoHint }}</td>
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
					<td>{{ capApp.companyLogoUrlHint }}</td>
				</tr>
			</table>
			
			<br />
			<div class="contentPartHeader">
				<img class="icon" src="images/fileImage.png" />
				<h1>{{ capApp.titlePwas }}</h1>
			</div>
			<table class="generic-table-vertical default-inputs">
				<tr>
					<td>{{ capApp.iconPwa1 }}</td>
					<td>
						<my-admin-custom-logo
							v-model="configInput.iconPwa1"
							:maxSizeKb="128"
							:readonly="!activated"
						/>
					</td>
					<td>{{ capApp.iconPwa1Hint }}</td>
				</tr>
				<tr>
					<td>{{ capApp.iconPwa2 }}</td>
					<td>
						<my-admin-custom-logo
							v-model="configInput.iconPwa2"
							:maxSizeKb="128"
							:readonly="!activated"
						/>
					</td>
					<td>{{ capApp.iconPwa2Hint }}</td>
				</tr>
				<tr>
					<td>{{ capApp.pwaDomain }}</td>
					<td>
						<div class="column gap">
							<div class="row centered gap" v-for="(pd,i) in pwaDomains" :key="pd.moduleId">
								<input
									@keyup="applyPwaDomain(i,'domain',$event.target.value)"
									:disabled="!activated"
									:placeholder="capApp.pwaDomainHint"
									:title="capApp.pwaDomainHint"
									:value="pd.domain"
								/>
								<my-module-select
									v-if="activated"
									@update:modelValue="applyPwaDomain(i,'moduleId',$event)"
									:modelValue="pd.moduleId"
									:moduleIdsFilter="pwaModuleIdsUsed.filter(v => v !== pd.moduleId)"
									:preSelectOne="true"
								/>
								<my-button image="delete.png"
									@trigger="pwaDomainDel(i)"
									:captionTitle="capGen.button.delete"
									:cancel="true"
								/>
							</div>
							<div>
								<my-button image="add.png"
									@trigger="pwaDomainAdd"
									:caption="capGen.button.add"
								/>
							</div>
							<p v-if="pwaDomains.length !== 0">
								{{ capApp.pwaDomainHint2 }}
							</p>
						</div>
					</td>
					<td v-html="capApp.pwaDomainHint1"></td>
				</tr>
			</table>
			
			<br />
			<div class="contentPartHeader">
				<img class="icon" src="images/code.png" />
				<h1>{{ capApp.titleCss }}</h1>
			</div>
			<table class="generic-table-vertical large default-inputs">
				<tr>
					<td colspan="3">
						<textarea class="css"
							v-model="configInput.css"
							@keydown.tab.prevent="configInput.css = textAddTab($event)"
							:disabled="!activated"
						/>
					</td>
				</tr>
			</table>
		</div>
	</div>`,
	emits:['hotkeysRegister'],
	props:{
		menuTitle:{ type:String, required:true }
	},
	computed:{
		hasChanges:(s) => JSON.stringify(s.config) !== JSON.stringify(s.configInput)
			|| JSON.stringify(s.pwaDomainMap) !== JSON.stringify(s.pwaDomainMapInput),
		
		// inputs
		pwaDomains:{
			get() {
				let out = [];
				let domains = Object.keys(this.pwaDomainMapInput);
				domains.sort();
				
				for(let domain of domains) {
					out.push({
						moduleId:this.pwaDomainMapInput[domain],
						domain:domain
					});
				}
				return out;
			},
			set(v) {
				let map = {};
				for(let e of v) {
					map[e.domain] = e.moduleId;
				}
				this.pwaDomainMapInput = map;
			}
		},
		pwaModuleIdsUsed:(s) => {
			let out = [];
			for(let pd of s.pwaDomains) {
				out.push(pd.moduleId);
			}
			return out;
		},
		
		// stores
		activated:   (s) => s.$store.getters['local/activated'],
		modules:     (s) => s.$store.getters['schema/modules'],
		capApp:      (s) => s.$store.getters.captions.admin.customizing,
		capGen:      (s) => s.$store.getters.captions.generic,
		config:      (s) => s.$store.getters.config,
		pwaDomainMap:(s) => s.$store.getters.pwaDomainMap
	},
	data() {
		return {
			// inputs
			configInput:{},
			pwaDomainMapInput:{},
			
			// states
			ready:false,
			showColorHeader:false,
			showColorLogin:false
		};
	},
	mounted() {
		this.reset();
		this.$store.commit('pageTitle',this.menuTitle);
		this.$emit('hotkeysRegister',[{fnc:this.set,key:'s',keyCtrl:true}]);
		this.ready = true;
	},
	unmounted() {
		this.$emit('hotkeysRegister',[]);
	},
	methods:{
		// externals
		textAddTab,
		
		// actions
		applyColor(target,value) {
			switch(target) {
				case 'header': this.configInput.companyColorHeader = value.hex.substr(1); break;
				case 'login':  this.configInput.companyColorLogin  = value.hex.substr(1); break;
			}
		},
		applyPwaDomain(i,target,value) {
			this.pwaDomains[i][target] = value;
			this.pwaDomains = this.pwaDomains;
		},
		pwaDomainAdd() {
			this.pwaDomains.push({
				moduleId:null,
				domain:'my_new_subdomain'
			});
			this.pwaDomains = this.pwaDomains;
		},
		pwaDomainDel(i) {
			this.pwaDomains.splice(i,1);
			this.pwaDomains = this.pwaDomains;
		},
		reset() {
			this.configInput       = JSON.parse(JSON.stringify(this.config));
			this.pwaDomainMapInput = JSON.parse(JSON.stringify(this.pwaDomainMap));
		},
		
		// backend calls
		set() {
			ws.sendMultiple([
				ws.prepare('config','set',this.configInput),
				ws.prepare('pwaDomain','set',this.pwaDomainMapInput)
			],true).then(
				() => {
					// manually update store as its only updated on page refresh
					this.$store.commit('pwaDomainMap',this.pwaDomainMapInput);
					
					// after transaction is through
					ws.send('pwaDomain','reset',{},true);
				},
				this.$root.genericError
			);
		}
	}
};