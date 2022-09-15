import MyBuilderCaption      from './builderCaption.js';
import MyBuilderIconInput    from './builderIconInput.js';
import {MyModuleSelect}      from '../input.js';
import {getDependentModules} from '../shared/builder.js';
import {copyValueDialog}     from '../shared/generic.js';
import {getUnixFormat}       from '../shared/time.js';
export {MyBuilderModules as default};

let displayArrow = function(state) {
	return state ? 'images/triangleDown.png' : 'images/triangleRight.png';
};

let MyBuilderModulesItemStartForm = {
	name:'my-builder-modules-item-start-form',
	template:`<tr>
		<td>#{{ position+1 }}</td>
		<td>
			<select v-model="roleId">
				<option v-for="r in module.roles" :value="r.id">
					{{ r.name }}
				</option>
			</select>
		</td>
		<td>
			<select v-model="formId">
				<option :value="null">-</option>
				<option v-for="f in module.forms" :value="f.id">
					{{ f.name }}
				</option>
			</select>
		</td>
		<td>
			<div class="row centered">
				<my-button image="arrowDown.png"
					v-if="!isLast"
					@trigger="$emit('moveDown')"
					:naked="true"
				/>
				<my-button image="arrowUp.png"
					v-if="position !== 0"
					@trigger="$emit('moveUp')"
					:naked="true"
				/>
			</div>
		</td>
		<td>
			<my-button image="cancel.png"
				@trigger="$emit('remove')"
				:naked="true"
			/>
		</td>
	</tr>`,
	props:{
		isLast:    { type:Boolean, required:true },
		modelValue:{ type:Object,  required:true },
		module:    { type:Object,  required:true },
		position:  { type:Number,  required:true }
	},
	emits:['moveDown','moveUp','remove','update:modelValue'],
	computed:{
		// inputs
		formId:{
			get:function()  { return this.modelValue.formId; },
			set:function(v) { this.update('formId',v); }
		},
		roleId:{
			get:function()  { return this.modelValue.roleId; },
			set:function(v) { this.update('roleId',v); }
		},
		
		// stores
		capApp:function() { return this.$store.getters.captions.builder.relation; },
		capGen:function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		update:function(name,value) {
			let v = JSON.parse(JSON.stringify(this.modelValue));
			v[name] = value;
			
			this.$emit('update:modelValue',v);
		}
	}
};

