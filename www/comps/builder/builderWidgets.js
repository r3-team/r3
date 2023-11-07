import MyBuilderWidget    from './builderWidget.js';
import {routeParseParams} from '../shared/router.js';
export {MyBuilderWidgets as default};

let MyBuilderWidgets = {
	name:'my-builder-widgets',
	components:{ MyBuilderWidget },
	template:`<div class="builder-widgets contentBox grow">
		<div class="top lower">
			<div class="area nowrap">
				<img class="icon" src="images/tiles.png" />
				<h1 class="title">{{ capApp.title }}</h1>
			</div>
			<div class="area default-inputs">
				<input v-model="filter" placeholder="..." />
			</div>
		</div>
		
		<div class="content default-inputs" v-if="module">
			<div class="generic-entry-list">
				
				<div class="entry"
					v-if="!readonly"
					@click="$emit('createNew','widget')"
					:class="{ clickable:!readonly }"
				>
					<div class="row gap centered">
						<img class="icon" src="images/add.png" />
						<span>{{ capGen.button.new }}</span>
					</div>
				</div>
				
				<div class="entry clickable"
					v-for="w in module.widgets.filter(v => filter === '' || v.name.toLowerCase().includes(filter.toLowerCase()))"
					@click="widgetIdEdit = w.id"
				>
					<div class="lines">
						<span>{{ w.name }}</span>
					</div>
				</div>
			</div>
		</div>
		
		<!-- widget dialog -->
		<my-builder-widget
			v-if="module && widgetIdEdit !== false"
			@close="widgetIdEdit = false"
			@next-language="$emit('nextLanguage')"
			@new-record="widgetIdEdit = null"
			:attributeId="widgetIdEdit"
			:builderLanguage="builderLanguage"
			:module="module"
			:readonly="readonly"
			:widgetId="widgetIdEdit"
		/>
	</div>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		id:             { type:String,  required:true },
		readonly:       { type:Boolean, required:true }
	},
	data() {
		return {
			filter:'',
			widgetIdEdit:false
		};
	},
	computed:{
		module:(s) => typeof s.moduleIdMap[s.id] === 'undefined' ? false : s.moduleIdMap[s.id],
		
		// stores
		moduleIdMap:(s) => s.$store.getters['schema/moduleIdMap'],
		capApp:     (s) => s.$store.getters.captions.builder.widget,
		capGen:     (s) => s.$store.getters.captions.generic
	},
	mounted() {
		let params = { widgetIdEdit:{ parse:'string', value:null } };
		this.routeParseParams(params);
		
		if(params.widgetIdEdit.value !== null)
			this.widgetIdEdit = params.widgetIdEdit.value;
	},
	methods:{
		// external
		routeParseParams
	}
};