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
		trigger:function(i) {
			// richtext looses all styling during close
			// remove before fade out occurs
			this.richtextClosing = true;
			
			this.$nextTick(function() {
				// execute button actions if set
				if(typeof this.buttons[i].exec !== 'undefined') {
					
					if(Array.isArray(this.buttons[i].params))
						this.buttons[i].exec(...this.buttons[i].params);
					else
						this.buttons[i].exec();
				}
				
				// close dialog window proper
				this.$store.commit('isAtDialog',false)
			});
		}
	}
};