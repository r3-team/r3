import {
	aesGcmDecryptBase64, aesGcmEncryptBase64, aesGcmExportBase64,
	aesGcmImportBase64, pbkdf2PassToAesGcmKey
} from './shared/crypto.js';

export default {
	name: 'my-pw-change',
	template: `<div class="column gap">
		<table class="default-inputs">
			<tbody>
				<tr>
					<td>{{ capGen.name }}</td>
					<td><input disabled="disabled" :value="loginName" /></td>
				</tr>
				<template v-if="isAllowedPwChange">
					<tr><td colspan="2"><hr /></td></tr>
					<tr><td colspan="2"><b>{{ capApp.title }}</b></td></tr>
					<tr v-if="!isReset">
						<td>{{ capApp.old }}</td>
						<td><input autocomplete="current-password" type="password" v-model="pwOld" @input="newInput = true; generateOldPwKey()" /></td>
					</tr>
					<tr>
						<td>{{ capApp.new0 }}</td>
						<td><input autocomplete="new-password" type="password" v-model="pwNew0" @input="newInput = true" /></td>
					</tr>
					<tr>
						<td>{{ capApp.new1 }}</td>
						<td><input autocomplete="new-password" type="password" v-model="pwNew1" @input="newInput = true" /></td>
					</tr>
				</template>

				<template v-if="!isAllowedPwChange">
					<tr><td colspan="2"></td></tr>
					<tr><td colspan="2"><b>{{ capApp.notAllowed }}</b></td></tr>
				</template>
			</tbody>
		</table>

		<div class="row justify-end">
			<my-button image="save.png"
				v-if="isAllowedPwChange"
				@trigger="setCheck"
				:active="canSave"
				:caption="capGen.button.save"
			/>
		</div>
		<div class="textError" v-if="message !== ''">{{ message }}</div>
	</div>`,
	data() {
		return {
			// states
			newInput: false,  // new input was entered by user
			pwSettings: null, // server side password settings (require digits, minimum length, etc.)

			// inputs
			pwNew0: '',
			pwNew1: '',
			pwOld: '',
			pwOldKey: ''
		};
	},
	computed: {
		canSave: s => s.pwOldValid
			&& s.pwMatch
			&& s.pwMetDigits
			&& s.pwMetLength
			&& s.pwMetLower
			&& s.pwMetUpper
			&& s.pwMetSpecial,
		message: s => {
			if (!s.newInput || s.pwSettings === null)
				return '';

			if (!s.pwOldValid)
				return s.capApp.message.currentWrong;

			if (s.pwNew0 === '')
				return '';

			if (!s.pwMatch) return s.capApp.message.diff;
			if (!s.pwMetLength) return s.capApp.message.short;
			if (!s.pwMetDigits) return s.capApp.message.requiresDigit;
			if (!s.pwMetLower) return s.capApp.message.requiresLower;
			if (!s.pwMetUpper) return s.capApp.message.requiresUpper;
			if (!s.pwMetSpecial) return s.capApp.message.requiresSpecial;
			return '';
		},

		// simple
		e2eeInactive: s => !s.loginEncEnabled || s.loginEncLocked, // encryption not enabled or private key locked
		isReset: s => s.loginPwResetCode !== null,
		pwMatch: s => s.pwNew0.length !== 0 && s.pwNew0 === s.pwNew1,
		pwMetLength: s => s.pwSettings.length <= s.pwNew0.length,
		pwOldValid: s => s.isReset || s.loginKeyAes === s.pwOldKey || s.e2eeInactive, // without login key, we cannot check old PW (backend still checks)
		pwMetDigits: s => !s.pwSettings.requireDigits || /\p{Nd}/u.test(s.pwNew0),
		pwMetLower: s => !s.pwSettings.requireLower || /\p{Ll}/u.test(s.pwNew0),
		pwMetSpecial: s => !s.pwSettings.requireSpecial || /[\p{P}\p{M}\p{S}\p{Z}]+/u.test(s.pwNew0),
		pwMetUpper: s => !s.pwSettings.requireUpper || /\p{Lu}/u.test(s.pwNew0),

		// stores
		capApp: s => s.$store.getters.captions.pwChange,
		capGen: s => s.$store.getters.captions.generic,
		isAllowedPwChange: s => s.$store.getters.isAllowedPwChange,
		kdfIterations: s => s.$store.getters.constants.kdfIterations,
		loginKeyAes: s => s.$store.getters['local/loginKeyAes'],
		loginKeySalt: s => s.$store.getters['local/loginKeySalt'],
		loginEncEnabled: s => s.$store.getters.loginEncEnabled,
		loginEncLocked: s => s.$store.getters.loginEncLocked,
		loginName: s => s.$store.getters.loginName,
		loginPrivateKey: s => s.$store.getters.loginPrivateKey,
		loginPrivateKeyEnc: s => s.$store.getters.loginPrivateKeyEnc,
		loginPwResetCode: s => s.$store.getters.loginPwResetCode,
	},
	mounted() {
		ws.send('lookup', 'get', { name: 'passwordSettings' }, true).then(
			res => this.pwSettings = res.payload,
			this.$root.genericError
		);
	},
	methods: {
		// externals
		aesGcmDecryptBase64,
		aesGcmEncryptBase64,
		aesGcmExportBase64,
		aesGcmImportBase64,
		pbkdf2PassToAesGcmKey,

		generateOldPwKey() {
			if (this.e2eeInactive)
				return;

			this.pbkdf2PassToAesGcmKey(this.pwOld, this.loginKeySalt, this.kdfIterations, true).then(
				key => {
					this.aesGcmExportBase64(key).then(
						keyBase64 => this.pwOldKey = keyBase64,
						this.$root.genericError
					);
				},
				this.$root.genericError
			);
		},

		// actions
		setCheck() {
			if (this.e2eeInactive)
				return this.set(null, null);

			this.aesGcmImportBase64(this.loginKeyAes).then(
				loginKey => {
					// decrypt private key with current login key
					// generate login key from new password for re-encryption
					Promise.all([
						this.aesGcmDecryptBase64(this.loginPrivateKeyEnc, loginKey),
						this.pbkdf2PassToAesGcmKey(this.pwNew0, this.loginKeySalt, this.kdfIterations, true)
					]).then(
						res => {
							const privateKeyPem = res[0]; // private key PEM to be encrypted
							const newLoginKey = res[1]; // login key based on new password

							// re-encrypt private key with new login key
							this.aesGcmEncryptBase64(privateKeyPem, newLoginKey).then(
								newPrivateKeyEnc => this.set(newPrivateKeyEnc, newLoginKey)
							);
						},
						this.$root.genericError
					);
				},
				this.$root.genericError
			);
		},

		// backend calls
		set(newPrivateKeyEnc, newLoginKey) {
			const requests = [
				this.isReset
					? ws.prepare('loginPassword', 'reset', { code: this.loginPwResetCode, pwNew: this.pwNew, })
					: ws.prepare('loginPassword', 'set', { pwNew0: this.pwNew0, pwNew1: this.pwNew1, pwOld: this.pwOld })
			];

			// update encrypted private key if given
			if (newPrivateKeyEnc !== null)
				requests.push(ws.prepare('loginKeys', 'storePrivate', { privateKeyEnc: newPrivateKeyEnc }));

			// use same request/transaction to update password & encrypted private key
			// one must not change without the other
			ws.sendMultiple(requests, true).then(
				res => {
					this.pwNew0 = '';
					this.pwNew1 = '';
					this.pwOld = '';
					this.newInput = false;

					if (res.length > 1)
						this.aesGcmExportBase64(newLoginKey).then(keyBase64 => {
							this.$store.commit('loginPrivateKeyEnc', newPrivateKeyEnc);
							this.$store.commit('local/loginKeyAes', keyBase64);
						});
				},
				this.$root.genericError
			);
		}
	}
};
