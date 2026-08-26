export default {
	name: 'my-settings-mfa',
	template: `<div class="app-sub-window" @mousedown.self="close">
		<div class="contentBox float settings-mfa">
			<div class="top lower">
				<div class="area">
					<img class="icon" src="images/smartphone.png" />
					<div class="caption">{{ capApp.title }}</div>
				</div>
				<div class="area">
					<my-button image="cancel.png"
						v-if="!forced"
						@trigger="close"
						:cancel="true"
					/>
				</div>
			</div>

			<div class="content">
				<div class="column gap-large default-inputs">
					<template v-if="!tokenSet">
						<span v-if="!forced">{{ capApp.intro }}</span>
						<span v-if="forced">{{ capApp.introForced }}</span>

						<div class="column">
							<span>{{ capApp.appsExample }}</span>
							<ul>
								<li v-for="l in capApp.apps">{{ l }}</li>
							</ul>
						</div>
						<div class="column gap">
							<span>{{ capApp.name }}</span>
							<div class="settings-mfa-input">
								<input class="dynamic"
									v-model="tokenName"
									v-focus
									:placeholder="capApp.nameHint"
								/>
							</div>
						</div>
						<div>
							<my-button image="ok.png"
								@trigger="set"
								:active="tokenName !== ''"
								:caption="capGen.button.ok"
							/>
						</div>
					</template>

					<!-- scannable code -->
					<div class="settings-mfa-qrcode shade clickable" ref="qrcode"
						v-show="tokenSet"
						@click="showMfaText = !showMfaText"
					></div>

					<template v-if="showMfaText">
						<span class="settings-mfa-uri">{{ qrCodeUri }}</span>
						<br />
					</template>

					<span v-if="tokenSet && !forced">{{ capApp.outro }}</span>
					<span v-if="tokenSet && forced">{{ capApp.outroForced }}</span>

					<div class="row">
						<my-button image="ok.png"
							v-if="forced && tokenSet"
							@trigger="$emit('confirmed')"
							:caption="capApp.button.finished"
						/>
					</div>
				</div>
			</div>
		</div>
	</div>`,
	props: {
		forced: { type: Boolean, required: true },
	},
	emits: ['close', 'confirmed', 'tokenSet'],
	data() {
		return {
			showMfaText: false,
			tokenFixed: '',
			tokenFixedB32: '',
			tokenName: '',
		};
	},
	watch: {
		qrCodeUri(v) {
			if (typeof this.$refs.qrcode !== 'undefined' && this.$refs.qrcode !== null) {
				const qr = qrcode(0, 'M');
				qr.addData(v);
				qr.make();
				this.$refs.qrcode.innerHTML = qr.createImgTag(5, 20);
			}
		}
	},
	computed: {
		qrCodeUri: s => {
			const app = encodeURIComponent(`${s.appNameShort} - ${s.tokenName}`);
			const usr = encodeURIComponent(s.loginName);
			const uri = `otpauth://totp/${app}:${usr}?issuer=${app}&secret=${s.tokenFixedB32}`;
			return !s.tokenSet ? '' : uri;
		},

		// stores
		appNameShort: s => s.$store.getters['local/appNameShort'],
		capApp: s => s.$store.getters.captions.settings.mfa,
		capGen: s => s.$store.getters.captions.generic,
		loginName: s => s.$store.getters.loginName,
		tokenSet: s => s.tokenFixed !== '',
	},
	methods: {
		// actions
		close() {
			if (!this.forced)
				this.$emit('close');
		},

		// backend calls
		set() {
			ws.send('login', 'setTokenFixed', {
				context: 'totp',
				name: this.tokenName
			}, true).then(
				res => {
					this.tokenFixed = res.payload.tokenFixed;
					this.tokenFixedB32 = res.payload.tokenFixedB32;
					this.$emit('tokenSet');
				},
				this.$root.genericError
			);
		}
	}
};
