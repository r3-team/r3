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
					:active="!installStarted && isCompatible && !productionMode"
					:caption="capApp.button.install"
				/>
				<my-button
					v-if="isInstalled"
					:active="false"
					:caption="capApp.button.installed"
				/>
				
				<p v-if="!isCompatible" class="bad-state">
					{{ capApp.notCompatible }}
				</p>
				<p v-if="!isInstalled && isCompatible && productionMode">
					{{ capApp.maintenanceBlock }}
				</p>
			</div>
		</div>
	</div>`,
	props:{
		repoModule:{ type:Object, required:true }
	},
	data() {
		return {
			installStarted:false
		};
	},
	computed:{
		meta:(s) => {
			let code = s.settings.languageCode;
			
			// en_us is global fallback
			if(typeof s.repoModule.languageCodeMeta[code] === 'undefined')
				code = 'en_us';
			
			return s.repoModule.languageCodeMeta[code];
		},
		languageCodes:(s) => {
			let codes = [];
			for(let k in s.repoModule.languageCodeMeta) {
				codes.push(k);
			}
			return codes.join(', ');
		},
		
		// simple
		description: (s) => s.meta.description.replace(/(?:\r\n|\r|\n)/g,'<br />'),
		isCompatible:(s) => parseInt(s.system.appBuild) >= s.repoModule.releaseBuildApp,
		isInstalled: (s) => typeof s.moduleIdMap[s.repoModule.moduleId] !== 'undefined',
		releaseDate: (s) => s.getUnixFormat(s.repoModule.releaseDate,s.settings.dateFormat),
		
		// stores
		moduleIdMap:   (s) => s.$store.getters['schema/moduleIdMap'],
		capApp:        (s) => s.$store.getters.captions.admin.repo,
		capGen:        (s) => s.$store.getters.captions.generic,
		productionMode:(s) => s.$store.getters.productionMode,
		settings:      (s) => s.$store.getters.settings,
		system:        (s) => s.$store.getters.system
	},
	methods:{
		// externals
		getUnixFormat,
		
		// backend calls
		install(fileId) {
			ws.send('repoModule','install',{fileId:fileId},true).then(
				() => {
					this.$store.commit('dialog',{
						captionBody:this.capApp.fetchDone
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
	template:`<div class="admin-repo contentBox grow">
		
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
				/>
				<my-button
					@trigger="toggleShowInstalled"
					:caption="capApp.button.showInstalled"
					:image="showInstalled ? 'checkbox1.png' : 'checkbox0.png'" 
				/>
			</div>
				
			<div class="area nowrap default-inputs">
				<my-input-offset class-input="selector"
					v-if="repoModules.length !== 0"
					@input="offsetSet"
					:caption="true"
					:limit="limit"
					:offset="offset"
					:total="count"
				/>
			</div>
				
			<div class="area wrap default-inputs">
				<my-button
					@trigger="limit = 10;limitSet()"
					:caption="capGen.limit"
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
					:placeholder="capGen.textSearch"
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
	data() {
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
	mounted() {
		this.$store.commit('pageTitle',this.menuTitle);
		this.get();
	},
	computed:{
		// stores
		modules:    (s) => s.$store.getters['schema/modules'],
		moduleIdMap:(s) => s.$store.getters['schema/moduleIdMap'],
		capApp:     (s) => s.$store.getters.captions.admin.repo,
		capGen:     (s) => s.$store.getters.captions.generic,
		settings:   (s) => s.$store.getters.settings
	},
	methods:{
		// actions
		limitSet() {
			this.offset = 0;
			this.get();
		},
		offsetSet(newOffset) {
			this.offset = newOffset;
			this.get();
		},
		toggleShowInstalled() {
			this.showInstalled = !this.showInstalled;
			this.offset = 0;
			this.get();
		},
		
		// backend calls
		get() {
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
		updateRepo() {
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