export {MyDropdown as default};

let MyDropdown = {
	name:'my-dropdown',
	template:`<div id="dropdown" ref="self"
		v-show="active"
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
			rectTarget:null          // bounding rect of where dropdown is to be placed
		};
	},
	computed:{
		style:(s) => {
			if(s.sourceElm === null || s.rectTarget === null || s.rectSelf === null)
				return '';

			const top = s.isDownwards
				? `top:${s.rectTarget.bottom + window.scrollY}px`
				: `top:${s.rectTarget.top    + window.scrollY - s.rectSelf.height}px`;

			return [
				top,
				`left:calc(${s.rectTarget.left + window.scrollX}px + ${s.cssMarginX} + var(--border-input-radius))`,
				`width:calc(${s.rectTarget.width}px - ((${s.cssMarginX} + var(--border-input-radius)) * 2) )`,
				`max-height:calc(var(--row-height) * 10)`
			].join(';');
		},

		// simple
		active:(s) => s.sourceElm !== null,

		// stores
		appResized:(s) => s.$store.getters.appResized,
		sourceElm: (s) => s.$store.getters.dropdownElm
	},
	mounted() {
		window.addEventListener('scroll', this.updatePos, true);

		this.observer = new MutationObserver(m => {

			if(this.$refs.self.children.length === 0 && this.sourceElm !== null)
				return this.$store.commit('dropdownElm',null);

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
				this.rectSelf   = this.$refs.self.getBoundingClientRect();
				this.rectTarget = this.sourceElm.getBoundingClientRect();
	
				const leavesWindowBottom = this.rectTarget.bottom + this.rectSelf.height > window.innerHeight;
				const leavesWindowTop    = this.rectTarget.top    - this.rectSelf.height < 0;
	
				this.isDownwards = !leavesWindowBottom || leavesWindowTop;
				this.isWaitingForFrame = false;

				if(this.isNewElm) {
					this.isNewElm = false;
					this.updatePos();
				}
			});
		}
	}
};