import MyArticles            from '../articles.js';
import srcBase64Icon         from '../shared/image.js';
import {getUnixFormat}       from '../shared/time.js';
import {
	getCaptionForModule,
	getValidLanguageCode
} from '../shared/language.js';
export {MyAdminModules as default};

let MyAdminModulesItem = {
	name:'my-admin-modules-item',
	template:`<tr :class="{ grouping:module.parentId === null }">
		<td class="noWrap">
			<div class="row centered">
				<my-button image="dash.png"
					v-if="module.parentId !== null"
					:active="false"
					:naked="true"
				/>
				<img class="module-icon" :src="srcBase64Icon(module.iconId,'images/module.png')" />
				<span>{{ getCaptionForModule(module.captions.moduleTitle,module.name,module) }}</span>
			</div>
		</td>
		<td class="minimum">v{{ module.releaseBuild }}</td>
		<td class="noWrap">
			{{ module.releaseDate === 0 ? '-' : getUnixFormat(module.releaseDate,'Y-m-d') }}
		</td>
		<td class="noWrap">
			<div v-if="!isInRepo">
				<i>{{ capApp.repoNotIncluded }}</i>
			</div>
			
			<div v-if="isOutdatedApp">
				<i>{{ capApp.repoOutdatedApp }}</i>
			</div>
			
			<div v-if="isUpToDate">
				{{ capApp.repoUpToDate }}
			</div>
		
			<my-button
				v-if="isReadyForUpdate"
				@trigger="$emit('install',repoModule.fileId)"
				:active="!installStarted && !productionMode"
				:caption="capApp.button.update.replace('{VERSION}',repoModule.releaseBuild)"
				:image="!installStarted ? 'download.png' : 'load.gif'"
			/>
		</td>
		<td class="noWrap">
			<my-button image="question.png"
				@trigger="$emit('showHelp',module.id)"
				:active="hasHelp"
				:captionTitle="capGen.help"
			/>
		</td>
		<td class="noWrap">
			<my-button image="time.png"
				@trigger="changeLogShow"
				:active="changeLog !== '' && changeLog !== null"
				:captionTitle="capApp.changeLog"
			/>
		</td>
		<td class="noWrap" v-if="builderEnabled">
			<my-bool
				@update:modelValue="ownerWarning"
				:modelValue="owner"
				:readonly="productionMode"
				:reversed="true"
			/>
		</td>
		<td class="noWrap">
			<my-bool
				v-model="hidden"
				@update:modelValue="change"
				:readonly="productionMode"
			/>
		</td>
		<td class="default-inputs">
			<input class="short"
				v-model.number="position"
				@input="change"
				:disabled="productionMode"
			/>
		</td>
		<td>
			<div class="row gap">
				<my-button image="builder.png"
					:active="builderEnabled"
					@trigger="openBuilder(false)"
					@trigger-middle="openBuilder(true)"
					:captionTitle="capGen.button.openBuilder"
				/>
				<my-button image="delete.png"
					@trigger="delAsk"
					:active="!productionMode"
					:cancel="true"
					:captionTitle="capGen.button.delete"
				/>
			</div>
		</td>
		<td></td>
	</tr>`,
	props:{
		installStarted:{ type:Boolean, required:true },
		module:        { type:Object,  required:true },
		options:       { type:Object,  required:true },
		repoModules:   { type:Array,   required:true },
		warningShown:  { type:Boolean, required:true }
	},
	emits:['change','install','showHelp','shownWarning'],
	data() {
		return {
			id:this.module.id,
			hidden:this.options.hidden,
			owner:this.options.owner,
			position:this.options.position
		};
	},
	computed:{
		hasHelp:(s) => s.module.articleIdsHelp.length !== 0
			&& typeof s.articleIdMap[s.module.articleIdsHelp[0]].captions.articleBody[s.settings.languageCode] !== 'undefined',
		moduleNamesDependendOnUs:(s) => {
			let out = [];
			for(let i = 0, j = s.moduleIdsDependendOnUs.length; i < j; i++) {
				let m = s.moduleIdMap[s.moduleIdsDependendOnUs[i]];
				out.push(m.name);
			}
			return out;
		},
		moduleIdsDependendOnUs:(s) => {
			let out = [];
			let addDependendIds = function(moduleParent) {
				// check all other modules for dependency to parent module
				for(let moduleChild of s.modules) {
					// root, parent module or was already added
					if(moduleChild.id === s.module.id || moduleChild.id === moduleParent.id || out.includes(moduleChild.id))
						continue;
					
					for(let moduleIdChildDependsOn of moduleChild.dependsOn) {
						if(moduleIdChildDependsOn === moduleParent.id) {
							out.push(moduleChild.id);
							
							// add dependencies from child as well
							addDependendIds(moduleChild);
							break;
						}
					}
				}
			};
			
			// get dependencies of this module (root)
			addDependendIds(s.module);
			return out;
		},
		
		// repository
		repoModule:(s) => {
			for(let i = 0, j = s.repoModules.length; i < j; i++) {
				if(s.repoModules[i].moduleId === s.id)
					return s.repoModules[i];
			}
			return false;
		},
		
		// simple
		changeLog:       (s) => s.repoModule === false ? '' : s.repoModule.changeLog,
		isInRepo:        (s) => s.repoModule !== false,
		isOutdated:      (s) => s.isInRepo && s.repoModule.releaseBuild > s.module.releaseBuild,
		isOutdatedApp:   (s) => s.isInRepo && s.repoModule.releaseBuildApp > s.system.appBuild,
		isReadyForUpdate:(s) => s.isInRepo && s.isOutdated && !s.isOutdatedApp,
		isUpToDate:      (s) => s.isInRepo && !s.isOutdated,
		
		// stores
		modules:       (s) => s.$store.getters['schema/modules'],
		moduleIdMap:   (s) => s.$store.getters['schema/moduleIdMap'],
		articleIdMap:  (s) => s.$store.getters['schema/articleIdMap'],
		builderEnabled:(s) => s.$store.getters.builderEnabled,
		capApp:        (s) => s.$store.getters.captions.admin.modules,
		capGen:        (s) => s.$store.getters.captions.generic,
		productionMode:(s) => s.$store.getters.productionMode,
		settings:      (s) => s.$store.getters.settings,
		system:        (s) => s.$store.getters.system
	},
	methods:{
		// externals
		getCaptionForModule,
		getUnixFormat,
		srcBase64Icon,
		
		// actions
		change() {
			this.$emit('change',this.module.id,{
				hidden:this.hidden,
				owner:this.owner,
				position:this.position
			});
		},
		changeLogShow() {
			this.$store.commit('dialog',{
				captionTop:this.capApp.changeLog,
				captionBody:this.changeLog,
				image:'time.png',
				width:1000
			});
		},
		openBuilder(middle) {
			if(!middle) this.$router.push('/builder/module/'+this.module.id);
			else        window.open('#/builder/module/'+this.module.id,'_blank');
		},
		ownerToggle() {
			this.owner = !this.owner;
			this.change();
		},
		ownerWarning(state) {
			if(!state || this.warningShown)
				return this.ownerToggle();
			
			this.$store.commit('dialog',{
				captionBody:this.capApp.dialog.owner,
				captionTop:this.capApp.dialog.ownerTitle,
				image:'warning.png',
				buttons:[{
					cancel:true,
					caption:this.capGen.button.apply,
					exec:this.ownerToggle,
					keyEnter:true,
					image:'warning.png'
				},{
					caption:this.capGen.button.cancel,
					keyEscape:true,
					image:'cancel.png'
				}]
			});
			this.$emit('shownWarning');
		},
		
		// backend calls
		delAsk() {
			let appNames = '';
			
			if(this.moduleNamesDependendOnUs.length !== 0)
				appNames = this.capApp.dialog.deleteApps.replace('{LIST}',
					`<li>${this.moduleNamesDependendOnUs.join('</li><li>')}</li>`
				);
			
			this.$store.commit('dialog',{
				captionBody:this.capApp.dialog.delete.replace('{APPS}',appNames),
				captionTop:this.capApp.dialog.deleteTitle.replace('{APP}',this.module.name),
				image:'warning.png',
				buttons:[{
					cancel:true,
					caption:this.capGen.button.delete,
					exec:this.delAsk2,
					keyEnter:true,
					image:'delete.png'
				},{
					caption:this.capGen.button.cancel,
					keyEscape:true,
					image:'cancel.png'
				}]
			});
		},
		delAsk2() {
			this.$nextTick(() => {
				this.$store.commit('dialog',{
					captionBody:this.capApp.dialog.deleteMulti.replace('{COUNT}',this.moduleNamesDependendOnUs.length + 1),
					captionTop:this.capApp.dialog.deleteTitle.replace('{APP}',this.module.name),
					image:'warning.png',
					buttons:[{
						cancel:true,
						caption:this.capGen.button.delete,
						exec:this.del,
						keyEnter:true,
						image:'delete.png'
					},{
						caption:this.capGen.button.cancel,
						keyEscape:true,
						image:'cancel.png'
					}]
				});
			});
		},
		del() {
			let requests = [ws.prepare('module','del',{id:this.id})];
			
			// add dependencies to delete
			for(let id of this.moduleIdsDependendOnUs) {
				requests.push(ws.prepare('module','del',{id:id}));
			}
			
			ws.sendMultiple(requests,true).then(
				() => this.$root.schemaReload(),
				this.$root.genericError
			);
		}
	}
};

