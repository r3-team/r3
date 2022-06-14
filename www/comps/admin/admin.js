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
				<div class="top">
					<div class="area">
						<img class="icon" src="images/settings.png" />
						<h1>{{ capApp.title }}</h1>
					</div>
					<div class="area">
						<my-button image="question.png"
							@trigger="showDocs = !showDocs"
							:darkBg="true"
						/>
					</div>
				</div>
				
				<div class="top lower" v-if="settings.compact" />
				
				<div class="content no-padding">
					<!-- system configuration -->
					<router-link class="entry clickable" tag="div" to="/admin/config">
						<img src="images/server.png" />
						<span>{{ capApp.navigationConfig }}</span>
					</router-link>
					
					<!-- user management -->
					<router-link class="entry clickable" tag="div" to="/admin/logins">
						<img src="images/person.png" />
						<span>{{ capApp.navigationLogins }}</span>
					</router-link>
					
					<!-- role management -->
					<router-link class="entry clickable" tag="div" to="/admin/roles">
						<img src="images/admin.png" />
						<span>{{ capApp.navigationRoles }}</span>
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
					
					<!-- scheduler -->
					<router-link class="entry clickable" tag="div" to="/admin/scheduler">
						<img src="images/tasks.png" />
						<span>{{ capApp.navigationScheduler }}</span>
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
					
					<!-- cluster -->
					<router-link class="entry clickable" tag="div" to="/admin/cluster">
						<img src="images/cluster.png" />
						<span>{{ capApp.navigationCluster }}</span>
					</router-link>
					
					<!-- logs -->
					<router-link class="entry clickable" tag="div" to="/admin/logs">
						<img src="images/log.png" />
						<span>{{ capApp.navigationLogs }}</span>
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
		$route:function(val) {
			if(val.hash === '')
				this.showDocs = false;
		}
	},
	data:function() {
		return {
			ready:false,
			showDocs:false
		};
	},
	mounted:function() {
		if(!this.isAdmin)
			return this.$router.push('/');
		
		this.ready = true;
		this.$store.commit('moduleColor1','');
	},
	computed:{
		contentTitle:function() {
			if(this.$route.path.includes('cluster'))
				return this.capApp.navigationCluster;
			
			if(this.$route.path.includes('config'))
				return this.capApp.navigationConfig;
			
			if(this.$route.path.includes('docs'))
				return this.capApp.navigationDocs;
			
			if(this.$route.path.includes('license'))
				return this.capApp.navigationLicense;
				
			if(this.$route.path.includes('logins'))
				return this.capApp.navigationLogins;
			
			if(this.$route.path.includes('logs'))
				return this.capApp.navigationLogs;
			
			if(this.$route.path.includes('ldaps'))
				return this.capApp.navigationLdaps;
			
			if(this.$route.path.includes('mailaccounts'))
				return this.capApp.navigationMailAccounts;
			
			if(this.$route.path.includes('mails'))
				return this.capApp.navigationMails;
			
			if(this.$route.path.includes('modules'))
				return this.capApp.navigationModules;
			
			if(this.$route.path.includes('repo'))
				return this.capApp.navigationRepo;
			
			if(this.$route.path.includes('roles'))
				return this.capApp.navigationRoles;
			
			if(this.$route.path.includes('scheduler'))
				return this.capApp.navigationScheduler;
			
			return '';
		},
		
		// stores
		capApp:  function() { return this.$store.getters.captions.admin; },
		isAdmin: function() { return this.$store.getters.isAdmin; },
		settings:function() { return this.$store.getters.settings; }
	}
};