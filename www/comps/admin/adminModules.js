import MyAdminModulesItem from './adminModulesItem.js';
import MyAdminRepos       from './adminRepos.js';
import MyAdminRepoInstall from './adminRepoInstall.js';
import MyAdminRepoKeys    from './adminRepoKeys.js';
import MyArticles         from '../articles.js';

export default {
	name:'my-admin-modules',
	components:{
		MyAdminModulesItem,
		MyAdminRepos,
		MyAdminRepoInstall,
		MyAdminRepoKeys,
		MyArticles
	},
	template:`<div class="contentBox scroll admin-modules grow">
		
		<!-- application help window -->
		<div class="app-sub-window under-header" v-if="moduleIdShowHelp !== null" @mousedown.self="moduleIdShowHelp = null">
			<my-articles class="admin-modules-help shade popUp"
				@close="moduleIdShowHelp = null"
				:moduleId="moduleIdShowHelp"
				:isFloat="false"
			/>
		</div>

		<my-tabs
			v-model="tabTarget"
			:entries="['modules','installFromRepo','installFromFile','repos','keys']"
			:entriesIcon="['images/builder.png','images/box.png','images/upload.png','images/boxMultiple.png','images/key.png']"
			:entriesText="[capApp.installedApps,capApp.repoInstallFrom,capApp.import,capApp.reposManage,capApp.publicKeys]"
		/>

		<my-admin-repos        v-if="tabTarget === 'repos'" />
		<my-admin-repo-install v-if="tabTarget === 'installFromRepo'" />
		<my-admin-repo-keys    v-if="tabTarget === 'keys'" />

		<template v-if="tabTarget === 'installFromFile'">
			<div class="content">
				<div class="column gap">
					<my-label :caption="capApp.import" image="upload.png" :large="true" />
					<br />
					<input type="file"
						@change="fileToUpload = $event.target.files[0]"
						:disabled="!canUploadFile"
					/>
					<br />
					<div class="row">
						<my-button
							@trigger="importModule"
							:active="canUploadFile && fileToUpload !== null"
							:caption="capGen.button.apply"
							:image="fileUploading ? 'load.gif' : 'ok.png'"
						/>
					</div>
				</div>
			</div>
		</template>

		<template v-if="tabTarget === 'modules'">
			<div class="top lower">
				<div class="area">
					<my-button image="save.png"
						@trigger="set"
						:active="hasChanges && !productionMode"
						:caption="capGen.button.save"
					/>
					<my-button
						@trigger="installAll"
						:active="moduleIdsUpdate.length !== 0 && !installStarted && !productionMode"
						:caption="capApp.button.updateAll.replace('{COUNT}',moduleIdsUpdate.length)"
						:image="!installStarted ? 'download.png' : 'load.gif'"
					/>
				</div>
				<div class="area">
					<my-button image="refresh.png"
						@trigger="updateRepo"
						:active="modules.length !== 0"
						:caption="capApp.button.repositoryRefresh"
					/>
				</div>
			</div>
			
			<div class="content no-padding">
				
				<!-- production mode notice -->
				<p class="message error" v-if="productionMode">
					{{ capApp.productionMode }}
				</p>
				
				<p class="message" v-if="modules.length === 0">
					<i>{{ capGen.nothingInstalled }}</i>
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
							@showHelp="showHelp"
							@showLog="showLog"
							@shownWarning="warningShown = true"
							:installStarted="installStarted"
							:key="m.id"
							:module="m"
							:options="moduleIdMapMeta[m.id]"
							:repoModules
							:warningShown
						/>
					</tbody>
				</table>
			</div>
		</template>
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
			tabTarget:'modules',
			warningShown:false
		};
	},
	mounted() {
		if(this.$route.meta !== undefined && this.$route.meta.target !== undefined) {
			if(this.$route.meta.target === 'repo') this.tabTarget = 'installFromRepo';
			if(this.$route.meta.target === 'file') this.tabTarget = 'installFromFile';
		}
		
		this.getRepo();
		this.$store.commit('pageTitle',this.menuTitle);
		this.$store.commit('keyDownHandlerAdd',{fnc:this.set,key:'s',keyCtrl:true});
	},
	unmounted() {
		this.$store.commit('keyDownHandlerDel',this.set);
	},
	computed:{
		moduleIdsUpdate:s => {
			let out = [];
			for(let rm of s.repoModules) {
				if(rm.releaseBuildApp <= s.appVersionBuild
					&& typeof s.moduleIdMap[rm.moduleId] !== 'undefined'
					&& rm.releaseBuild > s.moduleIdMap[rm.moduleId].releaseBuild
				) {
					out.push(rm.moduleId);
				}
			}
			return out;
		},
		
		// simple
		canUploadFile:s => !s.installStarted && !s.fileUploading && !s.productionMode,
		hasChanges:   s => Object.keys(s.moduleIdMapUpdated).length !== 0,
		
		// stores
		appVersionBuild:s => s.$store.getters['local/appVersionBuild'],
		token:          s => s.$store.getters['local/token'],
		modules:        s => s.$store.getters['schema/modules'],
		moduleIdMap:    s => s.$store.getters['schema/moduleIdMap'],
		builderEnabled: s => s.$store.getters.builderEnabled,
		capApp:         s => s.$store.getters.captions.admin.modules,
		capGen:         s => s.$store.getters.captions.generic,
		moduleIdMapMeta:s => s.$store.getters.moduleIdMapMeta,
		productionMode: s => s.$store.getters.productionMode
	},
	methods:{
		// error handling
		installError(message) {
			message = this.capApp.error.installFailed.replace('{ERROR}',message);
			
			this.$root.genericError(message);
			this.installStarted = false;
		},
		showHelp(moduleId) {
			this.moduleIdShowHelp = moduleId;
		},
		showLog(log) {
			this.$store.commit('dialog',{
				captionTop:this.capApp.changeLog,
				captionBody:log,
				image:'time.png',
				textDisplay:'richtext',
				width:1000
			});
		},
		
		// actions
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
		updateRepo() {
			ws.send('repo','refresh',{},true).then(
				this.getRepo,
				this.$root.genericError
			);
		},
		
		// backend calls
		getRepo() {
			ws.send('repoModule','get',{getInstalled:true,getNew:false},true).then(
				res => this.repoModules = res.payload.repoModules,
				this.$root.genericError
			);
		},
		install(moduleId) {
			ws.send('repoModule','install',moduleId,true,true).then(
				() => this.installOk(),
				this.installError
			);
			this.installStarted = true;
		},
		installAll() {
			ws.send('repoModule','installAll',{},true,true).then(
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