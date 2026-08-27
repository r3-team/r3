import { getTemplateGeoLayerBase } from '../shared/templates.js';
import MyAdminGeoLayerBase from './adminGeoLayerBase.js';

export default {
	name: 'my-admin-geo-layers-base',
	components: { MyAdminGeoLayerBase },
	template: `<div class="admin-geo-layers-base contentBox grow">
		<div class="top">
			<div class="area">
				<img class="icon" src="images/map.png" />
				<h1>{{ menuTitle }}</h1>
			</div>
		</div>
		<div class="top lower">
			<div class="area">
				<my-button image="add.png"
					@trigger="open(null)"
					:caption="capGen.button.new"
				/>
				<my-button image="refresh.png"
					@trigger="get"
					:caption="capGen.button.refresh"
				/>
			</div>
		</div>

		<div class="content grow">
			<div class="generic-entry-list wide">
				<div class="entry clickable"
					v-for="l in layersBase"
					@click="open(l)"
					:key="l.id"
					:title="l.name"
				>
					<div class="lines">
						<span>{{ l.name }}</span>
						<span class="subtitle">EPSG:{{ l.srid }} ({{ l.url }})</span>
					</div>
				</div>
			</div>
		</div>

		<my-admin-geo-layer-base
			v-if="layerBaseOpen !== null"
			v-model="layerBaseOpen"
			@close="close"
			@makeNew="open(null)"
			@reload="get"
			:isNew
		/>
	</div>`,
	props: {
		menuTitle: { type: String, required: true }
	},
	data() {
		return {
			// data
			layersBase: [],

			// states
			isNew: false,
			layerBaseOpen: null // contains layerBase as object (null = no layerBase open)
		};
	},
	computed: {
		// stores
		capGen: s => s.$store.getters.captions.generic
	},
	mounted() {
		this.get();
		this.$store.commit('pageTitle', this.menuTitle);
	},
	methods: {
		// externals
		getTemplateGeoLayerBase,

		// actions
		close() {
			this.layerBaseOpen = null;
		},
		open(lb) {
			this.isNew = lb === null;
			this.layerBaseOpen = this.isNew ? this.getTemplateGeoLayerBase() : lb;
		},

		// backend calls
		get() {
			ws.send('geoLayerBase', 'get', null, true).then(
				res => { this.layersBase = res.payload; },
				this.$root.genericError
			);
		}
	}
};
