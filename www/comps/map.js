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
			<div class="my-map-toolbox" v-if="layersData.length !== 0">

				<div class="my-map-tool clickable" @click.left.exact="get" :title="capGen.button.refresh">
					<img src="images/refresh.png" />
				</div>
				<div class="my-map-spacer vertical"></div>
				<div class="my-map-tool"
					v-for="t in tools"
					@click.left.exact="switchTool(t)"
					@click.right.exact.prevent="switchTool(null)"
					:class="{ clickable:toolUseable[t], active:toolActive === t }"
					:title="toolMeta[t].hint"
				>
					<img :src="'images/'+toolMeta[t].image" />
				</div>

				<div class="my-map-spacer vertical"></div>
				<div class="my-map-tool"
					@click.left.exact="switchTool(null)"
					:class="{ clickable:toolUseable.select, active:toolActive === null }"
					:title="capGen.recordOpen"
				>
					<img src="images/open.png" />
				</div>
				<div class="my-map-tool"
					@click.left.exact="switchTool('delete')"
					@click.right.exact.prevent="switchTool(null)"
					:class="{ clickable:toolUseable.delete, active:toolActive === 'delete' }"
					:title="capGen.recordRemove"
				>
					<img src="images/delete.png" />
				</div>
			</div>
			<div class="my-map-layers">

				<!-- data layer selection -->
				<template v-if="layersData.length !== 0">
					<my-label image="database.png" :captionTitle="capGen.layersData" />
					<div class="my-map-layer" v-for="(l,i) in layersData" :class="{ active:layerDataIdEdit === l.id && !layerDataIdsHidden.includes(l.id) }">
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
					</div>
				</template>

				<!-- base layer selection -->
				<template v-if="layersBase.length !== 0">
					<div class="my-map-spacer horizontal"></div>
					<my-label image="map.png" :captionTitle="capGen.layersBase"  />
					<div class="my-map-layer" v-for="(l,i) in layersBase">
						<span>{{ l.name }}</span>
						<my-button
							@trigger="switchLayerVisibility(l.id,false)"
							:image="layerBaseIdsHidden.includes(l.id) ? 'visible0.png' : 'visible1.png'"
							:naked="true"
						/>
					</div>
				</template>

				<div class="my-map-spacer horizontal"></div>
				<my-button image="search.png" @trigger="mapZoomReset" :naked="true" />
				<my-button image="add2.png" @trigger="mapZoomChange(true)" :naked="true" />
				<my-button image="dash2.png" @trigger="mapZoomChange(false)" :naked="true" />
			</div>
		</div>`,
		props: {
			fieldId: { type: String, required: true },
			formLoading: { type: Boolean, required: true },
			isHidden: { type: Boolean, required: false, default: false },
			layerDataDefinitions: { type: Array, required: true },
			layerIdMapFilters: { type: Object, required: true }, // processed filters for each layer
			moduleId: { type: String, required: true },
			readonly: { type: Boolean, required: true },
		},
		emits: ['open-form'],
		data() {
			return {
				coordinatesStart: [0, 0],
				featurePropertiesFrontend: ['colorFill', 'indexRecordIds'],
				interaction: {}, // current interactions (draw, modify, ...)
				interactionHover: null, // hover interaction, always active
				isReady: false,
				layerBaseIds: [], // IDs of base layers used for this map
				layerBaseIdsHidden: [], // IDs of hidden base layers
				layerDataIdEdit: null, // ID of data layer active for editing
				layerDataIdsHidden: [], // IDs of hidden data layers
				geoJsonFormatter: null,
				map: null,
				sridsDefault: [3857, 4326], // supported by openlayers by default
				toolActive: null,
				tools: ['point', 'line', 'polygon', 'circle', 'modify'],
				viewSrid: 3857, // view projection and CRS vectors are stored in
				zoomDefault: 2,
			};
		},
		computed: {
			// base layers (readonly, WMF, tile map data, etc.) with meta data (id, name, ...)
			layersBase: s => {
				const out = [];
				for (const id of s.layerBaseIds) {
					const l = s.layerBaseIdMapInstance[id];
					if (l === undefined)
						continue;

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
						style: f => {
							const isPoint = f.getGeometry().getType() === 'Point';
							return s.getFeatureStyle(f.get('colorFill') ?? d.colorFill, false, isPoint);
						}
					});
					layer.set('id', d.id);

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
			toolMeta: s => {
				return {
					circle: { hint: `${s.capGen.draw}: ${s.capGen.circle}`, image: 'all.png' },
					line: { hint: `${s.capGen.draw}: ${s.capGen.line}`, image: 'dotLine.png' },
					point: { hint: `${s.capGen.draw}: ${s.capGen.point}`, image: 'dot.png' },
					polygon: { hint: `${s.capGen.draw}: ${s.capGen.polygon}`, image: 'dotPolygon.png' },
					modify: { hint: s.capGen.button.edit, image: 'dotModify.png' },
				};
			},
			toolUseable: s => {
				return {
					circle: s.layerDataEditActive !== false && s.layerDataEditActive.action.create,
					delete: s.layerDataEditActive !== false && s.layerDataEditActive.action.delete,
					line: s.layerDataEditActive !== false && s.layerDataEditActive.action.create,
					modify: s.layerDataEditActive !== false && s.layerDataEditActive.action.update,
					point: s.layerDataEditActive !== false && s.layerDataEditActive.action.create,
					polygon: s.layerDataEditActive !== false && s.layerDataEditActive.action.create,
					select: s.layerDataEditActive !== false && s.layerDataEditActive.action.update,
				};
			},

			// simple
			layerDataEditActive: s => s.layerDataIdEdit !== null && !s.layerDataIdsHidden.includes(s.layerDataIdEdit) ? s.layerDataIdMap[s.layerDataIdEdit] : false,
			layersDataWritable: s => s.layersData.filter(v => !v.readonly),
			toolHoverEnabled: s => s.layerDataEditActive !== false && (s.toolActive === null || s.toolActive === 'delete'),

			// stores
			attributeIdMap: s => s.$store.getters['schema/attributeIdMap'],
			capGen: s => s.$store.getters.captions.generic,
			layerBaseIdMapInstance: s => s.$store.getters.geoLayerBaseIdMap,
		},
		mounted() {
			this.geoJsonFormatter = new ol.format.GeoJSON();

			this.$watch('formLoading', v => {
				if (!v) this.get();
			});
			this.$watch('isHidden', v => {
				if (!v) this.$nextTick(() => this.reset());
			});
			this.$watch('layerIdMapFilters', (v, o) => {
				if (JSON.stringify(v) !== JSON.stringify(o))
					this.get();
			});

			// fetch base layers assigned to field
			ws.send('geoFieldAssign', 'get', this.fieldId, true).then(
				res => {
					let isUnknownLayerBase = false;
					this.coordinatesStart = [res.payload.coordLon, res.payload.coordLat];
					this.layerBaseIds = res.payload.layerBaseIds;
					this.layerBaseIdsHidden = res.payload.layerBaseIdsHidden;
					this.viewSrid = res.payload.srid;
					this.zoomDefault = res.payload.zoom;

					for (const id of this.layerBaseIds) {
						if (this.layerBaseIdMapInstance[id] === undefined)
							isUnknownLayerBase = true;
					}

					if (!isUnknownLayerBase)
						return this.reset();

					// refresh base layers
					const customSrids = [];
					ws.send('geoLayerBase', 'get', null, true).then(
						res => {
							const layerBaseIdMap = {};
							for (const l of res.payload) {
								layerBaseIdMap[l.id] = l;
							}
							this.$store.commit('geoLayerBaseIdMap', layerBaseIdMap);

							// check for non-default CRS
							if (!this.sridsDefault.includes(this.viewSrid))
								customSrids.push(this.viewSrid);

							for (const id of this.layerBaseIds) {
								const l = this.layerBaseIdMapInstance[id];
								if (!this.sridsDefault.includes(l.srid))
									customSrids.push(l.srid);
							}

							if (customSrids.length === 0)
								return this.reset();

							// register custom CRS definitions if needed
							import('../externals/proj4-list.js').then(module => {
								const list = module.default;

								const epsgDefs = [];
								for (const srid of customSrids) {
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
						this.$root.genericError
					);
				},
				this.$root.genericError
			);
		},
		unmounted() { },
		methods: {
			// externals
			colorApplyAlpha,
			colorDarken,
			getCaption,
			getUuidV4,

			// actions
			getFeatureStyle(colorFill, onHover, isPoint) {
				const alpha = onHover ? 0.7 : 0.4;
				const borderWidth = onHover ? 3.5 : 2.5;
				const scaleImage = onHover ? 0.8 : 0.6;
				colorFill = this.colorApplyAlpha(`#${colorFill}`, alpha);

				if (isPoint) {
					return [
						new ol.style.Style({
							image: new ol.style.Circle({
								radius: 8,
								fill: new ol.style.Fill({ color: colorFill }),
								stroke: new ol.style.Stroke({ color: this.colorDarken(colorFill, 70), width: borderWidth }),
							})
						}),
						new ol.style.Style({
							image: new ol.style.Icon({
								anchor: [0.5, 1],
								anchorXUnits: 'fraction',
								anchorYUnits: 'fraction',
								opacity: 0.8,
								src: 'images/location.png',
								scale: scaleImage,
							})
						})
					];
				}
				return new ol.style.Style({
					fill: new ol.style.Fill({ color: colorFill }),
					stroke: new ol.style.Stroke({ color: this.colorDarken(colorFill, 70), width: borderWidth }),
				});
			},
			mapZoomChange(add) {
				this.map.getView().setZoom(this.map.getView().getZoom() + (add ? 1 : -1));
			},
			mapZoomReset() {
				this.map.getView().setZoom(this.zoomDefault);
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
							center: ol.proj.fromLonLat(this.coordinatesStart),
							projection: `EPSG:${this.viewSrid}`,
							zoom: this.zoomDefault,
						}),
					});

					// default hover action
					this.interactionHover = new ol.interaction.Select({
						condition: ol.events.condition.pointerMove,
						filter: (f, l) => this.toolHoverEnabled && l.get('id') === this.layerDataIdEdit,
						style: f => {
							const l = this.layerDataEditActive;
							const isPoint = f.getGeometry().getType() === 'Point';
							return this.getFeatureStyle(f.get('colorFill') ?? l.colorFill, true, isPoint);
						}
					});
					this.map.addInteraction(this.interactionHover);

					// click actions (record open/delete)
					this.map.on('singleclick', e => {
						this.map.forEachFeatureAtPixel(e.pixel, f => {
							if (this.layerDataEditActive === false)
								return;

							if (this.toolActive === 'delete')
								return this.del(f);

							if (this.toolActive === null && this.toolUseable.select) {
								const l = this.layerDataEditActive;
								const data = l.data;
								if (data.getFeatures().includes(f) === undefined)
									return console.warn("cannot find feature to open in data sources");

								// open form for first valid feature with open-form action on layer
								const indexRecordIds = f.get('indexRecordIds');
								if (l.openForm !== null && indexRecordIds?.[l.indexData] !== undefined)
									return this.$emit("open-form", [indexRecordIds[l.indexData]], l.openForm);
							}
						}, {
							layerFilter: l => l.get('id') === this.layerDataIdEdit
						});
					});

					for (const b of this.layersBase) {
						this.map.addLayer(b.layer);

						if (this.layerBaseIdsHidden.includes(b.id))
							b.layer.setVisible(false);
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
			del(feature) {
				const requests = [];
				const indexRecordIds = feature.get('indexRecordIds');
				const l = this.layerDataEditActive;
				if (l !== false && indexRecordIds?.[l.indexData] !== undefined) {
					for (const j of l.query.joins) {
						const recordId = indexRecordIds?.[j.index] !== undefined ? indexRecordIds[j.index] : 0;
						if (recordId !== 0 && j.applyDelete)
							requests.push(ws.prepare('data', 'del', { relationId: j.relationId, recordId }));
					}
				}
				if (requests.length === 0)
					return;

				let featureRemoved = false;
				ws.sendMultiple(requests, true).then(
					() => {
						if (!featureRemoved) {
							const l = this.layerDataEditActive;
							if (l !== false)
								l.data.removeFeature(feature);

							featureRemoved = true;
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
							filters: this.layerIdMapFilters[l.id] ?? [],
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

					// remove all properties we use for frontend
					for (const prop of this.featurePropertiesFrontend) {
						feature.unset(prop);
					}

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
