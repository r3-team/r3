import MyBuilderCaption      from './builderCaption.js';
import MyBuilderIconInput    from './builderIconInput.js';
import {MyModuleSelect}      from '../input.js';
import srcBase64Icon         from '../shared/image.js';
import {getDependentModules} from '../shared/builder.js';
import {copyValueDialog}     from '../shared/generic.js';
import {getUnixFormat}       from '../shared/time.js';
export {MyBuilderModules as default};

let displayArrow = function(state) {
	return state ? 'images/triangleDown.png' : 'images/triangleRight.png';
};

let MyBuilderModulesKeyCreate = {
	name:'my-builder-modules-key-create',
	template:`<div class="builder-modules-key-create contentBox grow">
		
		<div class="top nowrap clickable" @click="show = !show">
			<div class="area nowrap">
				<img class="icon" :src="displayArrow(show)" />
				<h1 class="title">{{ capApp.keyCreate }}</h1>
			</div>
		</div>
		
		<div class="content default-inputs" v-if="show">
		
			<div class="key-pair-input">
				<select v-model="keyLength" :disabled="running">
					<option value="0">{{ capApp.keyCreateLength }}</option>
					<option value="2048">2048</option>
					<option value="4096">4096</option>
					<option value="8192">8192</option>
					<option value="16384">16384</option>
				</select>
				
				<my-button
					@trigger="createKey"
					:active="keyLength !== '0' && !running"
					:caption="capApp.button.keyCreate"
					:image="!running ? 'key.png' : 'load.gif'"
				/>
			</div>
			
			<template v-if="keyPrivate !== ''">
				<p>{{ capApp.keyCreateInfo }}</p>
				
				<div class="key-pair">
					<textarea :value="keyPrivate"></textarea>
					<textarea :value="keyPublic"></textarea>
				</div>
			</template>
		</div>
	</div>`,
	computed:{
		// stores
		capApp:(s) => s.$store.getters.captions.builder.module,
		capGen:(s) => s.$store.getters.captions.generic
	},
	data:function() {
		return {
			keyLength:'0',
			keyPrivate:'',
			keyPublic:'',
			running:false,
			show:false
		};
	},
	methods:{
		displayArrow,
		createKey() {
			ws.send('key','create',{keyLength:parseInt(this.keyLength)},true).then(
				res => {
					this.keyPrivate = res.payload.private;
					this.keyPublic  = res.payload.public;
					this.running    = false;
				},
				this.$root.genericError
			);
			this.running = true;
		}
	}
};

