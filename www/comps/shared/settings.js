import MyStore        from '../../stores/store.js';
import {genericError} from './error.js';

export function set(settings) {
	ws.send('setting','set',settings,true).then(
		() => {
			if(MyStore.getters.settings.languageCode !== settings.languageCode)
				return location.reload();
			
			MyStore.commit('settings',JSON.parse(JSON.stringify(settings)));
		},
		genericError
	);
};

export function setSingle(name,value) {
	let settings = JSON.parse(JSON.stringify(MyStore.getters.settings));
	settings[name] = value;
	set(settings);
};