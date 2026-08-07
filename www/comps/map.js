import { jsLibraryLoadNoCache } from './shared/jsLibrary.js';

export default {
	name: 'my-map',
	template: `<div class="my-map" ref="map">
	</div>`,
	props: {
		readonly: { type: Boolean, required: false, default: false }
	},
	data() {
		return {
			map: null
		};
	},
	emits: [],
	watch: {
	},
	computed: {
		capGen: s => s.$store.getters.captions.generic
	},
	mounted() {
		this.jsLibraryLoadNoCache('externals/leaflet/leaflet.js').then(
			() => {
				this.jsLibraryLoadNoCache("externals/leaflet-geoman/leaflet-geoman.js").then(
					this.reset,
					this.$root.genericError
				);
			},
			this.$root.genericError
		);
	},
	unmounted() {
	},
	methods: {
		// externals
		jsLibraryLoadNoCache,

		//
		reset() {
			this.map = L.map(this.$refs.map).setView([51.505, -0.09], 13);

			L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
				maxZoon: 19,
				attribution:
					'&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
			}).addTo(this.map);

			// leaflet geoman
			this.map.pm.addControls({
				position: "topleft",
				drawCircle: false,
			});

			// set marker with popup
			const m1 = L.marker([51.5, -0.09]).addTo(this.map);
			m1.bindPopup("<b>Hello world!</b><br>I am a popup.").openPopup();

			// set popup directly
			const p1 = L.popup()
				.setLatLng([51.55, -0.092])
				.setContent("I am a standalone popup.")
				.openOn(this.map);
		}
	}
};
