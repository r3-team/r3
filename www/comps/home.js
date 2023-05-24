import srcBase64Icon                   from './shared/image.js';
import {getBuildFromVersion}           from './shared/generic.js';
import {setSingle as setSettingSingle} from './shared/settings.js';
export {MyHome as default};

let MyHome = {
	name:'my-go-home',
	template:`<div class="home">
		
		<!-- instance setup wizard -->
		<div class="home-standardBox contentBox home-wizard" v-if="noModules && isAdmin">
			<div class="top lower">
				<div class="area">
					<img class="icon" src="images/settings.png" />
					<h1>{{ capApp.wizard.title }}</h1>
				</div>
			</div>
			
			<div class="content" v-html="capApp.wizard.intro"></div>
			
			<div class="content no-padding">
				<div class="tabBar">
					<div class="entry clickable"
						v-html="capApp.wizard.installBundle"
						@click="wizardTarget = 'bundle'"
						:class="{ active:wizardTarget === 'bundle' }"
					></div>
					<div class="entry clickable"
						v-html="capApp.wizard.installRepo"
						@click="wizardTarget = 'repo'"
						:class="{ active:wizardTarget === 'repo' }"
					></div>
					<div class="entry clickable"
						v-html="capApp.wizard.installFile"
						@click="wizardTarget = 'file'"
						:class="{ active:wizardTarget === 'file' }"
					></div>
				</div>
			</div>
				
			<div class="content home-wizardAction" v-if="wizardTarget === 'bundle'">
				<img class="preview" src="images/logo_core_company.png" />
				<p v-html="capApp.wizard.installBundleDesc"></p>
				<my-button
					@trigger="installPackage"
					:active="!installStarted"
					:caption="capApp.button.installBundle"
					:image="!installStarted ? 'ok.png' : 'load.gif'"
				/>
			</div>
			<div class="content home-wizardAction" v-if="wizardTarget === 'repo'">
				<img class="preview small" src="images/box.png" />
				<p v-html="capApp.wizard.installRepoDesc" />
				<my-button image="download.png"
					@trigger="goToRepo"
					:caption="capApp.button.goToRepo"
				/>
			</div>
			<div class="content home-wizardAction" v-if="wizardTarget === 'file'">
				<img class="preview small" src="images/fileZip.png" />
				<p v-html="capApp.wizard.installFileDesc" />
				<my-button image="upload.png"
					@trigger="goToApps"
					:caption="capApp.button.goToApps"
				/>
			</div>
		</div>
		
		<!-- no access message -->
		<div class="contentBox home-standardBox home-noAccess" v-if="noAccess">
			<div class="top lower">
				<div class="area">
					<img class="icon" src="images/key.png" />
					<h1>{{ capApp.noAccessTitle }}</h1>
				</div>
			</div>
			
			<div class="content">
				<span
					v-if="!isAdmin"
					v-html="capApp.noAccess"
				/>
				
				<template v-if="isAdmin">
					<span v-html="capApp.noAccessAdmin" />
					
					<div class="actions">
						<my-button class="right" image="person.png"
							@trigger="goToLogins"
							:caption="capApp.button.goToLogins"
						/>
					</div>
				</template>
			</div>
		</div>
		
		<!-- update notification -->
		<div class="contentBox scroll home-standardBox" v-if="showUpdate && !isMobile">
			<div class="top lower">
				<div class="area">
					<img class="icon" src="images/download.png" />
					<h1>{{ capApp.newVersion }}</h1>
				</div>
				<div class="area">
					<my-button image="cancel.png"
						@trigger="setSettingSingle('hintUpdateVersion',versionBuildNew)"
						:cancel="true"
					/>
				</div>
			</div>
			
			<div class="content">
				<span v-html="capApp.newVersionText.replace('{VERSION}',config.updateCheckVersion)" />
			</div>
		</div>
		
		<!-- module navigation -->
		<span class="home-title" v-if="!isMobile && !noNavigation">
			{{ capGen.applications }}
		</span>
		<div class="modules">
			<div class="module shade"
				v-for="me in moduleEntries"
				:key="me.id"
			>
				<div class="module-title" :style="bgStyle(me.id)"></div>
				
				<div class="entries">
					<div class="entry">
						<router-link class="clickable"
							:to="'/app/'+me.name"
						>
							<img :src="srcBase64Icon(me.iconId,'images/module.png')" />
							<span>{{ me.caption }}</span>
						</router-link>
					</div>
					
					<div class="children">
						<div class="entry" v-for="mec in me.children">
							<router-link class="clickable"
								:key="mec.id"
								:to="'/app/'+me.name+'/'+mec.name"
							>
								<img :src="srcBase64Icon(mec.iconId,'images/module.png')" />
								<span>{{ mec.caption }}</span>
								
							</router-link>
						</div>
					</div>
					
					<img class="watermark" :src="srcBase64Icon(me.iconId,'images/module.png')" />
				</div>
				
				<div class="module-title lower" :style="bgStyle(me.id)"></div>
			</div>
		</div>
		
		<!-- application version -->
		<a target="_blank" class="version"
			v-if="!isMobile"
			:href="capGen.appWebsite"
		>{{ capGen.appName + ' ' + appVersion }}</a>
	</div>`,
	props:{
		moduleEntries:{ type:Array, required:true }
	},
	data() {
		return {
			installStarted:false,
			wizardTarget:'bundle'
		};
	},
	computed:{
		noAccess:       (s) => s.noNavigation && !s.noModules,
		noModules:      (s) => s.modules.length === 0,
		noNavigation:   (s) => s.moduleEntries.length === 0,
		showUpdate:     (s) => !s.isAdmin || s.versionBuildNew <= s.settings.hintUpdateVersion
			? false : s.versionBuildNew > s.getBuildFromVersion(s.appVersion),
		versionBuildNew:(s) => !s.isAdmin || s.config.updateCheckVersion === ''
			? 0 : s.getBuildFromVersion(s.config.updateCheckVersion),		
		
		// stores
		activated:  (s) => s.$store.getters['local/activated'],
		appName:    (s) => s.$store.getters['local/appName'],
		appVersion: (s) => s.$store.getters['local/appVersion'],
		colorHeader:(s) => s.$store.getters['local/companyColorHeader'],
		modules:    (s) => s.$store.getters['schema/modules'],
		moduleIdMap:(s) => s.$store.getters['schema/moduleIdMap'],
		iconIdMap:  (s) => s.$store.getters['schema/iconIdMap'],
		capApp:     (s) => s.$store.getters.captions.home,
		capGen:     (s) => s.$store.getters.captions.generic,
		config:     (s) => s.$store.getters.config,
		isAdmin:    (s) => s.$store.getters.isAdmin,
		isMobile:   (s) => s.$store.getters.isMobile,
		settings:   (s) => s.$store.getters.settings
	},
	mounted() {
		this.$store.commit('pageTitle',this.capApp.title);
		this.$root.setModuleIdActive(null);
	},
	methods:{
		// externals
		getBuildFromVersion,
		srcBase64Icon,
		setSettingSingle,
		
		// presentation
		bgStyle(moduleId) {
			let color = this.activated && this.colorHeader !== ''
				? `#${this.colorHeader}` : this.$root.moduleIdMapColor[moduleId];
			
			return `background-color:${color};`;
		},
		
		// actions
		installPackage() {
			ws.send('package','install',{},true).then(
				() => {},
				this.$root.genericError
			);
			this.installStarted = true;
		},
		showHelp(top,body) {
			this.$store.commit('dialog',{
				captionBody:body,
				captionTop:top,
				image:'question.png',
				textDisplay:'richtext',
				width:900,
				buttons:[{
					caption:this.capGen.button.cancel,
					image:'cancel.png'
				}]
			});
		},
		
		// routing
		goToApps()   { this.$router.push('/admin/modules'); },
		goToLogins() { this.$router.push('/admin/logins'); },
		goToRepo()   { this.$router.push('/admin/repo'); }
	}
};