import MyInputColorWrap from './inputColorWrap.js';
import MyInputDateFormat from './inputDateFormat.js';
import MyInputDecimal from './inputDecimal.js';
import MyInputHotkey from './inputHotkey.js';
import MyInputNumberSep from './inputNumberSep.js';
import MyPwChange from './pwChange.js';
import MySettingsEncryption from './settingsEncryption.js';
import MySettingsMfa from './settingsMfa.js';
import srcBase64Icon from './shared/image.js';
import { getCaption } from './shared/language.js';
import { set as setSetting } from './shared/settings.js';
import { getUnixFormat } from './shared/time.js';

const MySettingsClientEvents = {
	name: 'my-settings-client-events',
	components: { MyInputHotkey },
	template: `<div class="settings-client-events">
		<p>{{ capApp.intro }}</p>
		<span v-if="modulesWithClientEvents.length === 0"><i>{{ capApp.noEvents }}</i></span>

		<template v-for="mce in modulesWithClientEvents">
			<div class="row gap centered">
				<img class="module-icon" :src="srcBase64Icon(mce.module.iconId,'images/module.png')" />
				<span>{{ getCaption('moduleTitle',mce.module.id,mce.module.id,mce.module.captions,mce.module.name) }}</span>
			</div>

			<div class="column gap" v-for="ce in mce.clientEvents">
				<span>{{ getCaption('clientEventTitle',ce.moduleId,ce.id,ce.captions) }}</span>

				<div class="row centered gap">
					<my-bool
						@update:modelValue="toggleHotkey(ce,$event)"
						:grow="false"
						:modelValue="clientEventIdMapLogin[ce.id] !== undefined"
					/>
					<my-input-hotkey
						@update:char="set(ce,'char',$event)"
						@update:modifier1="set(ce,'modifier1',$event)"
						@update:modifier2="set(ce,'modifier2',$event)"
						:char="ce.hotkeyChar"
						:modifier1="ce.hotkeyModifier1"
						:modifier2="ce.hotkeyModifier2"
						:readonly="clientEventIdMapLogin[ce.id] === undefined"
					/>
				</div>
			</div>
		</template>
	</div>`,
	data() {
		return {
			clientEventIdMapLogin: {} // map of client events that the login has options for (only hotkeys)
		};
	},
	computed: {
		modulesWithClientEvents: s => {
			const out = [];
			for (const modId in s.moduleIdMap) {
				const mod = s.moduleIdMap[modId];
				const ces = [];

				for (const ce of mod.clientEvents) {
					// only include hotkey events and only if there is access
					if (ce.event !== 'onHotkey' || s.access.clientEvent[ce.id] === undefined)
						continue;

					// overwrite defaults with login options if there
					if (s.clientEventIdMapLogin[ce.id] !== undefined) {
						ce.hotkeyChar = s.clientEventIdMapLogin[ce.id].hotkeyChar;
						ce.hotkeyModifier1 = s.clientEventIdMapLogin[ce.id].hotkeyModifier1;
						ce.hotkeyModifier2 = s.clientEventIdMapLogin[ce.id].hotkeyModifier2;
					}
					ces.push(ce);
				}
				if (ces.length !== 0)
					out.push({
						module: mod,
						clientEvents: ces
					});
			}
			return out;
		},

		// stores
		moduleIdMap: s => s.$store.getters['schema/moduleIdMap'],
		access: s => s.$store.getters.access,
		capApp: s => s.$store.getters.captions.settings.clientEvents,
		capGen: s => s.$store.getters.captions.generic
	},
	mounted() {
		this.get();
	},
	methods: {
		// externals
		getCaption,
		srcBase64Icon,

		// actions
		reloadWithChangedEvents() {
			this.get();

			// inform connected fat clients about updated client events
			ws.send('event', 'clientEventsChanged', {}, false);
		},
		toggleHotkey(clientEvent, state) {
			if (state) this.set(clientEvent, '[noChange]', null);
			else this.del(clientEvent.id);
		},

		// backend calls
		del(id) {
			ws.send('loginClientEvent', 'del', { clientEventId: id }, true).then(
				this.reloadWithChangedEvents,
				this.$root.genericError
			);
		},
		get() {
			ws.send('loginClientEvent', 'get', {}, true).then(
				res => this.clientEventIdMapLogin = res.payload,
				this.$root.genericError
			);
		},
		set(clientEvent, name, value) {
			const lce = {
				hotkeyChar: clientEvent.hotkeyChar,
				hotkeyModifier1: clientEvent.hotkeyModifier1,
				hotkeyModifier2: clientEvent.hotkeyModifier2
			};
			switch (name) {
				case 'char': lce.hotkeyChar = value; break;
				case 'modifier1': lce.hotkeyModifier1 = value; break;
				case 'modifier2': lce.hotkeyModifier2 = value; break;
				case '[noChange]': break; // do not change anything
				default: return;
			}

			ws.send('loginClientEvent', 'set', {
				clientEventId: clientEvent.id,
				loginClientEvent: lce
			}, true).then(
				this.reloadWithChangedEvents,
				this.$root.genericError
			);
		}
	}
};

