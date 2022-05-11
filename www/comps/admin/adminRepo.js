import MyInputOffset   from '../inputOffset.js';
import {getUnixFormat} from '../shared/time.js';
export {MyAdminRepo as default};

let MyAdminRepoModule = {
	name:'my-admin-repo-module',
	template:`<div class="repo-module">
		<div class="part left">
			<div class="title">
				<h3>{{ meta.title }}</h3>
				<a :href="meta.supportPage" target="_blank">
					{{ capApp.supportPage }}
				</a>
			</div>
			<div class="description" v-html="description"></div>
		</div>
		<div class="part right">
			<div>'{{ repoModule.name }}' v{{ repoModule.releaseBuild }}</div>
			<div class="author">{{ capApp.author.replace('{NAME}',repoModule.author) }}</div>
			<div>{{ releaseDate }}</div>
			<div>{{ languageCodes }}</div>
			
			<div class="actions-box">
				<my-button
					v-if="!isInstalled"
					@trigger="install(repoModule.fileId)"
					:active="!installStarted && isCompatible && productionMode === 0"
					:caption="capApp.button.install"
					:darkBg="true"
				/>
				<my-button
					v-if="isInstalled"
					:active="false"
					:caption="capApp.button.installed"
					:darkBg="true"
				/>
				
				<p v-if="!isCompatible" class="bad-state">
					{{ capApp.notCompatible }}
				</p>
				<p v-if="!isInstalled && isCompatible && productionMode === 1">
					{{ capApp.maintenanceBlock }}
				</p>
			</div>
		</div>
	</div>`,
	props:{
		repoModule:{ type:Object, required:true }
	},
	data:function() {
		return {
			installStarted:false
		};
	},
	computed:{
		description:function() {
			return this.meta.description.replace(/(?:\r\n|\r|\n)/g,'<br />');
		},
		meta:function() {
			let code = this.settings.languageCode;
			
			// en_us is global fallback
			if(typeof this.repoModule.languageCodeMeta[code] === 'undefined')
				code = 'en_us';
			
			return this.repoModule.languageCodeMeta[code];
		},
		releaseDate:function() {
			return this.getUnixFormat(this.repoModule.releaseDate,this.settings.dateFormat);
		},
		languageCodes:function() {
			let codes = [];
			for(let k in this.repoModule.languageCodeMeta) {
				codes.push(k);
			}
			return codes.join(', ');
		},
		
		isInstalled:function() {
			return typeof this.moduleIdMap[this.repoModule.moduleId] !== 'undefined';
		},
		isCompatible:function() {
			return parseInt(this.system.appBuild) >= this.repoModule.releaseBuildApp;
		},
		
		// stores
		moduleIdMap:   function() { return this.$store.getters['schema/moduleIdMap']; },
		capApp:        function() { return this.$store.getters.captions.admin.repo; },
		capGen:        function() { return this.$store.getters.captions.generic; },
		productionMode:function() { return this.$store.getters.productionMode; },
		settings:      function() { return this.$store.getters.settings; },
		system:        function() { return this.$store.getters.system; }
	},
	methods:{
		// externals
		getUnixFormat,
		
		// backend calls
		install:function(fileId) {
			ws.send('repoModule','install',{fileId:fileId},true).then(
				() => {
					this.$store.commit('dialog',{
						captionBody:this.capApp.fetchDone,
						buttons:[{
							caption:this.capGen.button.close,
							cancel:true,
							image:'cancel.png'
						}]
					});
					this.installStarted = false;
				},
				this.$root.genericError
			);
			this.installStarted = true;
		}
	}
};

let MyAdminRepo = {
	name:'my-admin-repo',
	components:{
		MyInputOffset,
		MyAdminRepoModule
	},
	template:`<div class="admin-repo contentBox grow limited1500">
		
		<div class="top">
			<div class="area">
				<img class="icon" src="images/box.png" />
				<h1>{{ menuTitle }}</h1>
			</div>
		</div>
		<div class="top lower">
			<div class="area nowrap">
				<my-button image="refresh.png"
					@trigger="updateRepo"
					:caption="capGen.button.refresh"
					:darkBg="true"
				/>
				<my-button
					@trigger="toggleShowInstalled"
					:caption="capApp.button.showInstalled"
					:darkBg="true"
					:image="showInstalled ? 'checkbox1.png' : 'checkbox0.png'" 
				/>
			</div>
				
			<div class="area nowrap default-inputs">
				<my-input-offset class-input="selector"
					v-if="repoModules.length !== 0"
					@input="offsetSet"
					:caption="true"
					:darkBg="true"
					:limit="limit"
					:offset="offset"
					:total="count"
				/>
			</div>
				
			<div class="area nowrap default-inputs">
				<my-button
					@trigger="limit = 10;limitSet()"
					:caption="capGen.limit"
					:darkBg="true"
					:naked="true"
				/>
				<select class="entry short selector"
					v-model.number="limit"
					@change="limitSet"
				>
					<option value="10">10</option>
					<option value="50">50</option>
					<option value="100">100</option>
				</select>
				<input class="entry selector"
					v-model="byString"
					@keyup.enter="get"
					:placeholder="capApp.byString"
				/>
			</div>
		</div>
		
		<div class="content default-inputs">
			<my-admin-repo-module
				v-for="rm in repoModules"
				:key="rm.moduleId"
				:repo-module="rm"
			/>
			
			<div class="repo-empty" v-if="repoModules.length === 0">
				{{ capGen.nothingThere }}
			</div>
		</div>
	</div>`,
	props:{
		menuTitle:{ type:String, required:true }
	},
	data:function() {
		return {
			repoModules:[],
			byString:'',
			count:0,
			limit:10,
			offset:0,
			firstRetrieval:true,
			showInstalled:true
		};
	},
	mounted:function() {
		this.$store.commit('pageTitle',this.menuTitle);
		this.get();
	},
	computed:{
		// stores
		modules:    function() { return this.$store.getters['schema/modules']; },
		moduleIdMap:function() { return this.$store.getters['schema/moduleIdMap']; },
		capApp:     function() { return this.$store.getters.captions.admin.repo; },
		capGen:     function() { return this.$store.getters.captions.generic; },
		settings:   function() { return this.$store.getters.settings; }
	},
	methods:{
		// actions
		limitSet:function() {
			this.offset = 0;
			this.get();
		},
		offsetSet:function(newOffset) {
			this.offset = newOffset;
			this.get();
		},
		toggleShowInstalled:function() {
			this.showInstalled = !this.showInstalled;
			this.offset = 0;
			this.get();
		},
		
		// backend calls
		get:function() {
			ws.send('repoModule','get',{
				byString:this.byString,
				languageCode:this.settings.languageCode,
				limit:this.limit,
				getInstalled:this.showInstalled,
				getInStore:true,
				getNew:true,
				offset:this.offset
			},true).then(
				res => {
					this.repoModules = res.payload.repoModules;
					this.count       = res.payload.count;
					
					if(this.firstRetrieval && this.count === 0) {
						this.firstRetrieval = false;
						this.updateRepo();
					}
				},
				this.$root.genericError
			);
		},
		updateRepo:function() {
			ws.send('repoModule','update',{},true).then(
				() => {
					this.offset = 0;
					this.get();
				},
				this.$root.genericError
			);
		}
	}
};