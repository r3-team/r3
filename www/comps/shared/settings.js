import MyStore        from '../../stores/store.js';
import {genericError} from './error.js';

export function set(settings) {
	ws.send('setting','set',settings,true).then(
		(res) => {
			if(MyStore.getters.settings.languageCode !== settings.languageCode)
				return location.reload();
			
			MyStore.commit('settings',JSON.parse(JSON.stringify(settings)));
		},
		(err) => genericError(err)
	);
};

export function setSingle(name,value) {
	let settings = JSON.parse(JSON.stringify(MyStore.getters.settings));
	settings[name] = value;
	set(settings);
};

export function setLoginKeys(privateKeyEnc,privateKeyEncBackup,privateKey,publicKey) {
	return new Promise((resolve,reject) => {
		this.pemExport(publicKey).then(
			publicKeyPem => {
				ws.send('loginKeys','store',{
					privateKeyEnc:privateKeyEnc,
					privateKeyEncBackup:privateKeyEncBackup,
					publicKey:publicKeyPem
				},true).then(
					res => {
						MyStore.commit('loginEncryption',true);
						MyStore.commit('loginPrivateKey',privateKey);
						MyStore.commit('loginPrivateKeyEnc',privateKeyEnc);
						MyStore.commit('loginPrivateKeyEncBackup',privateKeyEncBackup);
						MyStore.commit('loginPublicKey',publicKey);
						resolve();
					}
				);
			},
			err => reject(err)
		);
	});
};