const MySettingsFixedTokens = {
	name: 'my-settings-fixed-tokens',
	components: { MySettingsMfa },
	template: `<div>
		<div class="settings-tokens" v-if="tokensFixed.length !== 0">
			<table class="generic-table sticky-top bright default-inputs">
				<thead>
					<tr>
						<th>{{ capApp.titleName }}</th>
						<th>{{ capApp.titleContext }}</th>
						<th colspan="2">{{ capApp.titleDateCreate }}</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="t in tokensFixed">
						<td>{{ t.name }}</td>
						<td>
							<my-button
								:active="false"
								:caption="displayContextText(t.context)"
								:image="displayContextIcon(t.context)"
								:naked="true"
							/>
						</td>
						<td><span :title="getUnixFormat(t.dateCreate,'Y-m-d H:i:S')">{{ getUnixFormat(t.dateCreate,'Y-m-d') }}</span></td>
						<td>
							<div class="row">
								<my-button image="delete.png"
									@trigger="delAsk(t.id)"
									:cancel="true"
								/>
							</div>
						</td>
					</tr>
				</tbody>
			</table>
		</div>

		<div class="settings-token-actions">
			<my-button image="screen.png"
				@trigger="showSubWindow('install')"
				:caption="capApp.titleAdd"
			/>
			<my-button image="smartphone.png"
				@trigger="showSubWindow('mfa')"
				:active="isAllowedMfa"
				:caption="capGen.mfa"
			/>
		</div>

		<!-- MFA sub window -->
		<my-settings-mfa
			v-if="showMfa"
			@close="showMfa = false"
			@tokenSet="get"
			:forced="false"
		/>

		<!-- device install sub window -->
		<div class="app-sub-window" v-if="showInstall" @mousedown.self="showInstall = false">
			<div class="contentBox float settings-devices">
				<div class="top lower">
					<div class="area">
						<img class="icon" src="images/screen.png" />
						<div class="caption">{{ capApp.titleAdd }}</div>
					</div>
					<div class="area">
						<my-button
							@trigger="showInstall = false" image="cancel.png"
							:cancel="true"
						/>
					</div>
				</div>

				<div class="settings-devices-header column gap">
					<span>{{ capApp.device.intro0 }}</span>
					<ul>
						<li>{{ capApp.device.intro1 }}</li>
						<li>{{ capApp.device.intro2 }}</li>
					</ul>
					<div class="column gap default-inputs">
						<span>{{ capApp.device.os }}</span>
						<select v-model="deviceOs">
							<option value="amd64_windows">Windows (x64)</option>
							<option value="amd64_linux">Linux (x64)</option>
							<option value="arm64_linux">Linux (ARM64)</option>
							<option value="amd64_mac">MacOS (x64)</option>
						</select>
					</div>
					<template v-if="isAdmin">
						<br />
						<span v-html="capApp.device.adminInfo"></span>
					</template>
				</div>

				<my-tabs
					v-model="tabTarget"
					:entries="['install','update','uninstall']"
					:entriesIcon="['images/screen.png','images/screenRefresh.png','images/screenRemove.png']"
					:entriesText="[capGen.install,capGen.update,capGen.uninstall]"
				/>
				<ol v-if="tabTarget === 'install'">
					<li>
						<div class="column gap default-inputs">
							<span>{{ capApp.device.installStep1 }}</span>
							<div class="row gap">
								<input v-model="tokenName" v-focus :placeholder="capApp.device.nameHint" />
								<my-button image="save.png"
									@trigger="set('client')"
									:active="tokenName !== '' && !tokenSet"
								/>
							</div>
						</div>
					</li>
					<li>
						<div class="column gap">
							<span>{{ capApp.device.installStep2 }}</span>
							<div class="row gap">
								<a target="_blank" :href="tokenSet ? urlApp : null">
									<my-button image="download.png"
										:active="tokenSet"
										:caption="capApp.button.loadApp"
									/>
								</a>
								<a target="_blank" :href="tokenSet ? urlCnf : null">
									<my-button image="download.png"
										:active="tokenSet"
										:caption="capApp.button.loadCnf"
									/>
								</a>
							</div>
						</div>
					</li>
					<li>
						<div class="column">
							<span>{{ capApp.device.installStep3 }}</span>
							<img src="images/install_tray.png" class="settings-install" />
						</div>
					</li>
					<li>{{ capApp.device.installStep4 }}</li>
				</ol>
				<ol v-if="tabTarget === 'update'">
					<li>
						<div class="column gap">
							<span>{{ capApp.device.updateStep1 }}</span>
							<div class="row gap">
								<a target="_blank" :href="urlApp">
									<my-button image="download.png" :caption="capApp.button.loadApp" />
								</a>
							</div>
						</div>
					</li>
					<li>
						<div class="column">
							<span>{{ capApp.device.updateStep2 }}</span>
							<img src="images/install_tray.png" class="settings-install" />
						</div>
					</li>
					<li>{{ capApp.device.updateStep3 }}</li>
				</ol>
				<ol v-if="tabTarget === 'uninstall'">
					<li>
						<div class="column">
							<span>{{ capApp.device.uninstallStep1 }}</span>
							<img src="images/install_tray.png" class="settings-install" />
						</div>
					</li>
					<li>{{ capApp.device.uninstallStep2 }}</li>
				</ol>
			</div>
		</div>
	</div>`,
	data() {
		return {
			tabTarget: "install",
			tokensFixed: [],
			showInstall: false,
			showMfa: false,

			// inputs
			deviceOs: 'amd64_windows',
			tokenFixed: '',
			tokenFixedB32: '',
			tokenIdDel: null, // ID of token to delete (dialog)
			tokenName: ''
		};
	},
	computed: {
		tokenSet: s => s.tokenFixed !== '',
		urlApp: s => `/client/download/?${[`os=${s.deviceOs}`, `token=${s.token}`].join('&')}`,
		urlCnf: s => {
			const langCode = s.languageCodesOfficial.includes(s.languageCode)
				? s.languageCode : 'en_us';

			const isSsl = location.protocol.includes('https');
			let port = location.port;

			// known issue, empty is returned if port is default HTTP(S)
			if (port === null || port === '')
				port = isSsl ? '443' : '80';

			const call = [
				`deviceName=${s.tokenName}`,
				`hostName=${location.hostname}`,
				`hostPort=${port}`,
				`languageCode=${langCode}`,
				`tokenFixed=${s.tokenFixed}`,
				`token=${s.token}`,
				`ssl=${isSsl ? 1 : 0}`
			];
			return `/client/download/config/?${call.join('&')}`;
		},

		// stores
		token: s => s.$store.getters['local/token'],
		capApp: s => s.$store.getters.captions.settings.tokensFixed,
		capGen: s => s.$store.getters.captions.generic,
		isAdmin: s => s.$store.getters.isAdmin,
		isAllowedMfa: s => s.$store.getters.isAllowedMfa,
		languageCode: s => s.$store.getters.settings.languageCode,
		languageCodesOfficial: s => s.$store.getters.constants.languageCodesOfficial,
	},
	mounted() {
		this.get();

		// set default client
		if (navigator.userAgent.includes('Win64')) this.deviceOs = 'amd64_windows';
		else if (navigator.userAgent.includes('WOW64')) this.deviceOs = 'amd64_windows';
		else if (navigator.userAgent.includes('Mac OS')) this.deviceOs = 'amd64_mac';
		else if (navigator.userAgent.includes('Linux x86_64')) this.deviceOs = 'amd64_linux';
		else if (navigator.userAgent.includes('ARM64')) this.deviceOs = 'arm64_linux';
	},
	methods: {
		// externals
		getUnixFormat,

		// actions
		showSubWindow(target) {
			this.tokenFixed = '';
			this.tokenFixedB32 = '';
			this.tokenName = '';
			switch (target) {
				case 'install': this.showInstall = true; break;
				case 'mfa': this.showMfa = true; break;
			}
		},

		// presentation
		displayContextIcon(v) {
			switch (v) {
				case 'client': return 'screen.png';
				case 'ics': return 'calendar.png';
				case 'totp': return 'smartphone.png';
			}
			return '';
		},
		displayContextText(v) {
			switch (v) {
				case 'client': return this.capApp.context.client;
				case 'ics': return this.capApp.context.ics;
				case 'totp': return this.capApp.context.totp;
			}
			return '-';
		},

		// backend calls
		delAsk(id) {
			this.tokenIdDel = id;
			this.$store.commit('dialog', {
				captionBody: this.capApp.message.delete,
				image: 'warning.png',
				buttons: [{
					cancel: true,
					caption: this.capGen.button.delete,
					exec: this.del,
					keyEnter: true,
					image: 'delete.png'
				}, {
					caption: this.capGen.button.cancel,
					keyEscape: true,
					image: 'cancel.png'
				}]
			});
		},
		del() {
			ws.send('login', 'delTokenFixed', { id: this.tokenIdDel }, true).then(
				this.get,
				this.$root.genericError
			);
		},
		get() {
			ws.send('login', 'getTokensFixed', {}, true).then(
				res => this.tokensFixed = res.payload,
				this.$root.genericError
			);
		},
		set(context) {
			ws.send('login', 'setTokenFixed', {
				context: context,
				name: this.tokenName
			}, true).then(
				res => {
					this.tokenFixed = res.payload.tokenFixed;
					this.tokenFixedB32 = res.payload.tokenFixedB32;
					this.get();
				},
				this.$root.genericError
			);
		}
	}
};

