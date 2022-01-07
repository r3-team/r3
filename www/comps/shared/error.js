import MyStore from '../../stores/store.js';

export function genericError(message) {
	if(typeof MyStore.getters.captions === 'undefined')
		return;
	
	MyStore.commit('dialog',{
		captionBody:message,
		captionTop:MyStore.getters.captions.generic.error.generalErrorTitle,
		image:'warning.png',
		buttons:[{
			caption:MyStore.getters.captions.generic.button.close,
			cancel:true,
			image:'cancel.png'
		}]
	});
};