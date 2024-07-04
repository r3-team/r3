import MyBuilderPreset from './builderPreset.js';
export {MyBuilderPresets as default};

let MyBuilderPresets = {
	name:'my-builder-presets',
	components:{MyBuilderPreset},
	template:`<div class="generic-entry-list">
		<div class="entry"
			v-if="!readonly"
			@click="idEdit = null"
			:class="{ clickable:!readonly }"
		>
			<div class="row gap centered">
				<img class="icon" src="images/add.png" />
				<span>{{ capGen.button.new }}</span>
			</div>
		</div>
		
		<div class="entry clickable"
			@click="idEdit = p.id"
			v-for="p in relation.presets"
		>
			<div class="row centered gap">
				<my-button
					:active="false"
					:image="p.protected ? 'lock.png' : 'lockOpen.png'"
					:naked="true"
				/>
				<div class="lines">
					<span>{{ p.name }}</span>
					<span class="subtitle">{{ getPreview(p) }}</span>
				</div>
			</div>
			<div class="row centered gap">
			</div>
		</div>
		
		<my-builder-preset
			v-if="idEdit !== false"
			@close="idEdit = false"
			:id="idEdit"
			:readonly="readonly"
			:relation="relation"
		/>
	</div>`,
	props:{
		readonly:{ type:Boolean, required:true },
		relation:{ type:Object,  required:true }
	},
	data() {
		return {
			idEdit:false
		};
	},
	computed:{
		// stores
		capApp:(s) => s.$store.getters.captions.builder.preset,
		capGen:(s) => s.$store.getters.captions.generic
	},
	methods:{
		// presentation
		getPreview(preset) {
			let items = [];
			for(let v of preset.values) {
				if(v.value !== '')
					items.push(v.protected ? `[${v.value}]` : v.value);
			}
			const line = items.join(', ');

			return line.length < 50 ? line : `${line.substring(0,50)}...`;
		}
	}
};