export default {
	name: 'my-settings',
	components: {
		MyInputColorWrap,
		MyInputDateFormat,
		MyInputDecimal,
		MyInputNumberSep,
		MyPwChange,
		MySettingsClientEvents,
		MySettingsEncryption,
		MySettingsFixedTokens
	},
	template: `<div class="settings contentBox grow scroll float">
		<div class="top lower">
			<div class="area">
				<img class="icon" src="images/person.png" />
				<h1>{{ capApp.pageTitle }}</h1>
			</div>
			<div class="area">
				<my-button image="logoff.png"
					@trigger="$emit('logout')"
					:cancel="true"
					:caption="capApp.button.logout"
				/>
				<my-button image="cancel.png"
					@trigger="$emit('close')"
					:cancel="true"
					:caption="capGen.button.close"
				/>
			</div>
		</div>
		<div class="content" :style="patternStyle" v-if="settingsLoaded">

			<!-- general -->
			<div class="contentPart">
				<div class="contentPartHeader">
					<img class="icon" src="images/settings.png" />
					<h1>{{ capApp.titleGeneral }}</h1>
				</div>
				<table>
					<tbody>
						<tr class="default-inputs">
							<td>{{ capApp.languageCode }}</td>
							<td>
								<select v-model="settingsInput.languageCode">
									<optgroup :label="capApp.translation.official">
										<option v-for="l in languageCodesOfficial" :value="l">{{ l }}</option>
									</optgroup>
									<optgroup :label="capApp.translation.community">
										<option v-for="l in languageCodes.filter(v => !languageCodesOfficial.includes(v))" :value="l">{{ l }}</option>
									</optgroup>
									<optgroup v-if="languageCodesModulesAndCustom.length !== 0" :label="capApp.translation.other">
										<option v-for="l in languageCodesModulesAndCustom" :value="l">{{ l }}</option>
									</optgroup>
								</select>
							</td>
						</tr>
						<tr class="default-inputs">
							<td>{{ capApp.dateFormat }}</td>
							<td><my-input-date-format v-model="settingsInput.dateFormat" /></td>
						</tr>
						<tr><td colspan="2"><hr /></td></tr>
						<tr><td colspan="2"><b>{{ capApp.titleSubNumbers }}</b></td></tr>
						<tr class="default-inputs">
							<td>{{ capGen.numberSepThousand }}</td>
							<td><my-input-number-sep v-model="settingsInput.numberSepThousand" :allowNone="true" /></td>
						</tr>
						<tr class="default-inputs">
							<td>{{ capGen.numberSepDecimal }}</td>
							<td><my-input-number-sep v-model="settingsInput.numberSepDecimal" :allowNone="false" /></td>
						</tr>
						<tr><td colspan="2"><hr /></td></tr>
						<tr><td colspan="2"><b>{{ capApp.titleSubMisc }}</b></td></tr>
						<tr><td colspan="2"><my-button-check v-model="settingsInput.sundayFirstDow"   :caption="capApp.sundayFirstDow"   /></td></tr>
						<tr><td colspan="2"><my-button-check v-model="settingsInput.tabRemember"      :caption="capApp.tabRemember"      /></td></tr>
						<tr><td colspan="2"><my-button-check v-model="settingsInput.collapseRemember" :caption="capApp.collapseRemember" /></td></tr>
						<tr><td colspan="2"><my-button-check v-model="settingsInput.warnUnsaved"      :caption="capApp.warnUnsaved"      /></td></tr>
						<tr><td colspan="2"><my-button-check v-model="settingsInput.mobileScrollForm" :caption="capApp.mobileScrollForm" /></td></tr>
						<tr><td colspan="2"><my-button-check v-model="settingsInput.boolAsIcon"       :caption="capApp.boolAsIcon"       /></td></tr>
						<tr><td colspan="2"><my-button-check v-model="settingsInput.boolAsToggle"     :caption="capApp.boolAsToggle"     /></td></tr>
						<template v-if="isAdmin">
							<tr><td colspan="2"><hr /></td></tr>
							<tr><td colspan="2"><b>{{ capApp.titleSubAdmin }}</b></td></tr>
							<tr class="default-inputs">
								<td>{{ capApp.mailSpoolerStuckSec }}</td>
								<td><my-input-decimal v-model="settingsInput.mailSpoolerStuckSec" :min="0" :allowNull="false" :lengthFract="0" /></td>
							</tr>
						</template>
					</tbody>
				</table>
			</div>

			<!-- theme -->
			<div class="contentPart">
				<div class="contentPartHeader">
					<img class="icon" src="images/visible1.png" />
					<h1>{{ capApp.titleTheme }}</h1>
				</div>
				<table>
					<tbody>
						<tr>
							<td class="maximum">{{ capGen.inputs }}</td>
							<td>
								<div class="row gap">
									<my-button-check v-model="settingsInput.shadowsInputs"  :caption="capGen.shadows" />
									<my-button-check v-model="settingsInput.bordersSquared" :caption="capApp.bordersSquared" />
								</div>
							</td>
						</tr>
						<tr class="default-inputs">
							<td>{{ capApp.fontFamily }}</td>
							<td>
								<div class="row gap wrap">
									<select v-model="settingsInput.fontFamily">
										<optgroup label="sans-serif">
											<option value="calibri">Calibri</option>
											<option value="helvetica">Helvetica</option>
											<option value="segoe_ui">Segoe UI</option>
											<option value="trebuchet_ms">Trebuchet MS</option>
											<option value="verdana">Verdana</option>
										</optgroup>
										<optgroup label="serif">
											<option value="georgia">Georgia</option>
											<option value="times_new_roman">Times New Roman</option>
										</optgroup>
										<optgroup label="cursive">
											<option value="comic_sans_ms">Comic Sans</option>
											<option value="segoe_script">Segoe Script</option>
										</optgroup>
										<optgroup label="monospace">
											<option value="consolas">Consolas</option>
											<option value="lucida_console">Lucida Console</option>
										</optgroup>
									</select>

									<select v-model="settingsInput.fontSize" :title="capApp.fontSize">
										<option v-for="i in 11"
											:value="70 + (i*5)"
										>{{ (70 + (i*5)) + '%' }}</option>
									</select>
								</div>
							</td>
						</tr>
						<tr class="default-inputs">
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
						<tr class="default-inputs">
							<td>{{ capApp.formActionsAlign }}</td>
							<td>
								<select v-model.number="settingsInput.formActionsAlign">
									<option value="left">{{ capGen.alignmentHor.left }}</option>
									<option value="center">{{ capGen.alignmentHor.center }}</option>
									<option value="right">{{ capGen.alignmentHor.right }}</option>
								</select>
							</td>
						</tr>
						<tr class="default-inputs">
							<td>{{ capApp.pattern }}</td>
							<td>
								<select v-model="settingsInput.pattern">
									<option :value="null">-</option>
									<option value="bubbles">Bubbles</option>
									<option value="circuits">Circuits</option>
									<option value="cubes">Cubes</option>
									<option value="triangles">Triangles</option>
									<option value="waves">Waves</option>
								</select>
							</td>
						</tr>
						<tr>
							<td>{{ capApp.dark }}</td>
							<td><div class="row"><my-bool v-model="settingsInput.dark" :grow="false" /></div></td>
						</tr>
						<tr><td colspan="2"><hr /></td></tr>
						<tr><td colspan="2"><b>{{ capApp.titleSubHeader }}</b></td></tr>
						<tr>
							<td>{{ capGen.applications }}</td>
							<td>
								<div class="row gap">
									<my-button-check v-model="settingsInput.headerModules" :caption="capGen.button.show" />
									<my-button-check
										v-model="settingsInput.headerCaptions"
										:caption="capApp.headerCaptions"
										:readonly="!settingsInput.headerModules"
									/>
								</div>
							</td>
						</tr>
						<tr class="default-inputs">
							<td>{{ capApp.colorClassicMode }}</td>
							<td>
								<select
									@input="settingsInput.colorClassicMode = $event.target.value === '1'"
									:value="settingsInput.colorClassicMode ? '1' : '0'"
								>
									<option value="0">{{ capApp.colorClassicMode0 }}</option>
									<option value="1">{{ capApp.colorClassicMode1 }}</option>
								</select>
							</td>
						</tr>
						<tr class="default-inputs" v-if="!settingsInput.colorClassicMode">
							<td>{{ capApp.colorHeader }}</td>
							<td><my-input-color-wrap v-model="settingsInput.colorHeader" :allowNull="true" /></td>
						</tr>
						<tr v-if="!settingsInput.colorClassicMode">
							<td>{{ capApp.colorHeaderSingle }}</td>
							<td><div class="row"><my-bool v-model="settingsInput.colorHeaderSingle" :grow="false" :reversed="true" /></div></td>
						</tr>
						<tr><td colspan="2"><hr /></td></tr>
						<tr><td colspan="2"><b>{{ capApp.titleSubMenu }}</b></td></tr>
						<tr class="default-inputs">
							<td>{{ capApp.colorMenu }}</td>
							<td><my-input-color-wrap v-model="settingsInput.colorMenu" :allowNull="true" /></td>
						</tr>
					</tbody>
				</table>
			</div>

			<!-- account -->
			<div class="contentPart">
				<div class="contentPartHeader">
					<img class="icon" src="images/lock.png" />
					<h1>{{ capApp.titleAccount }}</h1>
				</div>

				<my-pw-change :showTitle="true" />

				<div class="settings-account-actions">
					<h2>{{ capGen.actions }}</h2>
					<div class="row">
						<my-button image="refresh.png"
							@trigger="delOptionsAsk"
							:caption="capApp.button.loginOptionsDel"
						/>
					</div>
				</div>

				<div class="column grow"></div>
				<span><i>{{ capApp.nodeName.replace('{NAME}',clusterNodeName) }}</i></span>
			</div>

			<!-- fixed tokens (device access) -->
			<div class="contentPart">
				<div class="contentPartHeader">
					<img class="icon" src="images/screen.png" />
					<h1>{{ capApp.titleFixedTokens }}</h1>
				</div>
				<my-settings-fixed-tokens />
			</div>

			<!-- client events (global hotkeys) -->
			<div class="contentPart">
				<div class="contentPartHeader">
					<img class="icon" src="images/screen.png" />
					<h1>{{ capApp.titleClientEvents }}</h1>
				</div>
				<my-settings-client-events />
			</div>

			<!-- encryption -->
			<div class="contentPart">
				<div class="contentPartHeader">
					<img class="icon" src="images/key.png" />
					<h1>{{ capApp.titleEncryption }}</h1>
				</div>
				<my-settings-encryption />
			</div>
		</div>
	</div>`,
	emits: ['close', 'logout'],
	data() {
		return {
			settingsInput: {},    // copy of the settings object to work on
			settingsLoaded: false // once settings have been loaded, each change triggers DB update
		};
	},
	watch: {
		settingsInput: {
			handler() {
				if (this.settingsLoaded)
					this.setSetting(this.settingsInput);
			},
			deep: true
		}
	},
	computed: {
		languageCodesModulesAndCustom: s => {
			const langs = s.languageCodesModules;
			for (const k in s.moduleIdMapMeta) {
				for (const l of s.moduleIdMapMeta[k].languagesCustom) {
					if (!langs.includes(l) && !s.languageCodesOfficial.includes(l))
						langs.push(l);
				}
			}
			return langs
		},

		// stores
		languageCodes: s => s.$store.getters['schema/languageCodes'],
		languageCodesModules: s => s.$store.getters['schema/languageCodesModules'],
		capApp: s => s.$store.getters.captions.settings,
		capGen: s => s.$store.getters.captions.generic,
		clusterNodeName: s => s.$store.getters.clusterNodeName,
		isAdmin: s => s.$store.getters.isAdmin,
		languageCodesOfficial: s => s.$store.getters.constants.languageCodesOfficial,
		moduleIdMapMeta: s => s.$store.getters.moduleIdMapMeta,
		patternStyle: s => s.$store.getters.patternStyle,
		settings: s => s.$store.getters.settings
	},
	mounted() {
		window.addEventListener('keydown', this.handleHotkeys);
		this.settingsInput = JSON.parse(JSON.stringify(this.settings));
		this.$nextTick(() => { this.settingsLoaded = true; });
	},
	unmounted() {
		window.removeEventListener('keydown', this.handleHotkeys);
	},
	methods: {
		// externals
		setSetting,

		// actions
		handleHotkeys(e) {
			if (e.key === 'Escape') {
				this.$emit('close');
				e.preventDefault();
			}
		},

		// backend calls
		delOptionsAsk() {
			this.$store.commit('dialog', {
				captionBody: this.capApp.dialog.loginOptionsDel,
				image: 'warning.png',
				buttons: [{
					cancel: true,
					caption: this.capGen.button.reset,
					exec: this.delOptions,
					keyEnter: true,
					image: 'refresh.png'
				}, {
					caption: this.capGen.button.cancel,
					keyEscape: true,
					image: 'cancel.png'
				}]
			});
		},
		delOptions() {
			ws.send('loginOptions', 'del', null, true).then(
				() => { this.$store.commit('local/loginOptionsClear'); },
				this.$root.genericError
			);
		}
	}
};
