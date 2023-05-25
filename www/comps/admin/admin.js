import MyAdminDocs from './adminDocs.js';
export {MyAdmin as default};

let MyAdmin = {
	name:'my-admin',
	components:{
		MyAdminDocs,
	},
	template:`<div class="admin">
	
		<div class="navigationWrap">
			<div class="navigation contentBox">
				<div class="top lower">
					<div class="area">
						<img class="icon" src="images/serverCog.png" />
						<h1>{{ capApp.title }}</h1>
					</div>
					<div class="area">
						<my-button image="question.png"
							@trigger="showDocs = !showDocs"
							:tight="true"
						/>
					</div>
				</div>
				
				<div class="content no-padding">
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
					
					<!-- LDAP -->
					<router-link class="entry clickable" tag="div" to="/admin/ldaps">
						<img src="images/hierarchy.png" />
						<span>{{ capApp.navigationLdaps }}</span>
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
					<router-link class="entry clickable" tag="div" to="/admin/mails">
						<img src="images/mail_spool.png" />
						<span>{{ capApp.navigationMails }}</span>
					</router-link>
					
					<!-- backups -->
					<router-link class="entry clickable" tag="div" to="/admin/backups">
						<img src="images/backup.png" />
						<span>{{ capApp.navigationBackups }}</span>
					</router-link>
					
					<!-- cluster -->
					<router-link class="entry clickable" tag="div" to="/admin/cluster">
						<img src="images/cluster.png" />
						<span>{{ capApp.navigationCluster }}</span>
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
					
					<!-- license -->
					<router-link class="entry clickable" tag="div" to="/admin/license">
						<img src="images/key.png" />
						<span>{{ capApp.navigationLicense }}</span>
					</router-link>
				</div>
			</div>
		</div>
		
		<router-view
			v-if="ready"
			v-show="!showDocs"
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
			ready:false,
			showDocs:false
		};
	},
	mounted() {
		if(!this.isAdmin)
			return this.$router.push('/');
		
		this.ready = true;
	},
	computed:{
		contentTitle:(s) => {
			if(s.$route.path.includes('backups'))        return s.capApp.navigationBackups;
			if(s.$route.path.includes('cluster'))        return s.capApp.navigationCluster;
			if(s.$route.path.includes('config'))         return s.capApp.navigationConfig;
			if(s.$route.path.includes('docs'))           return s.capApp.navigationDocs;
			if(s.$route.path.includes('files'))          return s.capApp.navigationFiles;
			if(s.$route.path.includes('license'))        return s.capApp.navigationLicense;
			if(s.$route.path.includes('logins'))         return s.capApp.navigationLogins;
			if(s.$route.path.includes('logintemplates')) return s.capApp.navigationLoginTemplates;
			if(s.$route.path.includes('logs'))           return s.capApp.navigationLogs;
			if(s.$route.path.includes('ldaps'))          return s.capApp.navigationLdaps;
			if(s.$route.path.includes('mailaccounts'))   return s.capApp.navigationMailAccounts;
			if(s.$route.path.includes('mails'))          return s.capApp.navigationMails;
			if(s.$route.path.includes('modules'))        return s.capApp.navigationModules;
			if(s.$route.path.includes('repo'))           return s.capApp.navigationRepo;
			if(s.$route.path.includes('roles'))          return s.capApp.navigationRoles;
			if(s.$route.path.includes('scheduler'))      return s.capApp.navigationScheduler;
			return '';
		},
		
		// stores
		capApp: (s) => s.$store.getters.captions.admin,
		isAdmin:(s) => s.$store.getters.isAdmin
	}
};