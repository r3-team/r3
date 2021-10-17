import srcBase64Icon         from '../shared/image.js';
import {getCaptionForModule} from '../shared/language.js';
import {getUnixFormat}       from '../shared/time.js';
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
				<span>
					{{ getCaptionForModule(module.captions.moduleTitle,module.name,module) }}
				</span>
			</div>
		</td>
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
				:active="!installStarted && productionMode === 0"
				:caption="capApp.button.update.replace('{VERSION}',repoModule.releaseBuild)"
				:image="!installStarted ? 'download.png' : 'load.gif'"
			/>
		</td>
		<td class="noWrap">
			<my-button image="question.png"
				@trigger="changeLogShow"
				:active="changeLog !== '' && changeLog !== null"
				:caption="module.name+' v'+module.releaseBuild"
				:naked="true"
			/>
		</td>
		<td class="noWrap" v-if="builderEnabled">
			<my-bool
				@update:modelValue="ownerWarning"
				:modelValue="owner"
				:readonly="productionMode !== 0"
			/>
		</td>
		<td class="noWrap">
			<my-bool
				v-model="hidden"
				:readonly="productionMode !== 0"
			/>
		</td>
		<td class="default-inputs">
			<input class="short" v-model.number="position" :disabled="productionMode !== 0" />
		</td>
		<td>
			<div class="row">
				<my-button image="save.png"
					@trigger="set"
					:active="hasChanges && productionMode === 0"
					:captionTitle="capGen.button.save"
				/>
				<my-button image="delete.png"
					@trigger="delAsk"
					:active="productionMode === 0 && dependOnUsNames.length === 0"
					:cancel="true"
					:captionTitle="dependOnUsDisplay"
				/>
			</div>
		</td>
		<td></td>
	</tr>`,
	props:{
		installStarted:{ type:Boolean, required:true },
		module:        { type:Object,  required:true },
		options:       { type:Object,  required:true },
		repoModules:   { type:Array,   required:true }
	},
	emits:['install'],
	data:function() {
		return {
			id:this.module.id,
			hidden:this.options.hidden,
			owner:this.options.owner,
			position:this.options.position
		};
	},
	computed:{
		dependOnUsDisplay:function() {
			if(this.dependOnUsNames.length === 0)
				return '';
			
			return this.capApp.dependOnUs.replace('{NAMES}',this.dependOnUsNames.join(', '));
		},
		dependOnUsNames:function() {
			let out = [];
			
			for(let i = 0, j = this.modules.length; i < j; i++) {
				let m = this.modules[i];
				
				if(m.id === this.id)
					continue;
				
				for(let x = 0, y = m.dependsOn.length; x < y; x++) {
					if(m.dependsOn[x] === this.id) {
						out.push(m.name);
						break;
					}
				}
			}
			return out;
		},
		hasChanges:function() {
			return this.position !== this.options.position
				|| this.hidden   !== this.options.hidden
				|| this.owner    !== this.options.owner;
		},
		
		// repository
		isInRepo:function() {
			return this.repoModule !== false;
		},
		isOutdatedApp:function() {
			return this.isInRepo && this.repoModule.releaseBuildApp > this.system.appBuild;
		},
		isOutdated:function() {
			return this.isInRepo && this.repoModule.releaseBuild > this.module.releaseBuild;
		},
		isReadyForUpdate:function() {
			return this.isInRepo && this.isOutdated && !this.isOutdatedApp;
		},
		isUpToDate:function() {
			return this.isInRepo && !this.isOutdated;
		},
		repoModule:function() {
			for(let i = 0, j = this.repoModules.length; i < j; i++) {
				if(this.repoModules[i].moduleId === this.id)
					return this.repoModules[i];
			}
			return false;
		},
		
		// simple
		changeLog:function() {
			if(this.repoModule === false) return '';
			
			return this.repoModule.changeLog;
		},
		
		// stores
		modules:       function() { return this.$store.getters['schema/modules']; },
		builderEnabled:function() { return this.$store.getters.builderEnabled; },
		capApp:        function() { return this.$store.getters.captions.admin.modules; },
		capGen:        function() { return this.$store.getters.captions.generic; },
		productionMode:function() { return this.$store.getters.productionMode; },
		settings:      function() { return this.$store.getters.settings; },
		system:        function() { return this.$store.getters.system; }
	},
	methods:{
		// externals
		getCaptionForModule,
		getUnixFormat,
		srcBase64Icon,
		
		changeLogShow:function() {
			this.$store.commit('dialog',{
				captionTop:this.capApp.changeLog,
				captionBody:this.changeLog,
				image:'time.png',
				width:1000,
				buttons:[{
					cancel:true,
					caption:this.capGen.button.close,
					image:'cancel.png'
				}]
			});
		},
		ownerEnable:function() {
			this.owner = true;
		},
		ownerWarning:function(state) {
			if(!state) {
				this.owner = false;
				return;
			}
			
			this.$store.commit('dialog',{
				captionTop:this.capApp.dialog.ownerTitle,
				captionBody:this.capApp.dialog.owner,
				image:'warning.png',
				buttons:[{
					cancel:true,
					caption:this.capGen.button.apply,
					exec:this.ownerEnable,
					image:'warning.png'
				},{
					caption:this.capGen.button.cancel,
					image:'cancel.png'
				}]
			});
		},
		
		// backend calls
		delAsk:function() {
			this.$store.commit('dialog',{
				captionBody:this.capApp.dialog.delete,
				buttons:[{
					cancel:true,
					caption:this.capGen.button.delete,
					exec:this.del,
					image:'delete.png'
				},{
					caption:this.capGen.button.cancel,
					image:'cancel.png'
				}]
			});
		},
		del:function() {
			let trans = new wsHub.transactionBlocking();
			trans.add('module','del',{
				id:this.id
			},this.delOk);
			trans.send(this.$root.genericError);
		},
		delOk:function(res) {
			this.$root.schemaReload();
			
			let trans = new wsHub.transaction();
			trans.add('scheduler','reload',{});
			trans.send(this.$root.genericError);
		},
		set:function() {
			let trans = new wsHub.transactionBlocking();
			trans.add('moduleOption','set',{
				id:this.id,
				hidden:this.hidden,
				owner:this.owner,
				position:this.position
			},this.setOk);
			trans.send(this.$root.genericError);
		},
		setOk:function() {
			this.$root.schemaReload();
		}
	}
};

let MyAdminModules = {
	name:'my-admin-modules',
	components:{MyAdminModulesItem},
	template:`<div class="contentBox admin-modules limited1500 grow">
		<div class="top">
			<div class="area">
				<img class="icon" src="images/builder.png" />
				<h1>{{ menuTitle }}</h1>
			</div>
		</div>
		<div class="top lower">
			<div class="area">
				<my-button image="box.png"
					@trigger="goToRepo"
					:caption="capApp.button.repository"
					:darkBg="true"
				/>
				<my-button
					@trigger="installAll"
					:active="moduleIdsUpdate.length !== 0 && !installStarted && productionMode === 0"
					:caption="capApp.button.updateAll.replace('{COUNT}',moduleIdsUpdate.length)"
					:darkBg="true"
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
					:darkBg="true"
					:image="fileUploading ? 'load.gif' : 'ok.png'"
				/>
			</div>
		</div>
		
		<div class="content no-padding">
			
			<!-- production mode notice -->
			<p class="message error" v-if="productionMode === 1">
				{{ capApp.productionMode }}
			</p>
			
			<p class="message" v-if="modules.length === 0">
				<i>{{ capApp.nothingInstalled }}</i>
			</p>
			
			<!-- installed modules -->
			<table class="table-default" v-if="modules.length !== 0">
				<thead>
					<tr>
						<th class="noWrap">
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
								<img src="images/ok.png" />
								<span>{{ capApp.update }}</span>
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
								<span>{{ capApp.owner }}</span>
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
						<th></th>
						<th class="maximum"></th>
					</tr>
				</thead>
				<tbody>
					<my-admin-modules-item
						v-for="(m,i) in modules"
						@install="install"
						:installStarted="installStarted"
						:key="m.id"
						:module="m"
						:options="moduleIdMapOptions[m.id]"
						:repoModules="repoModules"
					/>
				</tbody>
			</table>
		</div>
	</div>`,
	props:{
		menuTitle:{ type:String, required:true }
	},
	data:function() {
		return {
			fileToUpload:null,
			fileUploading:false,
			installStarted:false,
			repoModules:[]
		};
	},
	mounted:function() {
		this.$store.commit('pageTitle',this.menuTitle);
		this.getRepo();
	},
	computed:{
		canUploadFile:function() {
			return !this.installStarted && !this.fileUploading && this.productionMode !== 1;
		},
		moduleIdsUpdate:function() {
			let out = [];
			for(let i = 0, j = this.repoModules.length; i < j; i++) {
				let rm = this.repoModules[i];
				
				if(rm.releaseBuildApp >= this.system.appBuild)
					continue;
				
				if(typeof this.moduleIdMap[rm.moduleId] === 'undefined')
					continue;
				
				let m = this.moduleIdMap[rm.moduleId];
				if(rm.releaseBuild <= m.releaseBuild)
					continue;
				
				out.push(m.id);
			}
			return out;
		},
		
		// stores
		token:             function() { return this.$store.getters['local/token']; },
		modules:           function() { return this.$store.getters['schema/modules']; },
		moduleIdMap:       function() { return this.$store.getters['schema/moduleIdMap']; },
		moduleIdMapOptions:function() { return this.$store.getters['schema/moduleIdMapOptions']; },
		builderEnabled:    function() { return this.$store.getters.builderEnabled; },
		capApp:            function() { return this.$store.getters.captions.admin.modules; },
		capGen:            function() { return this.$store.getters.captions.generic; },
		productionMode:    function() { return this.$store.getters.productionMode; },
		system:            function() { return this.$store.getters.system; }
	},
	methods:{
		// error handling
		installError:function(req,message) {
			message = this.capApp.error.installFailed.replace('{ERROR}',message);
			
			this.$root.genericError(req,message);
			this.installStarted = false;
		},
		
		// actions
		goToRepo:function() {
			return this.$router.push('/admin/repo');
		},
		importModule:function() {
			this.fileUploading = true;
			let formData       = new FormData();
			let httpRequest    = new XMLHttpRequest();
			let that           = this;
			
			httpRequest.upload.onprogress = function(event) {
				if(event.lengthComputable) {
					//
				}
			}
			httpRequest.onload = function(event) {
				let res = JSON.parse(httpRequest.response);
				that.fileUploading = false;
				
				if(!res.success) {
					that.$root.genericError(null,that.capApp.error.uploadFailed);
					return;
				}
				
				let trans = new wsHub.transaction();
				trans.add('login','reauthAll',{});
				trans.send(that.$root.genericError);
			}
			formData.append('token',this.token);
			formData.append('file',this.fileToUpload);
			httpRequest.open('POST','import',true);
			httpRequest.send(formData);
		},
		
		// backend calls
		getRepo:function() {
			let trans = new wsHub.transactionBlocking();
			trans.add('repoModule','get',{
				getInstalled:true,
				getNew:false
			},this.getRepoOk);
			trans.send(this.$root.genericError);
		},
		getRepoOk:function(res) {
			this.repoModules = res.payload.repoModules;
		},
		install:function(fileId) {
			let trans = new wsHub.transactionBlocking();
			trans.add('repoModule','install',{
				fileId:fileId
			},this.installOk);
			trans.send(this.installError);
			this.installStarted = true;
		},
		installAll:function() {
			let trans = new wsHub.transactionBlocking();
			trans.add('repoModule','installAll',{},this.installOk);
			trans.send(this.installError);
			this.installStarted = true;
		},
		installOk:function() {
			this.$store.commit('dialog',{
				captionBody:this.capApp.updateDone,
				buttons:[{
					caption:this.capGen.button.close,
					cancel:true,
					image:'cancel.png'
				}]
			});
			this.installStarted = false;
		}
	}
};