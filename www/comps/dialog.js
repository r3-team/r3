import MyInputRichtext from './inputRichtext.js';
export {MyDialog as default};

let MyDialog = {
	name:'my-dialog',
	components:{MyInputRichtext},
	template:`<div class="app-sub-window">
		<div class="dialog contentBox" :style="styles">
			<div class="top">
				<div class="area">
					<img class="icon"
						:src="image === null ? 'images/ok.png' : 'images/'+image"
					/>
					<div class="caption">{{ captionTop }}</div>
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
					/>
				</div>
			</div>
		</div>
	</div>`,
	mounted:function() {
		window.addEventListener('keyup',this.handleHotkeys);
	},
	unmounted:function() {
		window.removeEventListener('keyup',this.handleHotkeys);
	},
	data:function() {
		return {
			richtextClosing:false
		};
	},
	computed:{
		captionTop: function() {
			if(this.$store.getters.dialogCaptionTop === '')
				return this.capGen.dialog.confirm;
			
			return this.$store.getters.dialogCaptionTop;
		},
		
		// simple
		isHtml:    function() { return this.textDisplay === 'html'; },
		isRichtext:function() { return this.textDisplay === 'richtext'; },
		isTextarea:function() { return this.textDisplay === 'textarea'; },
		
		// stores
		buttons:    function() { return this.$store.getters.dialogButtons; },
		captionBody:function() { return this.$store.getters.dialogCaptionBody; },
		capGen:     function() { return this.$store.getters.captions.generic; },
		image:      function() { return this.$store.getters.dialogImage; },
		styles:     function() { return this.$store.getters.dialogStyles; },
		textDisplay:function() { return this.$store.getters.dialogTextDisplay; }
	},
	methods:{
		handleHotkeys:function(e) {
			let search = null;
			switch(e.key) {
				case 'Enter':  search = 'keyEnter';  break;
				case 'Escape': search = 'keyEscape'; break;
				default: return; break;
			}
			
			// search for a button with this particular action key assigned
			for(let i = 0, j = this.buttons.length; i < j; i++) {
				let btn = this.buttons[i];
				
				if(typeof btn[search] !== 'undefined' && btn[search]) {
					this.executeButton(btn);
					e.preventDefault();
					break;
				}
			}
		},
		
		// actions
		executeButton:function(btn) {
			// execute action if set
			if(typeof btn.exec !== 'undefined') {
				if(Array.isArray(btn.params)) btn.exec(...btn.params);
				else                          btn.exec();
			}
			
			// close dialog window
			this.$store.commit('isAtDialog',false)
		},
		trigger:function(i) {
			// richtext looses all styling during close
			// remove before fade out occurs
			this.richtextClosing = true;
			
			this.$nextTick(function() {
				this.executeButton(this.buttons[i]);
			});
		}
	}
};