import MyAdminDocs from './adminDocs.js';
export {MyAdmin as default};

let MyAdmin = {
	name:'my-admin',
	components:{
		MyAdminDocs,
	},
	template:`<div class="admin">
		<div class="navigation" :class="{ isDark:isDark }" :style="bgStyle">
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
			<router-link class="entry clickable" tag="div" to="/admin/logintemplates">
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
			<router-link class="entry clickable" tag="div" to="/admin/mailaccounts">
				<img src="images/mail2.png" />
				<span>{{ capApp.navigationMailAccounts }}</span>
			</router-link>
			
			<!-- mail spooler -->
			<router-link class="entry clickable" tag="div" to="/admin/mailspooler">
				<img src="images/mail_spool.png" />
				<span>{{ capApp.navigationMailSpooler }}</span>
			</router-link>
			
			<!-- mail traffic -->
			<router-link class="entry clickable" tag="div" to="/admin/mailtraffic">
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
			
			
			<!-- REI3 Professional -->
			<router-link class="entry clickable separator" tag="div" to="/admin/license">
				<img src="images/key.png" />
				<span>{{ licenseTitle }}</span>
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
			
			<!-- cluster -->
			<router-link class="entry clickable" tag="div" to="/admin/cluster" :class="{ inactive:!activated }">
				<img src="images/cluster.png" />
				<span>{{ capApp.navigationCluster }}</span>
			</router-link>
		</div>
		
		<router-view
			v-if="ready"
			v-show="!showDocs"
			@hotkeysRegister="hotkeysChild = $event"
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
			hotkeysChild:[],    // hotkeys from child components
			ready:false,
			showDocs:false
		};
	},
	mounted() {
		if(!this.isAdmin)
			return this.$router.push('/');
		
		this.getConcurrentLogins();
		this.ready = true;
		window.addEventListener('keydown',this.handleHotkeys);
	},
	unmounted() {
		window.removeEventListener('keydown',this.handleHotkeys);
	},
	computed:{
		contentTitle:(s) => {
			if(s.$route.path.includes('backups'))        return s.capApp.navigationBackups;
			if(s.$route.path.includes('cluster'))        return s.capApp.navigationCluster;
			if(s.$route.path.includes('config'))         return s.capApp.navigationConfig;
			if(s.$route.path.includes('custom'))         return s.capApp.navigationCustom;
			if(s.$route.path.includes('docs'))           return s.capApp.navigationDocs;
			if(s.$route.path.includes('files'))          return s.capApp.navigationFiles;
			if(s.$route.path.includes('license'))        return s.capApp.navigationLicense;
			if(s.$route.path.includes('logins'))         return s.capApp.navigationLogins;
			if(s.$route.path.includes('logintemplates')) return s.capApp.navigationLoginTemplates;
			if(s.$route.path.includes('logs'))           return s.capApp.navigationLogs;
			if(s.$route.path.includes('ldaps'))          return s.capApp.navigationLdaps;
			if(s.$route.path.includes('mailaccounts'))   return s.capApp.navigationMailAccounts;
			if(s.$route.path.includes('mailspooler'))    return s.capApp.navigationMailSpooler;
			if(s.$route.path.includes('mailtraffic'))    return s.capApp.navigationMailTraffic;
			if(s.$route.path.includes('modules'))        return s.capApp.navigationModules;
			if(s.$route.path.includes('repo'))           return s.capApp.navigationRepo;
			if(s.$route.path.includes('roles'))          return s.capApp.navigationRoles;
			if(s.$route.path.includes('scheduler'))      return s.capApp.navigationScheduler;
			return '';
		},
		licenseTitle:(s) => !s.activated
			? s.capApp.navigationLicense
			:`${s.capApp.navigationLicense} (${s.concurrentLogins} / ${s.license.loginCount})`,
		
		// stores
		activated:(s) => s.$store.getters['local/activated'],
		bgStyle:  (s) => s.$store.getters.colorMenuStyle,
		capApp:   (s) => s.$store.getters.captions.admin,
		isAdmin:  (s) => s.$store.getters.isAdmin,
		isDark:   (s) => s.$store.getters.colorMenuDark,
		license:  (s) => s.$store.getters.license
	},
	methods:{
		// handlers
		handleHotkeys(evt) {
			// registered child hotkeys
			for(let k of this.hotkeysChild) {
				if(k.keyCtrl && !evt.ctrlKey)
					continue;
				
				if(k.key === evt.key) {
					evt.preventDefault();
					k.fnc();
				}
			}
		},
		
		// backend calls
		getConcurrentLogins() {
			ws.send('login','getConcurrent',{},true).then(
				res => this.concurrentLogins = res.payload,
				this.$root.genericError
			);
		}
	}
};