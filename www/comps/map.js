import { getUuidV4 } from './shared/crypto.js';
import { jsLibrariesLoadNoCache } from './shared/jsLibrary.js';

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
		this.jsLibrariesLoadNoCache(['externals/leaflet/leaflet.js', 'externals/leaflet-geoman/leaflet-geoman.min.js']).then(
			this.init,
			this.$root.genericError
		);
	},
	unmounted() {
	},
	methods: {
		// externals
		getUuidV4,
		jsLibrariesLoadNoCache,

		// actions
		layerCreated(e) {
			e.layer.feature = { id: this.getUuidV4(), type: 'Feature', properties: {} };
			e.layer.on('pm:cut', this.layerCut);
			e.layer.on('pm:update', this.layerUpdated);

			console.log('CREATED feature', e.layer.toGeoJSON());
		},
		layerCut(e) {
			// when a layer is cut, the original layer is destroyed and a new one created
			e.layer.feature.id = e.originalLayer.feature.id;
			e.layer.on('pm:cut', this.layerCut);
			e.layer.on('pm:update', this.layerUpdated);

			console.log('CUT feature', e);
		},
		layerUpdated(e) {
			console.log('UPDATED feature', e.layer.toGeoJSON());
		},

		// system
		init() {
			this.map = L.map(this.$refs.map).setView([51.505, -0.09], 13);

			L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
				maxZoon: 19,
				attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
			}).addTo(this.map);

			// leaflet geoman
			this.map.pm.addControls({
				position: "topleft",
			});
			this.map.on('pm:create', this.layerCreated);
		}
	}
};