let MyBuilderModulesGraph = {
	name:'my-builder-modules-graph',
	components:{
		echarts:VueECharts,
	},
	template:`<div class="builder-modules-graph contentBox grow">
		
		<div class="top nowrap clickable" @click="show = !show">
			<div class="area nowrap">
				<img class="icon" :src="displayArrow(show)" />
				<h1 class="title">{{ capApp.button.graph }}</h1>
			</div>
		</div>
		
		<div class="content default-inputs graph" v-if="show">
			<echarts
				:option="graphOption"
				:theme="settings.dark ? 'dark' : ''"
			/>
		</div>
	</div>`,
	computed:{
		graphOption:(s) => {
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
		modules: (s) => s.$store.getters['schema/modules'],
		capApp:  (s) => s.$store.getters.captions.builder.module,
		settings:(s) => s.$store.getters.settings
	},
	data:function() {
		return {
			show:false
		};
	},
	methods:{
		displayArrow
	}
};

let MyBuilderModulesExport = {
	name:'my-builder-modules-export',
	components:{MyModuleSelect},
	template:`<div class="builder-modules contentBox grow">
		
		<div class="top nowrap clickable" @click="show = !show">
			<div class="area nowrap">
				<img class="icon" :src="displayArrow(show)" />
				<h1 class="title">{{ capApp.export }}</h1>
			</div>
		</div>
		
		<div class="content default-inputs" v-if="show">
			<table>
				<tr>
					<td>
						<my-module-select
							@update:modelValue="id = $event;moduleIdMapChanged = null"
							:modelValue="id"
						/>
					</td>
					<td>
						<!-- check for changes -->
						<my-button image="refresh.png"
							@trigger="check"
							:active="id !== null"
							:caption="capApp.button.check"
						/>
					</td>
				</tr>
			</table>
			
			<!-- export states -->
			<table class="change-table" v-if="moduleIdMapChanged !== null">
				<thead>
					<tr>
						<th>{{ capGen.application }}</th>
						<th>{{ capApp.exportOwner }}</th>
						<th colspan="2">{{ capApp.exportState }}</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="(changed,moduleId) in moduleIdMapChanged">
						<td :class="{ 'export-master':moduleId === id }">{{ moduleIdMap[moduleId].name }}</td>
						<td>{{ moduleIdMapOptions[moduleId].owner ? capGen.option.yes : capGen.option.no }}</td>
						<template v-if="moduleIdMapOptions[moduleId].owner && changed">
							<td class="export-bad">
								{{ capApp.exportStateNok }}
							</td>
							<td>
								<my-button image="add.png"
									@trigger="addVersion(moduleId)"
									:caption="capApp.button.versionCreate"
								/>
							</td>
						</template>
						<td colspan="2" class="export-good" v-else>
							{{ capApp.exportStateOk }}
						</td>
					</tr>
				</tbody>
			</table>
			
			<!-- export private key management -->
			<div class="export-private-key">
				
				<p v-if="!keyIsSet">
					{{ capApp.exportKeyEmpty }}
				</p>
				
				<textarea
					v-if="!keyIsSet"
					v-model="exportPrivateKey"
					:placeholder="capApp.exportPrivateKeyHint"
				></textarea>
				
				<my-button image="key.png"
					v-if="!keyIsSet"
					@trigger="setKey"
					:active="exportPrivateKey !== ''"
					:caption="capApp.button.exportKeySet"
				/>
				
				<my-button image="ok.png"
					v-if="keyIsSet"
					:active="false"
					:caption="capApp.exportKeySet"
					:naked="true"
				/>
			</div>
			
			<!-- export actions -->
			<div class="actions" v-if="id !== null && keyIsSet && exportValid">
				<a :href="exportHref" :download="exportFileName">
					<my-button image="download.png"
						:caption="capApp.button.export"
					/>
				</a>
			</div>
		</div>
	</div>`,
	computed:{
		exportFileName:(s) => {
			let m = s.moduleIdMap[s.id];
			return `${m.name}_${m.releaseBuild}.rei3`;
		},
		exportHref:(s) => {
			return `/export/${s.exportFileName}?module_id=${s.id}&token=${s.token}`;
		},
		exportValid:(s) => {
			if(s.moduleIdMapChanged === null)
				return false;
			
			for(let k in s.moduleIdMapChanged) {
				let m = s.moduleIdMapChanged[k];
				
				// block if a dependency has changes
				if(m.id !== s.id && s.moduleIdMapOptions[k].owner && s.moduleIdMapChanged[k])
					return false;
			}
			return true;
		},
		
		// stores
		token:      (s) => s.$store.getters['local/token'],
		modules:    (s) => s.$store.getters['schema/modules'],
		moduleIdMap:(s) => s.$store.getters['schema/moduleIdMap'],
		moduleIdMapOptions:(s) => s.$store.getters['schema/moduleIdMapOptions'],
		capApp:     (s) => s.$store.getters.captions.builder.module,
		capGen:     (s) => s.$store.getters.captions.generic
	},
	data:function() {
		return {
			exportPrivateKey:'',
			id:null,
			keyIsSet:false,
			moduleIdMapChanged:null,
			show:false
		};
	},
	methods:{
		displayArrow,
		addVersion(moduleId) {
			ws.send('transfer','addVersion',{moduleId:moduleId},true).then(
				() => {
					this.moduleIdMapChanged = null;
					this.$root.schemaReload(moduleId);
				},
				this.$root.genericError
			);
		},
		check() {
			ws.send('module','checkChange',{id:this.id},true).then(
				res => this.moduleIdMapChanged = res.payload.moduleIdMapChanged,
				this.$root.genericError
			);
		},
		setKey() {
			// check validity
			if(!this.exportPrivateKey.includes('-----BEGIN RSA PRIVATE KEY-----'))
				return this.$store.commit('dialog',{
					captionBody:this.capApp.exportKeyBad,
					buttons:[{
						cancel:true,
						caption:this.capGen.button.cancel,
						image:'cancel.png'
					}]
				});
			
			// store export key
			ws.send('transfer','storeExportKey',{exportKey:this.exportPrivateKey},true).then(
				() => this.keyIsSet = true,
				this.$root.genericError
			);
		}
	}
};

let MyBuilderModules = {
	name:'my-builder-modules',
	components:{
		MyBuilderModulesExport,
		MyBuilderModulesGraph,
		MyBuilderModulesKeyCreate
	},
	template:`<div class="builder-modules">
		<div class="contentBox grow">
			
			<div class="top clickable" @click="show = !show">
				<div class="area nowrap">
					<img class="icon" :src="displayArrow(show)" />
					<h1 class="title">{{ capApp.titleAll }}</h1>
				</div>
				
				<div class="area">
					<my-button image="box.png"
						@trigger="$router.push('/admin/repo')"
						:caption="capApp.button.repo"
					/>
					<my-button image="builder.png"
						@trigger="$router.push('/admin/modules')"
						:caption="capApp.button.manageApps"
					/>
					<my-button image="question.png"
						@trigger="$emit('toggleDocs')"
						:caption="capGen.help"
					/>
				</div>
			</div>
			
			<div class="content min-height" v-if="show">
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
							:to="'/builder/module/'+m.id"
						>
							<div class="color" :style="'background-color:#'+m.color1"></div>
							<img :src="srcBase64Icon(m.iconId,'images/module.png')" />
							<span>{{ m.name + ' - v' + m.releaseBuild }}</span>
						</router-link>
						
						<div class="item-children">
							<router-link class="item"
								v-for="mc in modules.filter(v => v.parentId === m.id)"
								:title="capApp.position+': '+m.position" 
								:to="'/builder/module/'+mc.id"
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
		
		<my-builder-modules-graph  v-if="modules.length !== 0" />
		<my-builder-modules-export v-if="modules.length !== 0" />
		<my-builder-modules-key-create />
	</div>`,
	props:{
		builderLanguage:{ type:String, required:true }
	},
	emits:['createNew','toggleDocs'],
	data:function() {
		return {
			show:true
		};
	},
	computed:{
		modules:(s) => s.$store.getters['schema/modules'],
		capApp: (s) => s.$store.getters.captions.builder.module,
		capGen: (s) => s.$store.getters.captions.generic
	},
	methods:{
		displayArrow,
		srcBase64Icon
	}
};