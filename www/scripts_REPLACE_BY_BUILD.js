import MyApp      from './comps/app.js';
import MyButton   from './comps/button.js';
import MyFilters  from './comps/filters.js';
import MyHome     from './comps/home.js';
import MySettings from './comps/settings.js';
import MyStore    from './stores/store.js';
import {
	MyGoForm,
	MyGoModule
} from './comps/go.js';
import {
	MyBool,
	MyBoolStringNumber
} from './comps/input.js';

// admin
import MyAdmin             from './comps/admin/admin.js';
import MyAdminConfig       from './comps/admin/adminConfig.js';
import MyAdminLdaps        from './comps/admin/adminLdaps.js';
import MyAdminLicense      from './comps/admin/adminLicense.js';
import MyAdminLogins       from './comps/admin/adminLogins.js';
import MyAdminLogs         from './comps/admin/adminLogs.js';
import MyAdminMails        from './comps/admin/adminMails.js';
import MyAdminMailAccounts from './comps/admin/adminMailAccounts.js';
import MyAdminModules      from './comps/admin/adminModules.js';
import MyAdminRepo         from './comps/admin/adminRepo.js';
import MyAdminRoles        from './comps/admin/adminRoles.js';
import MyAdminScheduler    from './comps/admin/adminScheduler.js';

// builder
import MyBuilder            from './comps/builder/builder.js';
import MyBuilderModules     from './comps/builder/builderModules.js';
import MyBuilderRelations   from './comps/builder/builderRelations.js';
import MyBuilderRelation    from './comps/builder/builderRelation.js';
import MyBuilderIcons       from './comps/builder/builderIcons.js';
import MyBuilderMenu        from './comps/builder/builderMenu.js';
import MyBuilderForms       from './comps/builder/builderForms.js';
import MyBuilderForm        from './comps/builder/builderForm.js';
import MyBuilderHelp        from './comps/builder/builderHelp.js';
import MyBuilderRoles       from './comps/builder/builderRoles.js';
import MyBuilderRole        from './comps/builder/builderRole.js';
import MyBuilderLoginForms  from './comps/builder/builderLoginForms.js';
import MyBuilderFunctions   from './comps/builder/builderFunctions.js';
import MyBuilderPgFunction  from './comps/builder/builderPgFunction.js';
import MyBuilderJsFunction  from './comps/builder/builderJsFunction.js';

