import { getUuidV4 } from './shared/crypto.js';
import { colorApplyAlpha, colorDarken } from './shared/generic.js';
import { jsLibrariesLoadNoCache } from './shared/jsLibrary.js';
import { getCaption } from './shared/language.js';

export default Vue.defineAsyncComponent(async () => {

	await jsLibrariesLoadNoCache(["externals/openlayers/ol.js", "externals/proj4.js"]);

	return {
		name: "my-map",
		template: `<div class="my-map">
			<div class="my-map-content" ref="map" @click.right.prevent="switchTool(null)"></div>
			<div class="my-map-toolbox">
				<div class="my-map-tool"
					v-for="t in tools"
					@click.left.exact="switchTool(t)"
					@click.right.exact.prevent="switchTool(null)"
					:class="{ clickable:toolUseable[t], active:toolActive === t }"
				>
					<img :src="'images/'+toolImages[t]" />
				</div>

				<div class="my-map-spacer vertical"></div>

				<div class="my-map-tool"
					@click.left.exact="switchTool('delete')"
					@click.right.exact.prevent="switchTool(null)"
					:class="{ clickable:toolUseable.delete, active:toolActive === 'delete' }"
				>
					<img :src="'images/'+toolImages.delete" />
				</div>
			</div>
			<div class="my-map-layers">
				<my-button image="add2.png" @trigger="changeMapZoom(true)" :naked="true" />
				<my-button image="dash2.png" @trigger="changeMapZoom(false)" :naked="true" />

				<!-- data layer selection -->
				<template v-if="layersData.length !== 0">
					<div class="my-map-spacer horizontal"></div>
					<my-label image="database.png" />
					<template v-for="(l,i) in layersData">
						<my-button
							@trigger="switchLayerData(l.id)"
							:active="!l.readonly && !layerDataIdsHidden.includes(l.id)"
							:caption="getCaption('fieldMapLayerDataTitle',moduleId,l.id,l.captions,capGen.layer + ' ' + (i+1))"
							:image="l.readonly ? '' : (layerDataIdEdit === l.id && !layerDataIdsHidden.includes(l.id) ? 'radio1.png' : 'radio0.png')"
							:naked="true"
						/>
						<my-button
							@trigger="switchLayerVisibility(l.id,true)"
							:image="layerDataIdsHidden.includes(l.id) ? 'visible0.png' : 'visible1.png'"
							:naked="true"
						/>
					</template>
				</template>

				<!-- base layer selection -->
				<template v-if="layersBase.length !== 0">
					<div class="my-map-spacer horizontal"></div>
					<my-label image="map.png" />
					<template v-for="(l,i) in layersBase">
						<span>{{ l.name }}</span>
						<my-button
							@trigger="switchLayerVisibility(l.id,false)"
							:image="layerBaseIdsHidden.includes(l.id) ? 'visible0.png' : 'visible1.png'"
							:naked="true"
						/>
					</template>
				</template>
			</div>
		</div>`,
		props: {
			layerDataDefinitions: { type: Array, required: true },
			formLoading: { type: Boolean, required: true },
			isHidden: { type: Boolean, required: false, default: false },
			layerBaseIds: { type: Array, required: false, default: ['32e54b0d-8d8c-4353-90b9-d5b709fb13ad'] },
			//layerBaseIds: { type: Array, required: false, default: [] },
			moduleId: { type: String, required: true },
			readonly: { type: Boolean, required: true },
			viewSrid: { type: Number, required: false, default: 3857 }, // view projection and CRS vectors are stored in
		},
		emits: ['open-form'],
		data() {
			return {
				interaction: {}, // current interactions (draw, modify, ...)
				interactionSelect: null, // select interaction, always active
				layerBaseIdsHidden: [],
				layerDataIdEdit: null,
				layerDataIdsHidden: [],
				geoJsonFormatter: null,
				map: null,
				sridsDefault: [3857, 4326], // supported by openlayers by default
				toolActive: null,
				tools: ['point', 'line', 'polygon', 'circle', 'modify'],
				toolImages: {
					circle: 'all.png',
					delete: 'delete.png',
					line: 'dotLine.png',
					point: 'dot.png',
					polygon: 'dotPolygon.png',
					modify: 'dotModify.png',
				}
			};
		},
		computed: {
			customSrids: s => {
				const out = [];
				if (!s.sridsDefault.includes(s.viewSrid)) out.push(s.viewSrid);
				for (const id of s.layerBaseIds) {
					const l = s.layerBaseIdMapInstance[id];
					if (!s.sridsDefault.includes(l.srid)) out.push(l.srid);
				}
				return out;
			},
			// base layers (readonly, WMF, tile map data, etc.) with meta data (id, name, ...)
			layersBase: s => {
				const out = [];

				// TEMP, OSM layer for reference
				out.push({ id: "TEMP", name: "OSM", layer: new ol.layer.Tile({ source: new ol.source.OSM() }) });

				for (const id of s.layerBaseIds) {
					const l = s.layerBaseIdMapInstance[id];
					const params = {};
					for (const k in l.parameters) {
						params[k.toUpperCase()] = l.parameters[k];
					}
					const source = new ol.source.TileWMS({ url: l.url, params, projection: `EPSG:${l.srid}` });
					out.push({ id, name: l.name, layer: new ol.layer.Tile({ source }) });
				}
				return out;
			},
			layerBaseIdMap: s => {
				const out = {};
				s.layersBase.forEach(v => { out[v.id] = v });
				return out;
			},

			// data layers (fetches data per query, writes back changes) with meta data (query, attributes, ...)
			layersData: s => {
				const out = [];
				for (const d of s.layerDataDefinitions) {
					if (d.query === null || d.query.joins.length === 0) continue;

					const source = new ol.source.Vector();
					const layer = new ol.layer.Vector({
						source,
						style: feature => {
							let colorFill = feature.get('colorFill') !== undefined ? feature.get('colorFill') : d.colorFill;
							colorFill = s.colorApplyAlpha(`#${colorFill}`, 0.4);
							return new ol.style.Style({
								fill: new ol.style.Fill({ color: colorFill }),
								stroke: new ol.style.Stroke({ color: s.colorDarken(colorFill, 70), width: 2.5 }),
							});
						}
					});

					const writableCreate = d.query.joins[0].applyCreate;
					const writableDelete = d.query.joins[0].applyDelete;
					const writableUpdate = d.query.joins[0].applyUpdate;

					out.push({
						...d,
						...{
							action: {
								create: writableCreate,
								delete: writableDelete,
								update: writableUpdate,
							},
							data: source,
							layer,
							readonly: !writableCreate && !writableDelete && !writableUpdate,
						},
					});
				}
				return out;
			},
			layerDataIdMap: s => {
				const out = {};
				s.layersData.forEach(v => { out[v.id] = v });
				return out;
			},

			// simple
			toolUseable: s => {
				return {
					circle: s.layerDataEditActive !== false && s.layerDataEditActive.action.create,
					delete: s.layerDataEditActive !== false && s.layerDataEditActive.action.delete,
					line: s.layerDataEditActive !== false && s.layerDataEditActive.action.create,
					modify: s.layerDataEditActive !== false && s.layerDataEditActive.action.update,
					point: s.layerDataEditActive !== false && s.layerDataEditActive.action.create,
					polygon: s.layerDataEditActive !== false && s.layerDataEditActive.action.create,
				};
			},
			layerDataEditActive: s => s.layerDataIdEdit !== null && !s.layerDataIdsHidden.includes(s.layerDataIdEdit) ? s.layerDataIdMap[s.layerDataIdEdit] : false,
			layersDataWritable: s => s.layersData.filter(v => !v.readonly),

			// stores
			attributeIdMap: s => s.$store.getters['schema/attributeIdMap'],
			capGen: s => s.$store.getters.captions.generic,
			layerBaseIdMapInstance: s => s.$store.getters.geoLayerBaseIdMap,
		},
		mounted() {
			this.geoJsonFormatter = new ol.format.GeoJSON();

			if (this.customSrids.length === 0)
				return this.reset();

			this.$watch('formLoading', v => {
				if (!v) this.get();
			});
			this.$watch('isHidden', v => {
				if (!v) this.$nextTick(() => this.reset());
			});

			// load custom CRS definitions, if need be
			import("../externals/proj4-list.js").then((module) => {
				const list = module.default;

				const epsgDefs = [];
				for (const srid of this.customSrids) {
					const epsg = `EPSG:${srid}`;
					if (list[epsg] === undefined) {
						console.warn(`cannot find definition for ${epsg}, layer will not work correctly`,);
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
			colorApplyAlpha,
			colorDarken,
			getCaption,
			getUuidV4,

			// actions
			changeMapZoom(add) {
				this.map.getView().setZoom(this.map.getView().getZoom() + (add ? 1 : -1));
			},
			selectFeatures(e) {
				const features = e.selected;
				if (this.toolActive === 'delete') {
					// delete record if enabled
					if (this.layerDataEditActive !== false)
						this.del(features);

					return;
				}
				if (this.toolActive === null) {
					// open form for first valid feature with open-form action on layer
					for (const feature of features) {
						const l = this.layersData.find(v => v.data.getFeatures().includes(feature));
						const indexRecordIds = feature.get('indexRecordIds');
						if (l === undefined || indexRecordIds === undefined) {
							console.warn('cannot find feature to open in data sources');
							return;
						}
						if (l.openForm !== null && indexRecordIds[l.indexData] !== undefined) {
							this.$emit("open-form", [indexRecordIds[l.indexData]], l.openForm);
							break;
						}
					}
				}
			},
			switchLayerData(id) {
				this.layerDataIdEdit = id;
				this.switchTool(null);
			},
			switchLayerVisibility(id, isData) {
				const list = isData ? this.layerDataIdsHidden : this.layerBaseIdsHidden;
				const layer = isData ? this.layerDataIdMap[id].layer : this.layerBaseIdMap[id].layer;
				const pos = list.indexOf(id);

				if (pos === -1) {
					list.push(id);
					layer.setVisible(false);

					if (this.layerDataIdEdit === id) {
						// switch to other data layer if available, set to null otherwise
						let idSwitchTo = null;
						for (const l of this.layersData.filter(v => v.id !== id)) {
							idSwitchTo = l.id;
							break;
						}
						this.switchLayerData(idSwitchTo);
					}
				} else {
					list.splice(pos, 1);
					layer.setVisible(true);

					if (isData && this.layerDataIdEdit !== null && this.layerDataIdsHidden.includes(this.layerDataIdEdit))
						this.switchLayerData(id);
				}
			},
			switchTool(tool) {
				// remove previous interactions
				if (this.interaction.draw) this.map.removeInteraction(this.interaction.draw);
				if (this.interaction.modify) this.map.removeInteraction(this.interaction.modify);

				if (this.toolActive === tool || tool === null) {
					this.toolActive = null;
					return;
				}
				if (this.layerDataEditActive === false || !this.toolUseable[tool])
					return;

				const source = this.layerDataEditActive.data;

				// register new interactions
				switch (tool) {
					case 'circle':
						this.interaction.draw = new ol.interaction.Draw({ type: 'Circle', source });
						this.interaction.draw.on('drawend', e => { this.set([e.feature]); });
						this.map.addInteraction(this.interaction.draw);
						break;
					case 'delete':
						// delete uses regular 'select' interaction, which is always active
						break;
					case 'line':
						this.interaction.draw = new ol.interaction.Draw({ type: 'LineString', source });
						this.interaction.draw.on('drawend', e => { this.set([e.feature]); });
						this.map.addInteraction(this.interaction.draw);
						break;
					case 'modify':
						this.interaction.modify = new ol.interaction.Modify({ source });
						this.interaction.modify.on('modifyend', e => { this.set(e.features.getArray()); });
						this.map.addInteraction(this.interaction.modify);
						break;
					case 'point':
						this.interaction.draw = new ol.interaction.Draw({ type: 'Point', source });
						this.interaction.draw.on('drawend', e => { this.set([e.feature]); });
						this.map.addInteraction(this.interaction.draw);
						break;
					case 'polygon':
						this.interaction.draw = new ol.interaction.Draw({ type: 'Polygon', source });
						this.interaction.draw.on('drawend', e => { this.set([e.feature]); });
						this.map.addInteraction(this.interaction.draw);
						break;
					default:
						return console.error(`invalid tool '${tool}'`);
				}
				this.map.addInteraction(new ol.interaction.Snap({ source }));
				this.toolActive = tool;
			},

			// conversions
			geoJsonFrom(featureCollectionJson) {
				return this.geoJsonFormatter.readFeatures(featureCollectionJson, {
					dataProjection: 'EPSG:4326',
					featureProjection: this.map.getView().getProjection(),
				});
			},
			geoJsonTo(feature) {
				if (this.toolActive === 'circle') {
					// GeoJSON does not natively support Circle geometries, conversion to polygon is required
					feature.setGeometry(ol.geom.Polygon.fromCircle(feature.getGeometry()));
				}
				return this.geoJsonFormatter.writeFeatureObject(feature, {
					dataProjection: 'EPSG:4326',
					featureProjection: this.map.getView().getProjection(),
				});
			},

			// system
			reset() {
				if (this.map === null) {
					this.map = new ol.Map({
						target: this.$refs.map,
						layers: [],
						controls: [], // remove default controls like zoom
						view: new ol.View({
							center: [0, 0],
							projection: `EPSG:${this.viewSrid}`,
							zoom: 2,
						}),
					});

					// register default interactions
					// select action (for opening/deleting records)
					this.interactionSelect = new ol.interaction.Select();
					this.interactionSelect.on('select', this.selectFeatures);
					this.map.addInteraction(this.interactionSelect);

					for (const b of this.layersBase) {
						this.map.addLayer(b.layer);
					}
					for (const d of this.layersData) {
						this.map.addLayer(d.layer);
					}

					if (this.layersDataWritable.length !== 0)
						this.layerDataIdEdit = this.layersDataWritable[0].id;
				}
				this.get();
			},

			// backend calls
			del(features) {
				const requests = [];
				for (const feature of features) {
					const l = this.layersData.find(v => v.data.getFeatures().includes(feature));
					// to delete a feature, data layer for feature must exist and be in edit mode
					const indexRecordIds = feature.get('indexRecordIds');
					if (l === undefined || indexRecordIds === undefined) {
						console.warn('cannot find feature to delete in data sources');
						return;
					}
					if (this.layerDataIdEdit === l.id && indexRecordIds[l.indexData] !== undefined) {
						requests.push(ws.prepare('data', 'del', {
							relationId: this.attributeIdMap[l.attributeIdData].relationId,
							recordId: indexRecordIds[l.indexData]
						}));
					}
				}
				if (requests.length === 0)
					return;

				ws.sendMultiple(requests, true).then(
					responses => {
						for (let i = 0, j = responses.length; i < j; i++) {
							const l = this.layersData.find(v => v.data.getFeatures().includes(features[i]));
							if (l !== undefined)
								l.data.removeFeature(features[i]);

							this.interactionSelect.getFeatures().remove(features[i]);
						}
					},
					this.$root.genericError
				);
			},
			get() {
				if (this.layersData.length === 0)
					return;

				const requests = [];
				for (const l of this.layersData) {
					l.data.clear();
					const expressions = [{ attributeId: l.attributeIdData, index: l.indexData }];

					if (l.attributeIdDataColor !== null)
						expressions.push({ attributeId: l.attributeIdDataColor, index: l.indexDataColor });

					requests.push(
						ws.prepare('data', 'get', {
							relationId: l.query.relationId,
							joins: l.query.joins,
							expressions,
							filters: l.query.filters,
							getIds: true,
						}),
					);
				}
				ws.sendMultiple(requests, true).then((responses) => {
					for (let i = 0, j = responses.length; i < j; i++) {
						const res = responses[i];
						const layer = this.layersData[i];
						const featureCollectionJson = { type: 'FeatureCollection', features: [] };
						for (const r of res.payload.rows) {
							if (r.values[0] === null)
								continue;

							const feature = {
								type: 'Feature',
								geometry: r.values[0],
								properties: { indexRecordIds: r.indexRecordIds },
							};

							if (layer.attributeIdDataColor !== null && r.values[1] !== null)
								feature.properties.colorFill = r.values[1];

							featureCollectionJson.features.push(feature);
						}
						if (featureCollectionJson.features.length !== 0)
							layer.data.addFeatures(this.geoJsonFrom(featureCollectionJson));
					}
				}, this.$root.genericError);
			},
			set(features) {
				const layer = this.layerDataIdMap[this.layerDataIdEdit];
				const requests = [];
				for (const feature of features) {

					const indexRecordIds = feature.get('indexRecordIds');
					const relationIndexMap = {};

					// takeover SRID from the view
					feature.set('srid', this.viewSrid);
					feature.unset('indexRecordIds');

					for (const j of layer.query.joins) {
						const recordId = indexRecordIds?.[j.index] !== undefined ? indexRecordIds[j.index] : 0;

						if (recordId === 0 && !j.applyCreate)
							continue;

						relationIndexMap[j.index] = {
							relationId: j.relationId,
							attributeId: j.attributeId,
							indexFrom: j.indexFrom,
							recordId,
							attributes: j.index !== layer.indexData ? [] : [
								{ attributeId: layer.attributeIdData, value: this.geoJsonTo(feature) }
							],
						};
					}
					requests.push(ws.prepare('data', 'set', relationIndexMap));
				}
				if (requests.length === 0)
					return;

				ws.sendMultiple(requests, true).then((results) => {
					for (let i = 0, j = results.length; i < j; i++) {
						if (features[i] !== undefined)
							features[i].set('indexRecordIds', results[i].payload.indexRecordIds);
					}
				}, this.$root.genericError);
			},
		},
	};
});
