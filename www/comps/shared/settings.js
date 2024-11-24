import MyStore        from '../../stores/store.js';
import {genericError} from './error.js';

export function set(settings) {
	ws.send('loginSetting','set',settings,true).then(
		() => {
			let langOld = MyStore.getters.settings.languageCode;
			MyStore.commit('settings',JSON.parse(JSON.stringify(settings)));
			
			if(langOld !== settings.languageCode)
				MyStore.getters.appFunctions.captionsReload();
		},
		genericError
	);
};

export function setSingle(name,value) {
	let settings = JSON.parse(JSON.stringify(MyStore.getters.settings));
	settings[name] = value;
	set(settings);
};