// router
const MyRouterPositions = Object.create(null);
const MyRouter = VueRouter.createRouter({
	history:VueRouter.createWebHashHistory(),
	routes:[{
		path:'/home',
		component:MyHome,
		props:true
	},{
		path:'/settings',
		component:MySettings
	},{
		path:'/app/:moduleName/:moduleNameChild?',
		component:MyGoModule,
		props:true
	},{
		path:'/app/:moduleName/:moduleNameChild?/form/:formId/:recordIdString(\\d+)?',
		component:MyGoForm,
		meta:{ menu:true },
		props:true
	},{
		path:'/admin',
		redirect:'/admin/config',
		component:MyAdmin,
		children:[
			{ path:'config',      component:MyAdminConfig },
			{ path:'ldaps',       component:MyAdminLdaps },
			{ path:'license',     component:MyAdminLicense },
			{ path:'logins',      component:MyAdminLogins },
			{ path:'logs',        component:MyAdminLogs },
			{ path:'mails',       component:MyAdminMails },
			{ path:'mailaccounts',component:MyAdminMailAccounts },
			{ path:'modules',     component:MyAdminModules },
			{ path:'repo',        component:MyAdminRepo },
			{ path:'roles',       component:MyAdminRoles },
			{ path:'scheduler',   component:MyAdminScheduler }
		]
	},{
		path:'/builder',
		redirect:'/builder/modules',
		component:MyBuilder,
		children:[
			{
				path:'modules',
				component:MyBuilderModules
			},{
				path:'relations/:id',
				meta:{ nav:'relations', target:'module' },
				component:MyBuilderRelations,
				props:true
			},{
				path:'relation/:id',
				meta:{ nav:'relations', target:'relation' },
				component:MyBuilderRelation,
				props:true
			},{
				path:'icons/:id',
				meta:{ nav:'icons', target:'module' },
				component:MyBuilderIcons,
				props:true
			},{
				path:'menu/:id',
				meta:{ nav:'menu', target:'module' },
				component:MyBuilderMenu,
				props:true
			},{
				path:'forms/:id',
				meta:{ nav:'forms', target:'module' },
				component:MyBuilderForms,
				props:true
			},{
				path:'form/:id',
				meta:{ nav:'forms', target:'form' },
				component:MyBuilderForm,
				props:true
			},{
				path:'functions/:id',
				meta:{ nav:'functions', target:'module' },
				component:MyBuilderFunctions,
				props:true
			},{
				path:'roles/:id',
				meta:{ nav:'roles', target:'module' },
				component:MyBuilderRoles,
				props:true
			},{
				path:'role/:id',
				meta:{ nav:'roles', target:'role' },
				component:MyBuilderRole,
				props:true
			},{
				path:'login-forms/:id',
				meta:{ nav:'login-forms', target:'module' },
				component:MyBuilderLoginForms,
				props:true
			},{
				path:'pg-function/:id',
				meta:{ nav:'functions', target:'pg-function' },
				component:MyBuilderPgFunction,
				props:true
			},{
				path:'js-function/:id',
				meta:{ nav:'functions', target:'js-function' },
				component:MyBuilderJsFunction,
				props:true
			},{
				path:'help/:id',
				meta:{ nav:'help', target:'module' },
				component:MyBuilderHelp,
				props:true
			}
		]
	},{
		path:'/:pathMatch(.*)*',
		redirect:'/home'
	}],
	scrollBehavior:function(to,from,savedPosition) {
		
		// recover scroll position of form element if available
		if(typeof MyRouterPositions[to.path] !== 'undefined') {
			let e = document.getElementById(MyStore.getters.scrollFormId);
			
			if(e !== null)
				setTimeout(() => e.scrollTop = MyRouterPositions[to.path],50);
			
			return { top:0 };
		}
		
		// hash scrolling for HTML anchors
		if(to.hash !== '') {
			let parts = to.hash.substr(1).split('#')
			
			if(parts.length > 0) {
				let e = document.getElementById(parts[0]);
				
				if(e !== null)
					e.scrollIntoView();
			}
		}
		return { top:0 };
	}
});
MyRouter.beforeEach((to,from) => {
	// confirm unsaved form changes
	if(MyStore.getters.formHasChanges && MyStore.getters.settings.warnUnsaved) {
		
		if(!confirm(MyStore.getters.captions.form.dialog.prevBrowser))
			return false;
		
		MyStore.commit('formHasChanges',false);
	}
	
	// store scroll position of form element if available
	let e = document.getElementById(MyStore.getters.scrollFormId);
	if(e !== null)
		MyRouterPositions[from.path] = e.scrollTop;
	
	return true;
});

// define main app
const app = Vue.createApp(MyApp)
	.use(MyRouter)
	.use(MyStore)
	.directive('focus', { mounted:el => el.focus()})
	.component('draggable',window.vuedraggable)
	.component('my-bool',MyBool)
	.component('my-bool-string-number',MyBoolStringNumber)
	.component('my-button',MyButton)
	.component('my-filters',MyFilters)
;

app.directive('click-outside',{
	beforeMount:function(el,binding,vnode) {
		el.clickOutsideEvent = function(event) {
			
			if(el !== event.target && !el.contains(event.target))
				binding.value();
		};
		document.body.addEventListener('click',el.clickOutsideEvent);
	},
	unmounted:function(el) {
		document.body.removeEventListener('click',el.clickOutsideEvent);
	}
});

// mount main app
app.mount('#app-mount');

// basic service worker
// keep worker script name consistent so that browser can check for updates
if('serviceWorker' in navigator) {
	window.addEventListener('load',function() {
		navigator.serviceWorker
			.register('/worker.js')
			.then(function(reg) {
				if(!navigator.serviceWorker.controller || reg.waiting || reg.installing)
					return;
				
				reg.addEventListener('updatefound',function() {
					let worker = reg.installing;
					worker.addEventListener('statechange',function() {
						
						// reload page if new worker has been activated
						if(worker.state === 'activated')
							location.reload(false);
					});
				});
			})
			.catch(err => console.log('service worker not registered', err))
	});
}