import { getUuidV4 } from './shared/crypto.js';
import { jsLibrariesLoadNoCache } from './shared/jsLibrary.js';

export default {
	name: 'my-map-ol',
	template: `<div class="my-map">
		<div class="my-map-toolbox">

		</div>
		<div class="my-map-content" ref="map"></div>
	</div>`,
	props: {
		draw: {
			type: Array, required: false, default: [{
				attributeIdColor: null,
				attributeIdData: '2f84cb84-5c80-4326-a9e9-c3a5b2cd59fe',
				id: 'a7899077-169c-475e-9cfb-68430a1ea82b',
				openForm: null,
				query: {
					relationId: 'a1611a6d-7739-42ab-a253-0cb17cefd64d'
				},
				captions: {
					layerTitle: {
						de_de: 'Layer 1',
						en_us: 'Layer 1'
					}
				}
			}]
		},
		//layerIdsGeo: { type: Array, required: false, default: ['32e54b0d-8d8c-4353-90b9-d5b709fb13ad'] },
		layerIdsGeo: { type: Array, required: false, default: [] },
		readonly: { type: Boolean, required: false, default: false },
		viewSrid: { type: Number, required: false, default: 3857 }, // view projection and CRS vectors are stored in
	},
	data() {
		return {
			geoJsonFormatter: null,
			drawIdMap: {}, // draw definitions by ID
			map: null,
			sridsDefault: [3857, 4326], // supported by openlayers by default
		};
	},
	computed: {
		customSrids: s => {
			const out = [];
			if (!s.sridsDefault.includes(s.viewSrid)) out.push(s.viewSrid);
			for (const id of s.layerIdsGeo) {
				const layer = s.layerIdMap[id];
				if (!s.sridsDefault.includes(layer.srid)) out.push(layer.srid);
			}
			return out;
		},
		layersGeo: s => {
			const out = [];
			for (const id of s.layerIdsGeo) {
				const layer = s.layerIdMap[id];
				const params = {};
				for (const k in layer.parameters) {
					params[k.toUpperCase()] = layer.parameters[k];
				}
				const source = new ol.source.TileWMS({ url: layer.url, params, projection: `EPSG:${layer.srid}` })
				out.push(new ol.layer.Tile({ source }));
			}

			// TEMP, OSM layer for reference
			out.push(new ol.layer.Tile({ source: new ol.source.OSM() }));

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

			// map definition
			this.map = new ol.Map({
				target: this.$refs.map,
				layers: this.layersGeo,
				view: new ol.View({
					center: [0, 0],
					projection: `EPSG:${this.viewSrid}`,
					zoom: 2,
				}),
			});

			// set draw layers
			this.drawIdMap = {};
			for (const d of this.draw) {
				const source = new ol.source.Vector();
				const layer = new ol.layer.Vector({ source: source });
				const interactionDraw = new ol.interaction.Draw({ type: 'Polygon', source });
				const interactionModify = new ol.interaction.Modify({ source });
				interactionDraw.on('drawend', e => { this.set([e.feature], d.id); });
				interactionModify.on('modifyend', e => { this.set(e.features.getArray(), d.id); });

				this.map.addLayer(layer);
				this.map.addInteraction(new ol.interaction.DragAndDrop({ formatConstructors: [ol.format.GeoJSON], source }));
				this.map.addInteraction(new ol.interaction.Snap({ source }));
				this.map.addInteraction(interactionDraw);
				this.map.addInteraction(interactionModify);

				this.drawIdMap[d.id] = {
					attributeIdData: d.attributeIdData,
					data: source,
					interaction: {
						draw: interactionDraw,
						modify: interactionModify
					},
					query: d.query,
					layer,
				};
			}

			// get data
			this.get();
		},

		// backend calls
		get() {
			const requests = [];
			for (const d of this.draw) {
				if (d.query === null) {
					console.warn('data query is undefined');
					return;
				}
				requests.push(ws.prepare('data', 'get', {
					relationId: d.query.relationId,
					joins: [],
					expressions: [{
						attributeId: d.attributeIdData,
						index: 0
					}],
					filters: [],
					getIds: true
				}));
			}

			if (requests.length === 0)
				return;

			ws.sendMultiple(requests, true).then(
				responses => {
					for (let i = 0, j = responses.length; i < j; i++) {
						const res = responses[i];
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
						if (featureCollectionJson.features.length !== 0) {
							const d = this.draw[i];
							if (this.drawIdMap[d.id] !== undefined)
								this.drawIdMap[d.id].data.addFeatures(this.geoJsonFrom(featureCollectionJson));
						}
					}
				},
				this.$root.genericError
			);
		},
		set(features, drawId) {
			const draw = this.drawIdMap[drawId];
			if (draw.query === null) {
				console.warn('data query is undefined');
				return;
			}

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

				requests.push(ws.prepare('data', 'set', {
					'0': {
						relationId: draw.query.relationId,
						indexFrom: -1,
						recordId,
						attributes: [{ attributeId: draw.attributeIdData, value: geoJson }]
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