let MyAdminModules = {
	name:'my-admin-modules',
	components:{
		MyAdminModulesItem,
		MyArticles
	},
	template:`<div class="contentBox admin-modules grow">
		<div class="top">
			<div class="area">
				<img class="icon" src="images/builder.png" />
				<h1>{{ menuTitle }}</h1>
			</div>
		</div>
		<div class="top lower">
			<div class="area">
				<my-button image="save.png"
					@trigger="set"
					:active="hasChanges && !productionMode"
					:caption="capGen.button.save"
				/>
				<my-button image="box.png"
					@trigger="goToRepo"
					:caption="capApp.button.repository"
				/>
				<my-button
					@trigger="installAll"
					:active="moduleIdsUpdate.length !== 0 && !installStarted && !productionMode"
					:caption="capApp.button.updateAll.replace('{COUNT}',moduleIdsUpdate.length)"
					:image="!installStarted ? 'download.png' : 'load.gif'"
				/>
			</div>
			<div class="area admin-modules-file">
				<img class="icon" src="images/upload.png" />
				<h1>{{ capApp.import }}</h1>
				<input type="file"
					@change="fileToUpload = $event.target.files[0]"
					:disabled="!canUploadFile"
				/>
				<my-button
					@trigger="importModule"
					:active="canUploadFile && fileToUpload !== null"
					:caption="capGen.button.apply"
					:image="fileUploading ? 'load.gif' : 'ok.png'"
				/>
			</div>
		</div>
		
		<!-- application help window -->
		<div class="app-sub-window under-header" v-if="moduleIdShowHelp !== null" @mousedown.self="moduleIdShowHelp = null">
			<my-articles class="admin-modules-help shade popUp"
				@close="moduleIdShowHelp = null"
				:moduleId="moduleIdShowHelp"
				:isFloat="false"
				:language="moduleLanguage"
			/>
		</div>
		
		<div class="content no-padding">
			
			<!-- production mode notice -->
			<p class="message error" v-if="productionMode">
				{{ capApp.productionMode }}
			</p>
			
			<p class="message" v-if="modules.length === 0">
				<i>{{ capApp.nothingInstalled }}</i>
			</p>
			
			<!-- installed modules -->
			<table class="generic-table bright sticky-top" v-if="modules.length !== 0">
				<thead>
					<tr>
						<th class="noWrap" colspan="2">
							<div class="mixed-header">
								<img src="images/module.png" />
								<span>{{ capGen.application }}</span>
							</div>
						</th>
						<th class="noWrap">
							<div class="mixed-header">
								<img src="images/calendar.png" />
								<span>{{ capApp.releaseDate }}</span>
							</div>
						</th>
						<th class="noWrap">
							<div class="mixed-header">
								<img src="images/download.png" />
								<span>{{ capApp.update }}</span>
							</div>
						</th>
						<th class="noWrap">
							<div class="mixed-header">
								<img src="images/question.png" />
								<span>{{ capGen.help }}</span>
							</div>
						</th>
						<th class="noWrap">
							<div class="mixed-header">
								<img src="images/time.png" />
								<span>{{ capApp.changeLog }}</span>
							</div>
						</th>
						<th class="noWrap" v-if="builderEnabled">
							<div class="mixed-header">
								<img src="images/warning.png" />
								<span>{{ capGen.readonly }}</span>
							</div>
						</th>
						<th class="noWrap">
							<div class="mixed-header">
								<img src="images/visible0.png" />
								<span>{{ capApp.hidden }}</span>
							</div>
						</th>
						<th class="noWrap">
							<div class="mixed-header">
								<img src="images/sort.png" />
								<span>{{ capApp.position }}</span>
							</div>
						</th>
						<th>
							<div class="mixed-header">
								<img src="images/ok.png" />
								<span>{{ capGen.actions }}</span>
							</div>
						</th>
						<th class="maximum"></th>
					</tr>
				</thead>
				<tbody>
					<my-admin-modules-item
						v-for="(m,i) in modules"
						@change="updateMeta"
						@install="install"
						@showHelp="showHelp($event)"
						@shownWarning="warningShown = true"
						:installStarted="installStarted"
						:key="m.id"
						:module="m"
						:options="moduleIdMapMeta[m.id]"
						:repoModules="repoModules"
						:warningShown="warningShown"
					/>
				</tbody>
			</table>
		</div>
	</div>`,
	props:{
		menuTitle:{ type:String, required:true }
	},
	data() {
		return {
			fileToUpload:null,
			fileUploading:false,
			installStarted:false,
			moduleIdMapUpdated:{}, // module ID map of updated module meta data (empty if nothing changed)
			moduleIdShowHelp:null,
			repoModules:[],
			warningShown:false
		};
	},
	mounted() {
		this.$store.commit('pageTitle',this.menuTitle);
		this.getRepo();
		this.$emit('hotkeysRegister',[{fnc:this.set,key:'s',keyCtrl:true}]);
	},
	unmounted() {
		this.$emit('hotkeysRegister',[]);
	},
	computed:{
		moduleIdsUpdate:(s) => {
			let out = [];
			for(let rm of s.repoModules) {
				if(rm.releaseBuildApp <= s.system.appBuild
					&& typeof s.moduleIdMap[rm.moduleId] !== 'undefined'
					&& rm.releaseBuild > s.moduleIdMap[rm.moduleId].releaseBuild
				) {
					out.push(rm.moduleId);
				}
			}
			return out;
		},
		
		// simple
		canUploadFile:(s) => !s.installStarted && !s.fileUploading && !s.productionMode,
		hasChanges:   (s) => Object.keys(s.moduleIdMapUpdated).length !== 0,
		
		// stores
		token:          (s) => s.$store.getters['local/token'],
		modules:        (s) => s.$store.getters['schema/modules'],
		moduleIdMap:    (s) => s.$store.getters['schema/moduleIdMap'],
		builderEnabled: (s) => s.$store.getters.builderEnabled,
		capApp:         (s) => s.$store.getters.captions.admin.modules,
		capGen:         (s) => s.$store.getters.captions.generic,
		moduleIdMapMeta:(s) => s.$store.getters.moduleIdMapMeta,
		moduleLanguage: (s) => s.$store.getters.moduleLanguage,
		productionMode: (s) => s.$store.getters.productionMode,
		system:         (s) => s.$store.getters.system
	},
	methods:{
		// externals
		getValidLanguageCode,
		
		// error handling
		installError(message) {
			message = this.capApp.error.installFailed.replace('{ERROR}',message);
			
			this.$root.genericError(message);
			this.installStarted = false;
		},
		showHelp(moduleId) {
			this.$store.commit('moduleLanguage',this.getValidLanguageCode(
				this.moduleIdMap[moduleId]));
			
			this.moduleIdShowHelp = moduleId;
		},
		
		// actions
		goToRepo() {
			return this.$router.push('/admin/repo');
		},
		importModule() {
			this.fileUploading = true;
			let formData       = new FormData();
			let httpRequest    = new XMLHttpRequest();
			
			httpRequest.upload.onprogress = (event) => {
				if(event.lengthComputable) {
					//
				}
			}
			httpRequest.onload = (event) => {
				let res = JSON.parse(httpRequest.response);
				this.fileUploading = false;
				this.$store.commit('busyRemove');
				
				if(!res.success) {
					this.$root.genericError(this.capApp.error.uploadFailed);
					return;
				}
			}
			formData.append('token',this.token);
			formData.append('file',this.fileToUpload);
			httpRequest.open('POST','import',true);
			httpRequest.send(formData);
			this.$store.commit('busyAdd');
		},
		updateMeta(moduleId,meta) {
			this.moduleIdMapUpdated[moduleId] = meta;
		},
		
		// backend calls
		getRepo() {
			ws.send('repoModule','get',{getInstalled:true,getNew:false},true).then(
				res => this.repoModules = res.payload.repoModules,
				this.$root.genericError
			);
		},
		install(fileId) {
			ws.send('repoModule','install',{fileId:fileId},true).then(
				() => this.installOk(),
				this.installError
			);
			this.installStarted = true;
		},
		installAll() {
			ws.send('repoModule','installAll',{},true).then(
				() => this.installOk(),
				this.installError
			);
			this.installStarted = true;
		},
		installOk() {
			this.$store.commit('dialog',{
				captionBody:this.capApp.updateDone
			});
			this.installStarted = false;
		},
		set() {
			if(!this.hasChanges)
				return;
			
			let requests = [];
			for(let k in this.moduleIdMapUpdated) {
				requests.push(ws.prepare('moduleMeta','setOptions',{
					id:k,
					hidden:this.moduleIdMapUpdated[k].hidden,
					position:this.moduleIdMapUpdated[k].position,
					owner:this.moduleIdMapUpdated[k].owner
				}));
			}
			ws.sendMultiple(requests,true).then(
				() => {
					this.$root.schemaReload();
					this.moduleIdMapUpdated = {};
				},
				this.$root.genericError
			);
		}
	}
};