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
					v-if="textDisplay === 'html'"
					v-html="captionBody"
				></div>
				
				<div class="dialog-text default-inputs"
					v-if="textDisplay === 'textarea'"
				>
					<textarea class="dialog-text">{{ captionBody }}</textarea>
				</div>
				
				<div class="dialog-text richtext"
					v-if="textDisplay === 'richtext'"
				>
					<my-input-richtext
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
	computed:{
		captionTop: function() {
			if(this.$store.getters.dialogCaptionTop === '')
				return this.capGen.dialog.confirm;
			
			return this.$store.getters.dialogCaptionTop;
		},
		
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
			if(typeof this.buttons[i].exec !== 'undefined') {
				
				if(Array.isArray(this.buttons[i].params))
					this.buttons[i].exec(...this.buttons[i].params);
				else
					this.buttons[i].exec();
			}
			this.$store.commit('isAtDialog',false);
		}
	}
};