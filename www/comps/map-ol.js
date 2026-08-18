import { getUuidV4 } from './shared/crypto.js';
import { jsLibrariesLoadNoCache } from './shared/jsLibrary.js';
import { getCaption } from './shared/language.js';

export default Vue.defineAsyncComponent(async () => {

	await jsLibrariesLoadNoCache(["externals/openlayers/ol.js", "externals/proj4.js"]);

	return {
		name: "my-map-ol",
		template: `<div class="my-map">
			<div class="my-map-content" ref="map"></div>
			<div class="my-map-toolbox">
			</div>
			<div class="my-map-layers">
				<my-label image="edit.png" />

				<!-- data layer selection -->
				<div class="row nowrap gap centered"
					v-if="layersData.length !== 0"
					v-for="(l,i) in layersData"
				>
					<my-button
						v-if="!l.readonly"
						@trigger="layerDataIdEdit = l.id"
						:caption="getCaption('fieldMapLayerDataTitle',moduleId,l.id,l.captions,capGen.layer + ' ' + (i+1))"
						:image="l.readonly ? '' : (layerDataIdEdit === l.id ? 'radio1.png' : 'radio0.png')"
						:naked="true"
					/>
				</div>

				<!-- base layer selection -->
			</div>
		</div>`,
		props: {
			layerDataDefinitions: {
				type: Array,
				required: false,
				default: [
					{
						attributeIdColor: null,
						attributeIdData: "2f84cb84-5c80-4326-a9e9-c3a5b2cd59fe",
						id: "a7899077-169c-475e-9cfb-68430a1ea82b",
						openForm: null,
						query: {
							relationId: "a1611a6d-7739-42ab-a253-0cb17cefd64d",
							joins: [
								{
									relationId: "a1611a6d-7739-42ab-a253-0cb17cefd64d",
									connector: "AND",
									indexFrom: -1,
									index: 0,
									applyCreate: true,
									applyDelete: true,
									applyUpdate: true,
								},
							],
						},
						captions: {
							fieldMapLayerDataTitle: {
								de_de: "Gebäude",
								en_us: "Buildings",
							},
						},
					},
					{
						attributeIdColor: null,
						attributeIdData: "af9553ef-8ffb-417f-98bd-c3379c3f8223",
						id: "a7899077-169c-475e-9cfb-68430a1ea82c",
						openForm: null,
						query: {
							relationId: "efe7b874-75c9-4c3a-8923-68b31693f562",
							joins: [
								{
									relationId: "efe7b874-75c9-4c3a-8923-68b31693f562",
									connector: "AND",
									indexFrom: -1,
									index: 0,
									applyCreate: true,
									applyDelete: true,
									applyUpdate: true,
								},
							],
						},
						captions: {
							fieldMapLayerDataTitle: {
								de_de: "Grundstücke",
								en_us: "Properties",
							},
						},
					},
				],
			},
			//layerIdsBase: { type: Array, required: false, default: ['32e54b0d-8d8c-4353-90b9-d5b709fb13ad'] },
			layerBaseIds: { type: Array, required: false, default: [] },
			moduleId: { type: String, required: true },
			readonly: { type: Boolean, required: true },
			viewSrid: { type: Number, required: false, default: 3857 }, // view projection and CRS vectors are stored in
		},
		data() {
			return {
				layerDataIdEdit: null,
				geoJsonFormatter: null,
				map: null,
				sridsDefault: [3857, 4326], // supported by openlayers by default
			};
		},
		computed: {
			customSrids: s => {
				const out = [];
				if (!s.sridsDefault.includes(s.viewSrid)) out.push(s.viewSrid);
				for (const id of s.layerBaseIds) {
					const layer = s.layerBaseIdMap[id];
					if (!s.sridsDefault.includes(layer.srid)) out.push(layer.srid);
				}
				return out;
			},
			// base layers (readonly, WMF, tile map data, etc.) with meta data (id, name, ...)
			layersBase: s => {
				const out = [];
				for (const id of s.layerBaseIds) {
					const l = s.layerBaseIdMap[id];
					const params = {};
					for (const k in l.parameters) {
						params[k.toUpperCase()] = l.parameters[k];
					}
					const source = new ol.source.TileWMS({
						url: l.url,
						params,
						projection: `EPSG:${l.srid}`,
					});
					out.push({ id, name: l.name, layer: new ol.layer.Tile({ source }) });
				}

				// TEMP, OSM layer for reference
				out.push({
					id: "TEMP",
					name: "OSM",
					layer: new ol.layer.Tile({ source: new ol.source.OSM() }),
				});

				return out;
			},
			layersBaseIdMap: s => {
				const out = {};
				for (const layer of s.layersBase) {
					out[layer.id] = layer;
				}
				return out;
			},

			// data layers (fetches data per query, writes back changes) with meta data (query, attributes, ...)
			layersData: s => {
				const out = [];
				for (const d of s.layerDataDefinitions) {
					if (d.query === null || d.query.joins.length === 0) continue;

					const source = new ol.source.Vector();
					const writableCreate = d.query.joins[0].applyCreate;
					const writableDelete = d.query.joins[0].applyDelete;
					const writableUpdate = d.query.joins[0].applyUpdate;

					const interaction = {};
					if (writableCreate) {
						interaction.draw = new ol.interaction.Draw({
							type: "Polygon",
							source,
						});
						interaction.draw.on("drawend", (e) => {
							s.set([e.feature], d.id);
						});
					}
					if (writableDelete) {
						// TEMP, ToDo
					}
					if (writableUpdate) {
						interaction.modify = new ol.interaction.Modify({ source });
						interaction.modify.on("modifyend", (e) => {
							s.set(e.features.getArray(), d.id);
						});
					}
					out.push({
						attributeIdColor: d.attributeIdColor,
						attributeIdData: d.attributeIdData,
						captions: d.captions,
						data: source,
						id: d.id,
						interaction,
						query: d.query,
						layer: new ol.layer.Vector({ source: source }),
						readonly: !writableCreate && !writableDelete && !writableUpdate,
					});
				}
				return out;
			},
			layersDataIdMap: s => {
				const out = {};
				for (const layer of s.layersData) {
					out[layer.id] = layer;
				}
				return out;
			},

			// stores
			capGen: s => s.$store.getters.captions.generic,
			layerBaseIdMap: s => s.$store.getters.geoLayerBaseIdMap,
		},
		mounted() {
			if (this.customSrids.length === 0) return this.reset();

			// load custom CRS definitions, if need be
			import("../externals/proj4-list.js").then((module) => {
				const list = module.default;

				const epsgDefs = [];
				for (const srid of this.customSrids) {
					const epsg = `EPSG:${srid}`;
					if (list[epsg] === undefined) {
						console.warn(
							`cannot find definition for ${epsg}, layer will not work correctly`,
						);
						continue;
					}
					epsgDefs.push(list[epsg]);
				}
				proj4.defs(epsgDefs);
				ol.proj.proj4.register(proj4);
				this.reset();
			}, this.$root.genericError);
		},
		unmounted() { },
		methods: {
			// externals
			getCaption,
			getUuidV4,

			// conversions
			geoJsonFrom(featureCollectionJson) {
				return this.geoJsonFormatter.readFeatures(featureCollectionJson, {
					dataProjection: "EPSG:4326",
					featureProjection: this.map.getView().getProjection(),
				});
			},
			geoJsonTo(feature) {
				return this.geoJsonFormatter.writeFeatureObject(feature, {
					dataProjection: "EPSG:4326",
					featureProjection: this.map.getView().getProjection(),
				});
			},

			// system
			reset() {
				this.geoJsonFormatter = new ol.format.GeoJSON();

				this.map = new ol.Map({
					target: this.$refs.map,
					layers: [],
					view: new ol.View({
						center: [0, 0],
						projection: `EPSG:${this.viewSrid}`,
						zoom: 2,
					}),
				});

				for (const b of this.layersBase) {
					this.map.addLayer(b.layer);
				}
				for (const d of this.layersData) {
					this.map.addLayer(d.layer);
					if (!d.readonly) {
						this.map.addInteraction(
							new ol.interaction.DragAndDrop({
								formatConstructors: [ol.format.GeoJSON],
								source: d.data,
							}),
						);
						this.map.addInteraction(
							new ol.interaction.Snap({ source: d.data }),
						);

						if (d.interaction.draw !== undefined)
							this.map.addInteraction(d.interaction.draw);
						if (d.interaction.modify !== undefined)
							this.map.addInteraction(d.interaction.modify);
					}
				}
				this.get();
			},

			// backend calls
			get() {
				const requests = [];
				for (const d of this.layersData) {
					requests.push(
						ws.prepare("data", "get", {
							relationId: d.query.relationId,
							joins: [],
							expressions: [
								{
									attributeId: d.attributeIdData,
									index: 0,
								},
							],
							filters: [],
							getIds: true,
						}),
					);
				}

				if (requests.length === 0) return;

				ws.sendMultiple(requests, true).then((responses) => {
					for (let i = 0, j = responses.length; i < j; i++) {
						const res = responses[i];
						const featureCollectionJson = {
							type: "FeatureCollection",
							features: [],
						};
						for (const r of res.payload.rows) {
							if (r.values[0] === null) continue;

							featureCollectionJson.features.push({
								type: "Feature",
								geometry: r.values[0],
								id: r.indexRecordIds["0"],
							});
						}
						if (featureCollectionJson.features.length !== 0)
							this.layersData[i].data.addFeatures(
								this.geoJsonFrom(featureCollectionJson),
							);
					}
				}, this.$root.genericError);
			},
			set(features, layerDataId) {
				const layer = this.layersDataIdMap[layerDataId];
				const requests = [];
				for (const feature of features) {
					// takeover SRID from the view
					feature.set("srid", this.viewSrid);

					const geoJson = this.geoJsonTo(feature);
					let recordId = 0;
					if (feature.getId() !== undefined) {
						// get existing record ID, remove from JSON as its not standard and not required
						recordId = feature.getId();
						delete geoJson.id;
					}

					requests.push(
						ws.prepare("data", "set", {
							0: {
								relationId: layer.query.relationId,
								indexFrom: -1,
								recordId,
								attributes: [
									{ attributeId: layer.attributeIdData, value: geoJson },
								],
							},
						}),
					);
				}

				if (requests.length === 0) return;

				ws.sendMultiple(requests, true).then((results) => {
					for (let i = 0, j = results.length; i < j; i++) {
						const res = results[i].payload;

						// apply new record ID to feature
						if (
							features[i] !== undefined &&
							features[i].getId() === undefined &&
							res.indexRecordIds["0"] !== undefined
						)
							features[i].setId(res.indexRecordIds["0"]);
					}
				}, this.$root.genericError);
			},
		},
	};
});
