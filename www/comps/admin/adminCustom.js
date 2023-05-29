import {textAddTab} from '../shared/generic.js';
import {srcBase64}  from '../shared/image.js';
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
		'chrome-picker':VueColor.Chrome
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
					<td>
						<div class="colorInputWrap">
							<input v-model="configInput.companyColorLogin"
								:disabled="!activated"
								:placeholder="capApp.colorHint"
							/>
							<div class="preview clickable shade"
								v-if="activated"
								@click="showColorLogin = !showColorLogin"
								:style="'background-color:#'+configInput.companyColorLogin"
							>
								<img
									:class="{ active:configInput.companyColorLogin !== '' }"
									:src="showColorLogin ? 'images/pageUp.png' : 'images/pageDown.png'"
								/>
							</div>
							<my-button image="cancel.png"
								@trigger="configInput.companyColorLogin = ''; showColorLogin = false"
								:active="activated && configInput.companyColorLogin !== ''"
								:cancel="true"
							/>
						</div>
						
						<chrome-picker
							v-if="showColorLogin"
							@update:modelValue="applyColor('login',$event)"
							:disableAlpha="true"
							:disableFields="true"
							:modelValue="configInput.companyColorLogin"
						/>
					</td>
					<td>{{ capApp.companyColorLoginHint }}</td>
				</tr>
				<tr>
					<td>{{ capApp.companyColorHeader }}</td>
					<td>
						<div class="colorInputWrap">
							<input v-model="configInput.companyColorHeader"
								:disabled="!activated"
								:placeholder="capApp.colorHint"
							/>
							<div class="preview clickable shade"
								v-if="activated"
								@click="showColorHeader = !showColorHeader"
								:style="'background-color:#'+configInput.companyColorHeader"
							>
								<img
									:class="{ active:configInput.companyColorHeader !== '' }"
									:src="showColorHeader ? 'images/pageUp.png' : 'images/pageDown.png'"
								/>
							</div>
							<my-button image="cancel.png"
								@trigger="configInput.companyColorHeader = ''; showColorHeader = false"
								:active="activated && configInput.companyColorHeader !== ''"
								:cancel="true"
							/>
						</div>
						
						<chrome-picker
							v-if="showColorHeader"
							@update:modelValue="applyColor('header',$event)"
							:disableAlpha="true"
							:disableFields="true"
							:modelValue="configInput.companyColorHeader"
						/>
					</td>
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
		hasChanges:(s) => JSON.stringify(s.config) !== JSON.stringify(s.configInput),
		
		// stores
		activated:(s) => s.$store.getters['local/activated'],
		capApp:   (s) => s.$store.getters.captions.admin.customizing,
		capGen:   (s) => s.$store.getters.captions.generic,
		config:   (s) => s.$store.getters.config
	},
	data() {
		return {
			configInput:{},
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
		reset() {
			this.configInput = JSON.parse(JSON.stringify(this.config));
		},
		
		// backend calls
		set() {
			ws.send('config','set',this.configInput,true).then(
				() => {}, this.$root.genericError
			);
		}
	}
};