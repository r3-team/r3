export default {
	name:'my-dropdown',
	template:`<div id="dropdown" ref="self"
		v-show="active && !targetLeftWindow"
		@click="click"
		:class="{ downwards:isDownwards, upwards:!isDownwards, borderSimple:config.borderSimple }"
		:style="style"
	></div>`,
	watch:{
		appResized() {
			if(this.sourceElm !== null)
				this.updateExisting();
		},
		sourceElm(vNew,vOld) {
			if(vNew !== null)
				this.updatePos(vNew !== vOld);
		}
	},
	data() {
		return {
			config:{
				borderSimple:false,
				marginX:null,
				width:null
			},
			isDownwards:true,        // dropdown goes down
			isWaitingForFrame:false, // placement waits for browser frame paint
			marginXDef:'4px',
			observer:null,           // for reacting to changes to dropdown element content
			rectDrop:null,           // bounding rect of dropdown element
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
		window.addEventListener('scroll', this.updateExisting, true);

		this.observer = new MutationObserver(m => {
			if(this.active && this.rectDrop !== null) {
				const rectDropNew = this.$refs.self.getBoundingClientRect();
				if(this.rectDrop.height !== rectDropNew.height)
					this.updateExisting();
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
		window.removeEventListener('scroll', this.updateExisting, true);
	},
	methods:{
		click(ev) {
			// stops v-click-outside from triggering when clicking inside dropdown
			ev.stopPropagation();
		},
		updateExisting() {
			this.updatePos(false);
		},
		updatePos(isNewElm) {
			if(!this.active || this.isWaitingForFrame)
				return;

			// synchronizes refreshes with browser refreshes and avoids unnecessary execution between refreshes
			this.isWaitingForFrame = true;

			window.requestAnimationFrame(() => {
				// source element can return to null, depending on timing
				if(this.sourceElm === null)
					return this.isWaitingForFrame = false;

				const rectDrop   = this.$refs.self.getBoundingClientRect();
				const rectTarget = this.sourceElm.getBoundingClientRect();
				this.rectDrop = rectDrop;
	
				this.targetLeftWindow     = rectTarget.bottom < 0 || rectTarget.top > window.innerHeight;
				const dropLeavesWinBottom = rectTarget.bottom + rectDrop.height > window.innerHeight;
				const dropLeavesWinTop    = rectTarget.top    - rectDrop.height < 0;
				const dropLeavesWinRight  = rectTarget.left   + rectDrop.width > window.innerWidth;

				this.isDownwards = !dropLeavesWinBottom || dropLeavesWinTop;
				
				// check for dropdown configuration options in first child
				const child = this.$refs.self.firstElementChild;
				this.config.borderSimple = child !== null && child.dataset['dropdownBorderSimple'] !== undefined;
				this.config.marginX      = child !== null && child.dataset['dropdownMarginX']      !== undefined ? parseInt(child.dataset['dropdownMarginX'])  : null;
				this.config.width        = child !== null && child.dataset['dropdownWidth']        !== undefined ? parseInt(child.dataset['dropdownWidth'])    : null;
				this.config.widthMin     = child !== null && child.dataset['dropdownWidthMin']     !== undefined ? parseInt(child.dataset['dropdownWidthMin']) : null;

				const cssMarginX  = this.config.marginX  !== null ? `${this.config.marginX}px` : this.marginXDef;
				const cssPos      = dropLeavesWinRight            ? `right:0px` : `left:calc(${rectTarget.left + window.scrollX}px + ${cssMarginX} + var(--border-input-radius))`;
				const cssTop      = this.isDownwards              ? `top:${rectTarget.bottom}px` : `top:${rectTarget.top - rectDrop.height}px`;
				const cssWidth    = this.config.width    !== null ? `width:${this.config.width}px` : `width:calc(${rectTarget.width}px - ((${cssMarginX} + var(--border-input-radius)) * 2) )`;
				const cssWidthMin = this.config.widthMin !== null ? `min-width:${this.config.widthMin}px` : `min-width:0px`;
				this.style = [cssPos,cssTop,cssWidth,cssWidthMin].join(';');
				
				this.isWaitingForFrame = false;
				
				if(isNewElm)
					this.updateExisting();
			});
		}
	}
};