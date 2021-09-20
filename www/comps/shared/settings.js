import MyStore        from '../../stores/store.js';
import {genericError} from './error.js';

export function set(settings) {
	let trans = new wsHub.transactionBlocking();
	trans.add('setting','set',settings,setOk);
	trans.send(genericError);
};

export function setSingle(name,value) {
	let settings = JSON.parse(JSON.stringify(MyStore.getters.settings));
	settings[name] = value;
	set(settings);
};

let setOk = function(res,req) {
	if(MyStore.getters.settings.languageCode !== req.payload.languageCode)
		return location.reload();
	
	MyStore.commit('settings',JSON.parse(JSON.stringify(req.payload)));
};