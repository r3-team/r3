import srcBase64Icon         from '../shared/image.js';
import {getCaptionForModule} from '../shared/language.js';
import {getUnixFormat}       from '../shared/time.js';
export {MyAdminModules as default};

let MyAdminModulesItem = {
	name:'my-admin-modules-item',
	template:`<tr :class="{ grouping:module.parentId === null }">
		<td>
			<div class="row">
				<my-button image="save.png"
					@trigger="set"
					:active="hasChanges && !productionMode"
					:captionTitle="capGen.button.save"
				/>
				<my-button image="delete.png"
					@trigger="delAsk"
					:active="!productionMode"
					:cancel="true"
				/>
			</div>
		</td>
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
			<my-button image="time.png"
				v-if="changeLog !== '' && changeLog !== null"
				@trigger="changeLogShow"
				:caption="capApp.changeLog"
				:tight="true"
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
				:readonly="productionMode"
			/>
		</td>
		<td class="default-inputs">
			<input class="short" v-model.number="position" :disabled="productionMode" />
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
		hasChanges:function() {
			return this.position !== this.options.position
				|| this.hidden   !== this.options.hidden
				|| this.owner    !== this.options.owner;
		},
		moduleNamesDependendOnUs:function() {
			let out = [];
			
			for(let i = 0, j = this.moduleIdsDependendOnUs.length; i < j; i++) {
				let m = this.moduleIdMap[this.moduleIdsDependendOnUs[i]];
				out.push(m.name);
			}
			return out;
		},
		moduleIdsDependendOnUs:function() {
			let out  = [];
			let that = this;
			
			let addDependendIds = function(m) {
				
				// check all other modules for dependency to parent module
				for(let i = 0, j = that.modules.length; i < j; i++) {
					
					let childId = that.modules[i].id;
					
					// root, parent module or was already added
					if(childId === that.module.id || childId === m.id || out.includes(childId))
						continue;
					
					for(let x = 0, y = that.modules[i].dependsOn.length; x < y; x++) {
						
						if(that.modules[i].dependsOn[x] !== m.id)
							continue;
						
						out.push(childId);
						
						// add dependencies from child as well
						addDependendIds(that.modules[i]);
						break;
					}
				}
			};
			
			// get dependencies if this module (root)
			addDependendIds(this.module);
			
			return out;
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
		moduleIdMap:   function() { return this.$store.getters['schema/moduleIdMap']; },
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
				captionBody:this.capApp.dialog.owner,
				captionTop:this.capApp.dialog.ownerTitle,
				image:'warning.png',
				buttons:[{
					cancel:true,
					caption:this.capGen.button.apply,
					exec:this.ownerEnable,
					keyEnter:true,
					image:'warning.png'
				},{
					caption:this.capGen.button.cancel,
					keyEscape:true,
					image:'cancel.png'
				}]
			});
		},
		
		// backend calls
		delAsk:function() {
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
		delAsk2:function() {
			this.$nextTick(function() {
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
		del:function() {
			let requests = [ws.prepare('module','del',{id:this.id})];
			
			// add dependencies to delete
			for(let i = 0, j = this.moduleIdsDependendOnUs.length; i < j; i++) {
				requests.push(ws.prepare('module','del',{id:this.moduleIdsDependendOnUs[i]}));
			}
			
			ws.sendMultiple(requests,true).then(
				() => this.$root.schemaReload(),
				this.$root.genericError
			);
		},
		set:function() {
			ws.send('moduleOption','set',{
				id:this.id,
				hidden:this.hidden,
				owner:this.owner,
				position:this.position
			},true).then(
				() => this.$root.schemaReload(),
				this.$root.genericError
			);
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
		
		<div class="content no-padding">
			
			<!-- production mode notice -->
			<p class="message error" v-if="productionMode">
				{{ capApp.productionMode }}
			</p>
			
			<p class="message" v-if="modules.length === 0">
				<i>{{ capApp.nothingInstalled }}</i>
			</p>
			
			<!-- installed modules -->
			<table class="table-default" v-if="modules.length !== 0">
				<thead>
					<tr>
						<th>
							<div class="mixed-header">
								<img src="images/ok.png" />
								<span>{{ capGen.actions }}</span>
							</div>
						</th>
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
			return !this.installStarted && !this.fileUploading && !this.productionMode;
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
		installError:function(message) {
			message = this.capApp.error.installFailed.replace('{ERROR}',message);
			
			this.$root.genericError(message);
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
					that.$root.genericError(that.capApp.error.uploadFailed);
					return;
				}
			}
			formData.append('token',this.token);
			formData.append('file',this.fileToUpload);
			httpRequest.open('POST','import',true);
			httpRequest.send(formData);
		},
		
		// backend calls
		getRepo:function() {
			ws.send('repoModule','get',{getInstalled:true,getNew:false},true).then(
				res => this.repoModules = res.payload.repoModules,
				this.$root.genericError
			);
		},
		install:function(fileId) {
			ws.send('repoModule','install',{fileId:fileId},true).then(
				() => this.installOk(),
				this.installError
			);
			this.installStarted = true;
		},
		installAll:function() {
			ws.send('repoModule','installAll',{},true).then(
				() => this.installOk(),
				this.installError
			);
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