let MyBuilderModulesItem = {
	name:'my-builder-modules-item',
	components:{
		'chrome-picker':VueColor.Chrome,
		MyBuilderCaption,
		MyBuilderIconInput,
		MyBuilderModulesItemStartForm
	},
	template:`<tbody>
		<tr>
			<td>
				<my-button image="open.png"
					v-if="!isNew"
					@trigger="open"
				/>
			</td>
			<td>
				<my-builder-icon-input
					@input="iconId = $event"
					:icon-id-selected="iconId"
					:module="module"
					:readonly="isNew"
				/>
			</td>
			<td>
				<input v-model="name" :placeholder="isNew ? capApp.new : ''" />
			</td>
			<td>
				<my-button image="visible1.png"
					@trigger="copyValueDialog(module.name,module.id,module.id)"
					:active="!isNew"
				/>
			</td>
			<td>
				<input class="short"
					v-model="color1"
				/>
			</td>
			<td v-click-outside="hideColorPicker">
				<div class="builder-color clickable"
					@click="showColorPicker = !showColorPicker"
					:style="styleColorPreview"
				></div>
				
				<div class="colorPickerWrap">
					<chrome-picker class="colorPickerFloating"
						v-if="showColorPicker"
						@update:modelValue="setColor"
						:disable-alpha="true"
						:disable-fields="true"
						:modelValue="color1"
					/>
				</div>
			</td>
			<td>
				<my-button
					@trigger="toggleSubComponent('dependsOn')"
					:active="modules.filter(m => m.id !== module.id).length > 0"
					:caption="String(dependsOn.length)"
					:image="showDependencies ? 'triangleDown.png' : 'triangleRight.png'"
				/>
			</td>
			<td>
				<select v-model="parentId">
					<option :value="null">-</option>
					<option
						v-for="mod in getDependentModules(module,modules).filter(v => v.id !== module.id && v.parentId === null)"
						:value="mod.id"
					>
						{{ mod.name }}
					</option>
				</select>
			</td>
			<td>
				<input class="short" v-model.number="position" />
			</td>
			<td>
				<my-button
					@trigger="toggleSubComponent('startForms')"
					:active="module.forms.length !== 0"
					:caption="String(startForms.length)"
					:image="showStartForms ? 'triangleDown.png' : 'triangleRight.png'"
				/>
			</td>
			<td>
				<my-button
					@trigger="toggleSubComponent('languages')"
					:caption="String(languages.length)"
					:image="showLanguages ? 'triangleDown.png' : 'triangleRight.png'"
				/>
			</td>
			<td>
				<input :value="displayReleaseDate" disabled="disabled" />
			</td>
			<td>
				<input class="short" v-model="releaseBuild" disabled="disabled" />
			</td>
			<td>
				<input class="short" v-model="releaseBuildApp" disabled="disabled" />
			</td>
			<td>
				<my-button image="save.png"
					@trigger="set"
					:active="hasChanges"
				/>
			</td>
		</tr>
		
		<tr v-if="showStartForms">
			<td colspan="999">
				<div class="sub-component">
					
					<!-- default start form -->
					<div class="item-list">
						<span>{{ capApp.startFormDefault }}</span>
						<select v-model="formId">
							<option :value="null">-</option>
							<option v-for="f in module.forms" :value="f.id">
								{{ f.name }}
							</option>
						</select>
					</div>
					<div class="item-list">
						<span>{{ capApp.startFormDefaultHint }}</span>
					</div>
					<br />
					
					<div class="item-list">
						<table v-if="startForms.length !== 0">
							<thead>
								<tr>
									<td>{{ capGen.order }}</td>
									<td>{{ capGen.role }}</td>
									<td>{{ capApp.startForm }}</td>
									<td colspan="2"></td>
								</tr>
							</thead>
							<tbody>
								<my-builder-modules-item-start-form
									v-for="(sf,i) in startForms"
									@moveDown="startForms.splice(i+1,0,startForms.splice(i,1)[0])"
									@moveUp="startForms.splice(i-1,0,startForms.splice(i,1)[0])"
									@remove="startForms.splice(i,1)"
									@update:modelValue="startForms[i] = $event"
									:isLast="i === startForms.length-1"
									:modelValue="sf"
									:module="module"
									:position="i"
								/>
							</tbody>
						</table>
						<p v-if="startForms.length !== 0">
							{{ capApp.startFormsExplanation }}
						</p>
					</div>
						
					<my-button image="add.png"
						@trigger="addStartForm"
						:caption="capGen.button.add"
					/>
				</div>
			</td>
		</tr>
		
		<tr v-if="showDependencies">
			<td colspan="999">
				<div class="sub-component">
					<div class="item-list">
						<div class="item" 
							v-for="m in modules.filter(m => m.id !== module.id)"
							:key="m.id"
						>
							<my-bool
								@update:modelValue="toggleDependsOn(m.id,$event)"
								:modelValue="dependsOn.includes(m.id)"
							/>
							<span class="depends-on">{{ m.name }}</span>
						</div>
					</div>
				</div>
			</td>
		</tr>
		
		<tr v-if="showLanguages">
			<td colspan="999">
				<div class="sub-component">
				
					<!-- main language selection -->
					<div class="item-list">
						<span>{{ capApp.languageMain }}</span>
						<select v-model="languageMain">
							<option
								v-for="l in languages"
								:value="l"
							>{{ l }}</option>
						</select>
					</div>
					<div class="item-list">
						<span>{{ capApp.languageMainHint }}</span>
					</div>
					<br />
					
					<!-- language entry and header title -->
					<div class="item-list">
						<table>
							<thead>
								<tr>
									<td>{{ capApp.languageCode }}</td>
									<td>{{ capApp.languageTitle }}</td>
									<td></td>
								</tr>
							</thead>
							<tbody>
								<tr v-for="(l,i) in languages">
									<td>
										<input type="text"
											v-model="languages[i]"
											:placeholder="capApp.languageCodeHint"
										/>
									</td>
									<td>
										<my-builder-caption
											v-model="captions.moduleTitle"
											:language="l"
										/>
									</td>
									<td>
										<my-button image="cancel.png"
											@trigger="languages.splice(i,1)"
											:naked="true"
										/>
									</td>
								</tr>
							</tbody>
						</table>
					</div>
					
					<my-button image="add.png"
						@trigger="languages.push('')"
						:caption="capGen.button.add"
					/>
				</div>
			</td>
		</tr>
	</tbody>`,
	props:{
		builderLanguage:{ type:String, required:true },
		module:{
			type:Object,
			required:false,
			default:function() {
				return{
					id:null,
					parentId:null,
					formId:null,
					iconId:null,
					name:'',
					color1:'217A4D',
					position:0,
					languageMain:'en_us',
					releaseBuild:0,
					releaseBuildApp:0,
					releaseDate:0,
					dependsOn:[],
					startForms:[],
					languages:['en_us'],
					forms:[],
					relations:[],
					captions:{
						moduleTitle:{}
					}
				};
			}
		}
	},
	data:function() {
		return {
			id:this.module.id,
			parentId:this.module.parentId,
			formId:this.module.formId,
			iconId:this.module.iconId,
			name:this.module.name,
			color1:this.module.color1,
			position:this.module.position,
			languageMain:this.module.languageMain,
			releaseBuild:this.module.releaseBuild,
			releaseBuildApp:this.module.releaseBuildApp,
			releaseDate:this.module.releaseDate,
			dependsOn:JSON.parse(JSON.stringify(this.module.dependsOn)),
			startForms:JSON.parse(JSON.stringify(this.module.startForms)),
			languages:JSON.parse(JSON.stringify(this.module.languages)),
			captions:JSON.parse(JSON.stringify(this.module.captions)),
			showColorPicker:false,
			showDependencies:false,
			showLanguages:false,
			showStartForms:false
		};
	},
	computed:{
		hasChanges:function() {
			return this.parentId     !== this.module.parentId
				|| this.formId       !== this.module.formId
				|| this.iconId       !== this.module.iconId
				|| this.name         !== this.module.name
				|| this.color1       !== this.module.color1
				|| this.position     !== this.module.position
				|| this.languageMain !== this.module.languageMain
				|| JSON.stringify(this.dependsOn)  !== JSON.stringify(this.module.dependsOn)
				|| JSON.stringify(this.startForms) !== JSON.stringify(this.module.startForms)
				|| JSON.stringify(this.languages)  !== JSON.stringify(this.module.languages)
				|| JSON.stringify(this.captions)   !== JSON.stringify(this.module.captions)
			;
		},
		displayReleaseDate:function() {
			if(this.releaseDate === 0) return '-';
			
			return this.getUnixFormat(this.releaseDate,'Y-m-d H:i');
		},
		styleColorPreview:function() {
			return `background-color:#${this.color1};`;
		},
		
		// simple states
		isNew:function() { return this.id === null; },
		
		// stores
		modules:       function() { return this.$store.getters['schema/modules']; },
		moduleIdMap:   function() { return this.$store.getters['schema/moduleIdMap']; },
		relationIdMap: function() { return this.$store.getters['schema/relationIdMap']; },
		attributeIdMap:function() { return this.$store.getters['schema/attributeIdMap']; },
		capApp:        function() { return this.$store.getters.captions.builder.module; },
		capGen:        function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		// externals
		copyValueDialog,
		getDependentModules,
		getUnixFormat,
		
		// actions
		addStartForm:function() {
			this.startForms.push({
				position:this.startForms.length,
				formId:null,
				roleId:null
			});
		},
		hideColorPicker:function() {
			this.showColorPicker = false;
		},
		open:function() {
			this.$router.push('/builder/relations/'+this.module.id);
		},
		setColor:function(newVal) {
			this.color1 = newVal.hex.substr(1);
		},
		toggleDependsOn:function(moduleId,state) {
			let pos = this.dependsOn.indexOf(moduleId);
			
			if(pos === -1 && state)
				this.dependsOn.push(moduleId);
			else if(pos !== -1 && !state)
				this.dependsOn.splice(pos,1);
		},
		toggleSubComponent:function(name) {
			if(name === 'dependsOn') {
				this.showLanguages  = false;
				this.showStartForms = false;
				this.showDependencies = !this.showDependencies;
			}
			if(name === 'languages') {
				this.showDependencies = false;
				this.showStartForms   = false;
				this.showLanguages = !this.showLanguages;
			}
			if(name === 'startForms') {
				this.showDependencies = false;
				this.showLanguages    = false;
				this.showStartForms = !this.showStartForms;
			}
		},
		
		// backend calls
		set:function() {
			this.languages.sort(); // for change comparissons
			
			let requests = [
				ws.prepare('module','set',{
					id:this.id,
					parentId:this.parentId,
					formId:this.formId,
					iconId:this.iconId,
					name:this.name,
					color1:this.color1,
					position:this.position,
					languageMain:this.languageMain,
					releaseBuild:this.releaseBuild,
					releaseBuildApp:this.releaseBuildApp,
					releaseDate:this.releaseDate,
					dependsOn:this.dependsOn,
					startForms:this.startForms,
					languages:this.languages,
					captions:this.captions
				})
			];
			
			if(!this.isNew)
				requests.push(ws.prepare('schema','check',{moduleId:this.id}));
			
			ws.sendMultiple(requests,true).then(
				() => {
					if(this.isNew) {
						this.name      = '';
						this.captions  = { moduleTitle:{} };
						this.dependsOn = [];
					}
					
					// reload entire schema if new module or its parent has changed
					if(this.isNew || this.parentId !== this.module.parentId)
						this.$root.schemaReload();
					else
						this.$root.schemaReload(this.id);
					
					// sort array for change comparissons
					this.dependsOn.sort();
					this.languages.sort();
				},
				this.$root.genericError
			);
		}
	}
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
		capApp:function() { return this.$store.getters.captions.builder.module; },
		capGen:function() { return this.$store.getters.captions.generic; }
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
		createKey:function() {
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
		graphOption:function() {
			let edges = [];
			let nodes = [];
			
			for(let i = 0, j = this.modules.length; i < j; i++) {
				let m = this.modules[i];
				
				nodes.push({
					id:m.id,
					name:m.name,
					label:{
						show:true
					},
					symbolSize:30,
					value:this.capApp.graphDependsOn.replace('{COUNT}',m.dependsOn.length)
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
		modules: function() { return this.$store.getters['schema/modules']; },
		capApp:  function() { return this.$store.getters.captions.builder.module; },
		settings:function() { return this.$store.getters.settings; }
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
		exportFileName:function() {
			let m = this.moduleIdMap[this.id];
			return `${m.name}_${m.releaseBuild}.rei3`;
		},
		exportHref:function() {
			return `/export/${this.exportFileName}?module_id=${this.id}&token=${this.token}`;
		},
		exportValid:function() {
			if(this.moduleIdMapChanged === null)
				return false;
			
			for(let k in this.moduleIdMapChanged) {
				let m = this.moduleIdMapChanged[k];
				
				// block if a dependency has changes
				if(m.id !== this.id && this.moduleIdMapOptions[k].owner && this.moduleIdMapChanged[k])
					return false;
			}
			return true;
		},
		
		// stores
		token:      function() { return this.$store.getters['local/token']; },
		modules:    function() { return this.$store.getters['schema/modules']; },
		moduleIdMap:function() { return this.$store.getters['schema/moduleIdMap']; },
		moduleIdMapOptions:function() { return this.$store.getters['schema/moduleIdMapOptions']; },
		capApp:     function() { return this.$store.getters.captions.builder.module; },
		capGen:     function() { return this.$store.getters.captions.generic; }
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
		addVersion:function(moduleId) {
			ws.send('transfer','addVersion',{moduleId:moduleId},true).then(
				() => {
					this.moduleIdMapChanged = null;
					this.$root.schemaReload(moduleId);
				},
				this.$root.genericError
			);
		},
		check:function() {
			ws.send('module','checkChange',{id:this.id},true).then(
				res => this.moduleIdMapChanged = res.payload.moduleIdMapChanged,
				this.$root.genericError
			);
		},
		setKey:function() {
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
		MyBuilderModulesItem,
		MyBuilderModulesKeyCreate
	},
	template:`<div class="builder-modules">
		<div class="contentBox grow">
			
			<div class="top clickable" @click="show = !show">
				<div class="area nowrap">
					<img class="icon" :src="displayArrow(show)" />
					<h1 class="title">{{ capApp.title }}</h1>
				</div>
				
				<div class="area">
					<my-button image="question.png"
						@trigger="$emit('toggle-docs')"
					/>
				</div>
			</div>
			
			<div class="content min-height default-inputs" v-if="show">
				<table class="marginBottom">
					<thead>
						<tr>
							<th>{{ capGen.button.open }}</th>
							<th>{{ capGen.icon }}</th>
							<th>{{ capGen.name }}</th>
							<th>{{ capGen.id }}</th>
							<th colspan="2">{{ capApp.color }}</th>
							<th>{{ capApp.dependsOn }}</th>
							<th>{{ capApp.parent }}</th>
							<th>{{ capApp.position }}</th>
							<th>{{ capApp.startForm }}</th>
							<th>{{ capApp.languages }}</th>
							<th>{{ capApp.releaseDate }}</th>
							<th>{{ capApp.releaseBuild }}</th>
							<th>{{ capApp.releaseBuildApp }}</th>
							<th></th>
						</tr>
					</thead>
					
					<!-- new record -->
					<my-builder-modules-item
						:builder-language="builderLanguage"
					/>
					
					<!-- existing records -->
					<my-builder-modules-item
						v-for="mod in modules"
						:builder-language="builderLanguage"
						:key="mod.id+'_'+mod.releaseBuild"
						:module="mod"
					/>
				</table>
			</div>
		</div>
		
		<my-builder-modules-graph v-if="modules.length !== 0" />
		<my-builder-modules-export v-if="modules.length !== 0" />
		<my-builder-modules-key-create />
	</div>`,
	props:{
		builderLanguage:{ type:String, required:true }
	},
	emits:['set-module-id','toggle-docs'],
	data:function() {
		return {
			show:true
		};
	},
	watch:{
		$route:{
			handler:function() { this.$emit('set-module-id',''); },
			immediate:true
		}
	},
	computed:{
		modules:function() { return this.$store.getters['schema/modules']; },
		capApp: function() { return this.$store.getters.captions.builder.module; },
		capGen: function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		displayArrow
	}
};