import { getUuidV4 } from './shared/crypto.js';
import { jsLibrariesLoadNoCache } from './shared/jsLibrary.js';

export default {
	name: 'my-map-ol',
	template: `<div class="my-map" ref="map">
	</div>`,
	props: {
		layerIds: { type: Array, required: false, default: ['32e54b0d-8d8c-4353-90b9-d5b709fb13ad'] },
		readonly: { type: Boolean, required: false, default: false },
		viewSrid: { type: Number, required: false, default: 3857 }, // view projection and CRS vectors are stored in
	},
	data() {
		return {
			geoJsonFormatter: null,
			map: null,
			sridsDefault: [3857, 4326], // supported by openlayers by default
			vectorSource: null,
		};
	},
	computed: {
		customSrids: s => {
			const out = [];
			if (!s.sridsDefault.includes(s.viewSrid)) out.push(s.viewSrid);
			for (const layer of s.layers) {
				if (!s.sridsDefault.includes(layer.srid)) out.push(layer.srid);
			}
			return out;
		},
		layers: s => {
			const out = [];
			for (const id of s.layerIds) {
				if (s.layerIdMap[id] !== undefined)
					out.push(s.layerIdMap[id]);
			}
			return out;
		},

		// stores
		capGen: s => s.$store.getters.captions.generic,
		layerIdMap: s => s.$store.getters.geoLayerIdMap
	},
	mounted() {
		jsLibrariesLoadNoCache(['externals/openlayers/ol.js', 'externals/proj4.js']).then(() => {
			if (this.customSrids.length === 0)
				return this.reset();

			// load custom CRS definitions, if need be
			import('../externals/proj4-list.js').then(module => {
				const list = module.default;

				const epsgDefs = [];
				for (const srid of this.customSrids) {
					const epsg = `EPSG:${srid}`;
					if (list[epsg] === undefined) {
						console.warn(`cannot find definition for ${epsg}, layer will not work correctly`);
						continue;
					}
					epsgDefs.push(list[epsg]);
				}
				proj4.defs(epsgDefs);
				ol.proj.proj4.register(proj4);
				this.reset();
			}, this.$root.genericError);
		}, this.$root.genericError);
	},
	unmounted() {
	},
	methods: {
		// externals
		getUuidV4,

		// conversions
		geoJsonFrom(featureCollectionJson) {
			return this.geoJsonFormatter.readFeatures(featureCollectionJson, {
				dataProjection: 'EPSG:4326',
				featureProjection: this.map.getView().getProjection()
			});
		},
		geoJsonTo(feature) {
			return this.geoJsonFormatter.writeFeatureObject(feature, {
				dataProjection: 'EPSG:4326',
				featureProjection: this.map.getView().getProjection()
			});
		},

		// system
		reset() {
			this.geoJsonFormatter = new ol.format.GeoJSON();
			this.vectorSource = new ol.source.Vector();
			const interactionDraw = new ol.interaction.Draw({ type: 'Polygon', source: this.vectorSource });
			const interactionModify = new ol.interaction.Modify({ source: this.vectorSource });

			// process layers
			const layers = [];
			for (const layer of this.layers) {
				const params = {};
				for (const k in layer.parameters) {
					params[k.toUpperCase()] = layer.parameters[k];
				}
				const source = new ol.source.TileWMS({ url: layer.url, params, projection: `EPSG:${layer.srid}` })
				layers.push(new ol.layer.Tile({ source }));
			}

			// TEMP, OSM layer for reference
			layers.push(new ol.layer.Tile({ source: new ol.source.OSM() }));

			if (!this.readonly)
				layers.push(new ol.layer.Vector({ source: this.vectorSource }));

			// map definition
			this.map = new ol.Map({
				target: this.$refs.map,
				layers,
				view: new ol.View({
					center: [0, 0],
					projection: `EPSG:${this.viewSrid}`,
					zoom: 2,
				}),
			});

			// drawing
			if (!this.readonly) {
				this.map.addInteraction(new ol.interaction.DragAndDrop({ formatConstructors: [ol.format.GeoJSON], source: this.vectorSource }));
				this.map.addInteraction(new ol.interaction.Snap({ source: this.vectorSource }));
				this.map.addInteraction(interactionDraw);
				this.map.addInteraction(interactionModify);

				// events
				interactionDraw.on('drawend', e => {
					/*
					Circle Geometry Exception: GeoJSON specification does not natively support true Circle geometries.
					If you draw circles (type: 'Circle'), GeoJSON.writeFeature() will fail or drop the feature unless you convert the circle into a polygon using ol/geom/Polygon.fromCircle() before serializing.
					*/
					this.set([e.feature]);
				});
				interactionModify.on('modifyend', e => {
					// Modify can update multiple features simultaneously (for instance, if a user drags a shared vertex between two polygons).
					this.set(e.features.getArray());
				});
			}

			// get data
			this.get();
		},

		// backend calls
		get() {
			ws.send('data', 'get', {
				relationId: 'a1611a6d-7739-42ab-a253-0cb17cefd64d',
				joins: [],
				expressions: [{
					attributeId: '2f84cb84-5c80-4326-a9e9-c3a5b2cd59fe',
					index: 0
				}],
				filters: [],
				getIds: true
			}, true).then(
				res => {
					const featureCollectionJson = { type: "FeatureCollection", features: [] };
					for (const r of res.payload.rows) {
						if (r.values[0] === null)
							continue;

						featureCollectionJson.features.push({
							type: 'Feature',
							geometry: r.values[0],
							id: r.indexRecordIds['0'],
						});
					}
					if (featureCollectionJson.features.length !== 0)
						this.vectorSource.addFeatures(this.geoJsonFrom(featureCollectionJson));
				},
				this.$root.genericError
			);
		},
		set(features) {
			const requests = [];
			for (const feature of features) {
				// takeover SRID from the view
				feature.set('srid', this.viewSrid);

				const geoJson = this.geoJsonTo(feature);
				let recordId = 0;
				if (feature.getId() !== undefined) {
					// get existing record ID, remove from JSON as its not standard and not required
					recordId = feature.getId();
					delete geoJson.id;
				}

				// TEMP data SET mockup
				requests.push(ws.prepare('data', 'set', {
					'0': {
						relationId: 'a1611a6d-7739-42ab-a253-0cb17cefd64d',
						indexFrom: -1,
						recordId,
						attributes: [{ attributeId: '2f84cb84-5c80-4326-a9e9-c3a5b2cd59fe', value: geoJson }]
					}
				}));
			}

			if (requests.length === 0)
				return;

			ws.sendMultiple(requests, true).then(
				results => {
					for (let i = 0, j = results.length; i < j; i++) {
						const res = results[i].payload;

						// apply new record ID to feature
						if (features[i] !== undefined && features[i].getId() === undefined && res.indexRecordIds['0'] !== undefined)
							features[i].setId(res.indexRecordIds['0']);
					}
				},
				this.$root.genericError
			);
		}
	}
};
