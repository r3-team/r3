export {MyDropdown as default};

let MyDropdown = {
	name:'my-dropdown',
	template:`<div id="dropdown" ref="self"
		v-show="active && !targetLeftWindow"
		@click="click"
		:class="{ downwards:isDownwards, upwards:!isDownwards }"
		:style="style"
	></div>`,
	watch:{
		appResized() {
			if(this.sourceElm !== null)
				this.updatePos();
		},
		sourceElm(vNew,vOld) {
			if(vNew !== vOld) this.isNewElm = true;
			if(vNew !== null) this.updatePos();
		}
	},
	data() {
		return {
			cssMarginX:'4px',
			isDownwards:true,        // dropdown goes down
			isNewElm:false,          // dropdown elm is new, needs to be calculated again after placement
			isWaitingForFrame:false, // placement waits for browser frame paint
			observer:null,           // for reacting to changes to dropdown element content
			rectSelf:null,           // bounding rect of dropdown element
			style:'',
			targetLeftWindow:false
		};
	},
	computed:{
		// simple
		active:(s) => s.sourceElm !== null,

		// stores
		appResized:(s) => s.$store.getters.appResized,
		sourceElm: (s) => s.$store.getters.dropdownElm
	},
	mounted() {
		window.addEventListener('scroll', this.updatePos, true);

		this.observer = new MutationObserver(m => {
			if(this.active && this.rectSelf !== null) {
				const rectSelfNew = this.$refs.self.getBoundingClientRect();
				if(this.rectSelf.height !== rectSelfNew.height)
					this.updatePos();
			}
		});
		this.observer.observe(this.$refs.self, {
			childList:true,
			subtree:true
		});
	},
	beforeUnmount() {
		if(this.observer !== null)
			this.observer.disconnect();
	},
	unmounted() {
		window.removeEventListener('scroll', this.updatePos, true);
	},
	methods:{
		click(ev) {
			// stops v-click-outside from triggering when clicking inside dropdown
			ev.stopPropagation();
		},
		updatePos() {
			if(!this.active || this.isWaitingForFrame)
				return;

			this.isWaitingForFrame = true;

			// synchronizes refreshes with browser refreshes and avoids unnecessary execution between refreshes
			window.requestAnimationFrame(() => {
				// source element can return to null, depending on timing
				if(this.sourceElm === null)
					return;

				const rectSelf   = this.$refs.self.getBoundingClientRect();
				const rectTarget = this.sourceElm.getBoundingClientRect();
				this.rectSelf = rectSelf;
	
				this.targetLeftWindow     = rectTarget.bottom < 0 || rectTarget.top > window.innerHeight;
				const selfLeavesWinBottom = rectTarget.bottom + rectSelf.height > window.innerHeight;
				const selfLeavesWinTop    = rectTarget.top    - rectSelf.height < 0;

				this.isDownwards = !selfLeavesWinBottom || selfLeavesWinTop;
				this.isWaitingForFrame = false;

				const top = this.isDownwards
					? `top:${rectTarget.bottom}px`
					: `top:${rectTarget.top - rectSelf.height}px`;

				this.style = [
					top,
					`left:calc(${rectTarget.left + window.scrollX}px + ${this.cssMarginX} + var(--border-input-radius))`,
					`width:calc(${rectTarget.width}px - ((${this.cssMarginX} + var(--border-input-radius)) * 2) )`
				].join(';');

				if(this.isNewElm) {
					this.isNewElm = false;
					this.updatePos();
				}
			});
		}
	}
};