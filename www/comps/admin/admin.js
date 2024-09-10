import MyAdminDocs from './adminDocs.js';
export {MyAdmin as default};

let MyAdmin = {
	name:'my-admin',
	components:{
		MyAdminDocs,
	},
	template:`<div class="admin">
		<div class="navigation" :class="{ isDark:colorMenu.isDark() }" :style="bgStyle">
			<div class="navigation-header">
				<div class="row gap centered">
					<img class="icon" src="images/serverCog.png" />
					<span>{{ capApp.title }}</span>
				</div>
				<my-button image="question.png"
					@trigger="showDocs = !showDocs"
				/>
			</div>
			
			<!-- system configuration -->
			<router-link class="entry clickable" tag="div" to="/admin/config">
				<img src="images/server.png" />
				<span>{{ capApp.navigationConfig }}</span>
			</router-link>
			
			<!-- logins -->
			<router-link class="entry clickable" tag="div" to="/admin/logins">
				<img src="images/person.png" />
				<span>{{ capApp.navigationLogins }}</span>
			</router-link>
			
			<!-- roles -->
			<router-link class="entry clickable" tag="div" to="/admin/roles">
				<img src="images/admin.png" />
				<span>{{ capApp.navigationRoles }}</span>
			</router-link>
			
			<!-- login templates -->
			<router-link class="entry clickable" tag="div" to="/admin/login-templates">
				<img src="images/personTemplate.png" />
				<span>{{ capApp.navigationLoginTemplates }}</span>
			</router-link>
			
			<!-- modules -->
			<router-link class="entry clickable" tag="div" to="/admin/modules">
				<img src="images/builder.png" />
				<span>{{ capApp.navigationModules }}</span>
			</router-link>
			
			<!-- repo -->
			<router-link class="entry clickable" tag="div" to="/admin/repo">
				<img src="images/box.png" />
				<span>{{ capApp.navigationRepo }}</span>
			</router-link>
			
			<!-- mail accounts -->
			<router-link class="entry clickable" tag="div" to="/admin/mail-accounts">
				<img src="images/mail2.png" />
				<span>{{ capApp.navigationMailAccounts }}</span>
			</router-link>
			
			<!-- mail spooler -->
			<router-link class="entry clickable" tag="div" to="/admin/mail-spooler">
				<img src="images/mail_spool.png" />
				<span>{{ capApp.navigationMailSpooler }}</span>
			</router-link>
			
			<!-- mail traffic -->
			<router-link class="entry clickable" tag="div" to="/admin/mail-traffic">
				<img src="images/mail_clock.png" />
				<span>{{ capApp.navigationMailTraffic }}</span>
			</router-link>
			
			<!-- backups -->
			<router-link class="entry clickable" tag="div" to="/admin/backups">
				<img src="images/backup.png" />
				<span>{{ capApp.navigationBackups }}</span>
			</router-link>
			
			<!-- files -->
			<router-link class="entry clickable" tag="div" to="/admin/files">
				<img src="images/files.png" />
				<span>{{ capApp.navigationFiles }}</span>
			</router-link>
			
			<!-- logs -->
			<router-link class="entry clickable" tag="div" to="/admin/logs">
				<img src="images/fileText.png" />
				<span>{{ capApp.navigationLogs }}</span>
			</router-link>
			
			<!-- scheduler -->
			<router-link class="entry clickable" tag="div" to="/admin/scheduler">
				<img src="images/clock.png" />
				<span>{{ capApp.navigationScheduler }}</span>
			</router-link>
			
			<!-- caption map -->
			<router-link class="entry clickable" tag="div" to="/admin/caption-map">
				<img src="images/languages.png" />
				<span>{{ capApp.navigationCaptionMap }}</span>
			</router-link>
			
			<!-- REI3 Professional -->
			<div class="entry isTitle separator" tag="div">
				<img src="images/icon_naked.png" />
				<span>{{ licenseTitle }}</span>
			</div>
			
			<!-- activation -->
			<router-link class="entry clickable" tag="div" to="/admin/license">
				<img src="images/key.png" />
				<span>{{ capApp.navigationActivation }}</span>
			</router-link>
			
			<!-- customizing -->
			<router-link class="entry clickable" tag="div" to="/admin/custom" :class="{ inactive:!activated }">
				<img src="images/colors.png" />
				<span>{{ capApp.navigationCustom }}</span>
			</router-link>
			
			<!-- LDAP -->
			<router-link class="entry clickable" tag="div" to="/admin/ldaps" :class="{ inactive:!activated }">
				<img src="images/hierarchy.png" />
				<span>{{ capApp.navigationLdaps }}</span>
			</router-link>
			
			<!-- OAuth clients -->
			<router-link class="entry clickable" tag="div" to="/admin/oauth-clients" :class="{ inactive:!activated }">
				<img src="images/lockCog.png" />
				<span>{{ capApp.navigationOauthClients }}</span>
			</router-link>
			
			<!-- cluster -->
			<router-link class="entry clickable" tag="div" to="/admin/cluster" :class="{ inactive:!activated }">
				<img src="images/cluster.png" />
				<span>{{ capApp.navigationCluster }}</span>
			</router-link>
		</div>
		
		<router-view
			v-if="ready"
			v-show="!showDocs"
			:concurrentLogins="concurrentLogins"
			:menuTitle="contentTitle"
		/>
		
		<my-admin-docs
			v-if="showDocs"
			@close="showDocs = false"
		/>
	</div>`,
	watch:{
		$route(val) {
			if(val.hash === '')
				this.showDocs = false;
		}
	},
	data() {
		return {
			concurrentLogins:0, // count of concurrent logins
			ready:false,
			showDocs:false
		};
	},
	mounted() {
		if(!this.isAdmin)
			return this.$router.push('/');
		
		this.getConcurrentLogins();
		this.ready = true;
	},
	computed:{
		contentTitle:(s) => {
			if(s.$route.path.includes('backups'))         return s.capApp.navigationBackups;
			if(s.$route.path.includes('caption-map'))     return s.capApp.navigationCaptionMap;
			if(s.$route.path.includes('cluster'))         return s.capApp.navigationCluster;
			if(s.$route.path.includes('config'))          return s.capApp.navigationConfig;
			if(s.$route.path.includes('custom'))          return s.capApp.navigationCustom;
			if(s.$route.path.includes('docs'))            return s.capApp.navigationDocs;
			if(s.$route.path.includes('files'))           return s.capApp.navigationFiles;
			if(s.$route.path.includes('license'))         return s.capApp.navigationActivation;
			if(s.$route.path.includes('logins'))          return s.capApp.navigationLogins;
			if(s.$route.path.includes('login-templates')) return s.capApp.navigationLoginTemplates;
			if(s.$route.path.includes('logs'))            return s.capApp.navigationLogs;
			if(s.$route.path.includes('ldaps'))           return s.capApp.navigationLdaps;
			if(s.$route.path.includes('mail-accounts'))   return s.capApp.navigationMailAccounts;
			if(s.$route.path.includes('mail-spooler'))    return s.capApp.navigationMailSpooler;
			if(s.$route.path.includes('mail-traffic'))    return s.capApp.navigationMailTraffic;
			if(s.$route.path.includes('modules'))         return s.capApp.navigationModules;
			if(s.$route.path.includes('oauth-clients'))   return s.capApp.navigationOauthClients;
			if(s.$route.path.includes('repo'))            return s.capApp.navigationRepo;
			if(s.$route.path.includes('roles'))           return s.capApp.navigationRoles;
			if(s.$route.path.includes('scheduler'))       return s.capApp.navigationScheduler;
			return '';
		},
		licenseTitle:(s) => !s.activated
			? s.capApp.navigationLicense
			:`${s.capApp.navigationLicense} (${s.concurrentLogins} / ${s.license.loginCount})`,
		
		// stores
		activated:(s) => s.$store.getters['local/activated'],
		bgStyle:  (s) => s.$store.getters.colorMenuStyle,
		capApp:   (s) => s.$store.getters.captions.admin,
		colorMenu:(s) => s.$store.getters.colorMenu,
		isAdmin:  (s) => s.$store.getters.isAdmin,
		license:  (s) => s.$store.getters.license
	},
	methods:{
		// backend calls
		getConcurrentLogins() {
			ws.send('login','getConcurrent',{},true).then(
				res => this.concurrentLogins = res.payload,
				this.$root.genericError
			);
		}
	}
};