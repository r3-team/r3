import MyBuilderTransfer from './builderTransfer.js';
import srcBase64Icon     from '../shared/image.js';

const MyBuilderModulesGraph = {
	name:'my-builder-modules-graph',
	components:{
		echarts:VueECharts,
	},
	template:`<div class="contentBox grow">
		<div class="builder-modules-graph">
			<echarts :option="graphOption" :theme="settings.dark ? 'dark' : ''" />
		</div>
	</div>`,
	computed:{
		graphOption:s => {
			let edges = [];
			let nodes = [];
			
			for(let i = 0, j = s.modules.length; i < j; i++) {
				let m = s.modules[i];
				
				nodes.push({
					id:m.id,
					name:m.name,
					label:{
						show:true
					},
					symbolSize:30,
					value:s.capApp.graphDependsOn.replace('{COUNT}',m.dependsOn.length)
				});
				
				for(let x = 0, y = m.dependsOn.length; x < y; x++) {
					edges.push({
						'source':m.id,
						'target':m.dependsOn[x]
					});
				}
			}
			return {
				backgroundColor:'transparent',
				label: {
					position:'right'
				},
				series:[{
					data:nodes,
					edges:edges,
					edgeSymbol:['none','arrow'],
					emphasis: {
						focus:'adjacency'
					},
					force:{
						edgeLength:200,
						gravity:0,
						initLayout:'circular',
						layoutAnimation:true,
						repulsion:500
					},
					layout:'force',
					roam:true, // user move/zoom
					type:'graph'
				}],
				tooltip:{} // must be set
			};
		},
		
		// stores
		modules: s => s.$store.getters['schema/modules'],
		capApp:  s => s.$store.getters.captions.builder.module,
		settings:s => s.$store.getters.settings
	}
};

export default {
	name:'my-builder-modules',
	components:{
		MyBuilderModulesGraph,
		MyBuilderTransfer
	},
	template:`<div class="builder-modules">
		<my-tabs
			v-model="tabTarget"
			:entries="tabs.entries"
			:entriesIcon="tabs.icons"
			:entriesText="tabs.texts"
		/>
		<my-builder-modules-graph v-if="tabTarget === 'dependencies'" />
		<my-builder-transfer      v-if="tabTarget === 'transfer'"     />

		<div class="contentBox grow" v-if="tabTarget === 'modules'">
			
			<div class="top">
				<div class="area"></div>
				<div class="area">
					<my-button image="builder.png"
						@trigger="$router.push('/admin/modules')"
						:caption="capApp.button.manageApps"
					/>
					<my-button image="question.png"
						@trigger="$emit('toggleHelp')"
						:caption="capGen.help"
					/>
				</div>
			</div>
			
			<div class="content min-height">
				<div class="item-list">
				
					<!-- new module -->
					<div class="item-wrap new shade">
						<div class="item clickable" @click="$emit('createNew','module')">
							<img src="images/module.png" />
							<span>{{ capGen.button.new }}</span>
						</div>
					</div>
					
					<!-- existing modules -->
					<div class="item-wrap shade" v-for="m in modules.filter(v => v.parentId === null)">
						<router-link class="item parent"
							:title="capApp.position+': '+m.position"
							:to="'/builder/start/'+m.id"
						>
							<div class="color" :style="'background-color:#'+m.color1"></div>
							<img :src="srcBase64Icon(m.iconId,'images/module.png')" />
							<span>{{ m.name + ' - v' + m.releaseBuild }}</span>
						</router-link>
						
						<div class="item-children">
							<router-link class="item"
								v-for="mc in modules.filter(v => v.parentId === m.id)"
								:title="capApp.position+': '+m.position" 
								:to="'/builder/start/'+mc.id"
							>
								<div class="color" :style="'background-color:#'+mc.color1"></div>
								<img :src="srcBase64Icon(mc.iconId,'images/module.png')" />
								<span>{{ mc.name + ' - v' + mc.releaseBuild }}</span>
							</router-link>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>`,
	props:{
		builderLanguage:{ type:String, required:true }
	},
	emits:['createNew','toggleHelp'],
	data() {
		return {
			tabTarget:'modules'
		};
	},
	computed:{
		tabs:s => {
			return {
				entries:['modules','transfer','dependencies'],
				icons:['images/builder.png','images/box.png','images/hierarchy.png'],
				texts:[s.capGen.applications,s.capGen.transfer,s.capApp.button.graph]
			};
		},

		// stores
		modules:s => s.$store.getters['schema/modules'],
		capApp: s => s.$store.getters.captions.builder.module,
		capGen: s => s.$store.getters.captions.generic
	},
	methods:{
		srcBase64Icon
	}
};