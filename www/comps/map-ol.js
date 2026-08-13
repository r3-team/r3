import { getUuidV4 } from './shared/crypto.js';
import { jsLibraryLoadNoCache } from './shared/jsLibrary.js';

export default {
	name: 'my-map-ol',
	template: `<div class="my-map" ref="map">
	</div>`,
	props: {
		readonly: { type: Boolean, required: false, default: false }
	},
	data() {
		return {
			geoJsonFormatter: null,
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
		jsLibraryLoadNoCache('externals/openlayers/ol.js').then(
			this.init,
			this.$root.genericError
		);
	},
	unmounted() {
	},
	methods: {
		// externals
		getUuidV4,

		// conversions
		toGeoJson(feature) {
			return this.geoJsonFormatter.writeFeature(feature, {
				featureProjection: this.map.getView().getProjection(),
				dataProjection: 'EPSG:4326',
			});
		},

		// system
		init() {
			this.geoJsonFormatter = new ol.format.GeoJSON();
			const source = new ol.source.Vector();
			const layerDraw = new ol.layer.Vector({ source });
			const interactionDraw = new ol.interaction.Draw({ type: 'Polygon', source });
			const interactionModify = new ol.interaction.Modify({ source });

			this.map = new ol.Map({
				target: this.$refs.map,
				layers: [
					new ol.layer.Tile({ source: new ol.source.OSM(), }),
				],
				view: new ol.View({
					center: [0, 0],
					zoom: 2,
				}),
			});

			// drawing
			this.map.addLayer(layerDraw);
			this.map.addInteraction(new ol.interaction.DragAndDrop({ formatConstructors: [ol.format.GeoJSON], source }));
			this.map.addInteraction(new ol.interaction.Snap({ source }));
			this.map.addInteraction(interactionDraw);
			this.map.addInteraction(interactionModify);

			// events
			interactionDraw.on('drawend', e => {
				/*
				Circle Geometry Exception: GeoJSON specification does not natively support true Circle geometries.
				If you draw circles (type: 'Circle'), GeoJSON.writeFeature() will fail or drop the feature unless you convert the circle into a polygon using ol/geom/Polygon.fromCircle() before serializing.
				*/
				console.log(this.toGeoJson(e.feature));
			});
			interactionModify.on('modifyend', e => {
				// Modify can update multiple features simultaneously (for instance, if a user drags a shared vertex between two polygons).
				e.features.getArray().forEach(feature => {
					console.log(this.toGeoJson(feature));
				});
			});
		}
	}
};
