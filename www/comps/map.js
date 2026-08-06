export default {
	name: 'my-map',
	template: `<div class="my-map" ref="map">
	</div>`,
	props: {
		readonly: { type: Boolean, required: false, default: false }
	},
	data() {
		return {
		};
	},
	emits: [],
	watch: {
	},
	computed: {
		capGen: s => s.$store.getters.captions.generic
	},
	mounted() {
		L.map(this.$refs.map);
	},
	unmounted() {
	},
	methods: {
	}
};
