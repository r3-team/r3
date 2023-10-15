import MyInputRichtext from './inputRichtext.js';
export {MyDialog as default};

let MyDialog = {
	name:'my-dialog',
	components:{MyInputRichtext},
	template:`<div class="app-sub-window" @mousedown.self="close">
		<div class="contentBox dialog popUp" :style="styles">
			<div class="top lower">
				<div class="area">
					<img class="icon"
						:src="image === null ? 'images/ok.png' : 'images/'+image"
					/>
					<div class="caption">{{ captionTop }}</div>
				</div>
				<div class="area">
					<my-button
						@trigger="close" image="cancel.png"
						:cancel="true"
					/>
				</div>
			</div>
			
			<div class="content no-padding">
				<div class="dialog-text"
					v-if="isHtml"
					v-html="captionBody"
				></div>
				
				<div class="dialog-text default-inputs" v-if="isTextarea">
					<textarea class="dialog-text">{{ captionBody }}</textarea>
				</div>
				
				<div class="dialog-text richtext" v-if="isRichtext">
					<my-input-richtext
						v-if="!richtextClosing"
						:modelValue="captionBody"
						:readonly="true"
					/>
				</div>
				
				<div class="dialog-actions">
					<my-button
						v-for="(b,i) in buttons"
						@trigger="trigger(i)"
						:cancel="b.cancel"
						:caption="b.caption"
						:image="b.image"
						:key="'button'+i"
						:ref="'btn'+i"
					/>
				</div>
			</div>
		</div>
	</div>`,
	mounted() {
		window.addEventListener('keydown',this.handleHotkeys);
		
		// place focus on first available button
		if(this.buttons.length !== 0)
			this.$refs['btn0'][0].$el.focus();
	},
	unmounted() {
		window.removeEventListener('keydown',this.handleHotkeys);
	},
	data() {
		return {
			richtextClosing:false
		};
	},
	computed:{
		captionTop:(s) => s.$store.getters.dialogCaptionTop === ''
			? s.capGen.dialog.confirm : s.$store.getters.dialogCaptionTop,
		isHtml:    (s) => s.textDisplay === 'html',
		isRichtext:(s) => s.textDisplay === 'richtext',
		isTextarea:(s) => s.textDisplay === 'textarea',
		
		// stores
		buttons:    (s) => s.$store.getters.dialogButtons,
		captionBody:(s) => s.$store.getters.dialogCaptionBody,
		capGen:     (s) => s.$store.getters.captions.generic,
		image:      (s) => s.$store.getters.dialogImage,
		styles:     (s) => s.$store.getters.dialogStyles,
		textDisplay:(s) => s.$store.getters.dialogTextDisplay
	},
	methods:{
		handleHotkeys(e) {
			let search = null;
			switch(e.key) {
				case 'Enter':  search = 'keyEnter';  break;
				case 'Escape': search = 'keyEscape'; break;
				default: return; break;
			}
			
			// search for a button with this particular action key assigned
			for(let btn of this.buttons) {
				if(typeof btn[search] !== 'undefined' && btn[search]) {
					this.executeButton(btn);
					e.preventDefault();
					break;
				}
			}
		},
		
		// actions
		close() {
			this.$store.commit('isAtDialog',false);
		},
		executeButton(btn) {
			// execute action if set
			if(typeof btn.exec !== 'undefined') {
				if(Array.isArray(btn.params)) btn.exec(...btn.params);
				else                          btn.exec();
			}
			
			// close dialog window
			this.close();
		},
		trigger(i) {
			// richtext looses all styling during close
			// remove before fade out occurs
			this.richtextClosing = true;
			
			this.$nextTick(() => {
				this.executeButton(this.buttons[i]);
			});
		}
	}
};