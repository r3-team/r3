import MyStore from '../../stores/store.js';

export function dialogCloseAsk(fncClose,hasChanges) {
    if(!MyStore.getters.settings.warnUnsaved || !hasChanges)
        return fncClose();

    this.$store.commit('dialog',{
        captionBody:MyStore.getters.captions.generic.dialog.close,
        buttons:[{
            cancel:true,
            caption:MyStore.getters.captions.generic.button.close,
            exec:fncClose,
            keyEnter:true,
            image:'ok.png'
        },{
            caption:MyStore.getters.captions.generic.button.cancel,
            keyEscape:true,
            image:'cancel.png'
        }]
    });
};

export function dialogDeleteAsk(fncDelete,msg) {
	this.$store.commit('dialog',{
		captionBody:msg,
		buttons:[{
			cancel:true,
			caption:MyStore.getters.captions.generic.button.delete,
			exec:fncDelete,
			image:'delete.png'
		},{
			caption:MyStore.getters.captions.generic.button.cancel,
            keyEscape:true,
			image:'cancel.png'
		}]
	});
};