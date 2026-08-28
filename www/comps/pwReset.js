import MyPwChange from './pwChange.js';

export default {
	name: 'my-pw-reset',
	components: { MyPwChange },
	template: `<div class="app-sub-window">
		<div class="contentBox float pw-reset">
			<div class="top lower">
				<div class="area">
					<img class="icon" src="images/lock.png" />
					<div class="caption">{{ capApp.title }}</div>
				</div>
			</div>

			<div class="content">
				<my-pw-change />
			</div>
		</div>
	</div>`,
	emits: ['confirmed'],
	computed: {
		// stores
		capApp: s => s.$store.getters.captions.pwReset
	}
};
