import srcBase64Icon       from './shared/image.js';
import {formOpen}          from './shared/form.js';
import {getStringFilled}   from './shared/generic.js';
import {getCaption}        from './shared/language.js';
import {layoutSettleSpace} from './shared/layout.js';
import {getDateFormat}     from './shared/time.js';
import {
	getCollectionColumn,
	getConsumersEntries
} from './shared/collection.js';

export default {
	name:'my-header',
	template:`<div class="app-header shade noPrint" :class="{ isDark:isDark }" :style="bgStyle">
		
		<div ref="content" class="entries">
			
			<!-- module hover menu action -->
			<div class="entry no-wrap clickable" tabindex="0"
				v-if="!showModuleIcons && !pwaSingle"
				@click="$emit('show-module-hover-menu')"
				@keyup.enter="$emit('show-module-hover-menu')"
			>
				<img src="images/dots.png" />
			</div>
			
			<template v-if="!isMobile && isAdmin && !pwaSingle" >
				<router-link class="entry no-wrap clickable" to="/builder"
					v-if="builderEnabled"
					:title="capGen.button.openBuilder"
				>
					<img src="images/builder.png" />
				</router-link>
				
				<router-link class="entry no-wrap clickable" to="/admin">
					<img src="images/serverCog.png" />
					<span v-if="!productionMode">{{ capGen.maintenance }}</span>
				</router-link>
			</template>
			
			<!-- home page -->
			<router-link class="entry no-wrap clickable" to="/home" v-if="!isMobile">
				<img src="images/home.png" />
				<span v-if="pwaSingle">{{ capGen.home }}</span>
			</router-link>
			
			<!-- single module link (for mobile view) -->
			<div class="entry no-wrap clickable" tabindex="0"
				v-if="moduleSingle !== false"
				@click="clickSingleModuleLink"
				@keyup.enter.space="clickSingleModuleLink"
				:class="{ 'router-link-active':isAtMenu || moduleSingleActive }"
			>
				<img :src="srcBase64Icon(moduleSingle.iconId,'images/module.png')" />
				<span>{{ moduleSingleCaption }}</span>
			</div>
			
			<!-- modules -->
			<div class="entry-wrap"
				v-if="showModuleIcons"
				v-for="me in moduleEntries"
				:key="me.id"
			>
				<div class="entry-bg"
					:class="{ 'router-link-active':$route.params.moduleName === me.name }"
				/>
				
				<router-link class="entry clickable"
					:class="{ 'router-link-active':$route.params.moduleName === me.name }"
					:to="'/app/'+me.name"
				>
					<img :src="srcBase64Icon(me.iconId,'images/module.png')" />
					<span v-if="settings.headerCaptions && showModuleTitles">
						{{ me.caption }}
					</span>
				</router-link>
				
				<!-- sub header -->
				<div class="children shade"
					v-if="me.children.length !== 0"
					:style="bgStyleEntries"
				>
					<!-- parent module (if accessible) -->
					<router-link class="entry child clickable"
						v-if="me.accessible"
						:class="{ 'router-link-active':$route.params.moduleNameChild === me.name }"
						:key="me.id"
						:to="'/app/'+me.name+'/'+me.name"
					>
						<img src="images/triangleUp.png" />
						<span>{{ me.caption }}</span>
					</router-link>
					
					<!-- module children -->
					<router-link class="entry child clickable"
						v-for="mec in me.children"
						:class="{ 'router-link-active':$route.params.moduleNameChild === mec.name }"
						:key="mec.id"
						:to="'/app/'+me.name+'/'+mec.name"
					>
						<img :src="srcBase64Icon(mec.iconId,'images/module.png')" />
						<span>{{ mec.caption }}</span>
					</router-link>
				</div>
			</div>
		</div>
		
		<div ref="empty" class="entries empty"></div>
		
		<div ref="system" class="entries">
			
			<!-- collection entries -->
			<div class="entry no-wrap" tabindex="0"
				v-if="showCollections"
				v-for="e in collectionEntries"
				@click.ctrl.exact="formOpen(e.openForm,true)"
				@click.left.exact="formOpen(e.openForm,false)"
				@click.middle.exact="formOpen(e.openForm,true)"
				@keyup.enter="formOpen(e.openForm,false)"
				:class="{ clickable:e.openForm !== null, readonly:e.openForm === null }"
				:title="e.title"
			>
				<img v-if="e.iconId !== null" :src="srcBase64Icon(e.iconId,'')" />
				<span>{{ e.value }}</span>
			</div>
			<div class="entry clickable" tabindex="0"
				v-if="collectionCounter !== 0"
				@click="$emit('show-collection-input',collectionEntries)"
				@keyup.enter="$emit('show-collection-input',collectionEntries)"
			>
				<img src="images/bell.png" />
				<span>{{ collectionCounter }}</span>
			</div>
			
			<!-- navigation -->
			<div class="entry no-wrap clickable"
				v-if="showNavPrev"
				@click="pagePrev"
				@keyup.enter="pagePrev"
				:class="{ readonly:isAtHistoryStart }"
				:tabindex="isAtHistoryStart ? -1 : 0"
			>
				<img src="images/pagePrev.png" />
			</div>
			<div class="entry no-wrap clickable"
				v-if="showNavNext"
				@click="pageNext"
				@keyup.enter="pageNext"
				:class="{ readonly:isAtHistoryEnd }"
				:tabindex="isAtHistoryEnd ? -1 : 0"
			>
				<img src="images/pageNext.png" />
			</div>
			
			<!-- keys locked -->
			<div class="entry no-wrap clickable" tabindex="0"
				v-if="keysLocked"
				@click="keysLockedMsg"
				@keyup.enter="keysLockedMsg"
			>
				<img src="images/keyLocked.png" />
			</div>
			
			<!-- feedback -->
			<div class="entry no-wrap clickable" tabindex="0"
				v-if="showFeedback"
				@click="openFeedback"
				@keyup.enter="openFeedback"
			>
				<img src="images/feedback.png" />
			</div>
			
			<!-- logout notification, session expiration -->
			<div class="entry clickable" tabindex="0"
				v-if="logoutInSec !== 0"
				@click="clickLogoutTimer"
				@keyup.enter="clickLogoutTimer"
			>
				<img src="images/logoff.png" />
				<span>{{ getStringFilled(Math.floor(logoutInSec / 60),2,'0') + ':' + getStringFilled(logoutInSec % 60,2,'0') }}</span>
			</div>
			
			<!-- system message, maintenance timer -->
			<div class="entry clickable" tabindex="0"
				v-if="showMaintenance && systemMsgActive"
				@click="openSystemMsg"
				@keyup.enter="openSystemMsg"
			>
				<img src="images/warning.png" />
				<span v-if="maintenanceInSec > 0">
					{{ getStringFilled(Math.floor(maintenanceInSec / 60),2,'0') + ':' + getStringFilled(maintenanceInSec % 60,2,'0') }}
				</span>
			</div>
			
			<!-- search bars -->
			<input class="app-header-search-input" enterkeyhint="send" type="text"
				v-if="isGlobalSearchOn"
				v-model="globalSearchInput"
				@keyup.enter="globalSearchStart($event.target.value); globalSearchInput = ''"
				:class="{ isDark, 'placeholder-bright':isDark }"
				:placeholder="capGen.search + '...'"
			/>
			
			<!-- settings -->
			<div class="entry no-wrap clickable" tabindex="0"
				v-if="!isNoAuth"
				@click="$emit('show-settings')"
				@keyup.enter="$emit('show-settings')"
			>
				<img src="images/person.png" />
				<span v-if="showLoginName">{{ loginName }}</span>
			</div>
			
			<!-- log off -->
			<div class="entry no-wrap clickable" tabindex="0"
				v-if="isNoAuth"
				@click="$emit('logout')"
				@keyup.enter="$emit('logout')"
			>
				<img src="images/logoff.png" />
			</div>
		</div>
		
		<div class="app-header-loading-wrap" v-if="busyCounter > 0">
			<div class="app-header-loading"></div>
		</div>
	</div>`,
	props:{
		keysLocked: { type:Boolean, required:true },
		logoutInSec:{ type:Number,  required:true }
	},
	watch:{
		maintenanceComing(v) {
			if(!v) {
				clearInterval(this.timerMaintenanceComing);
				this.maintenanceInSec = 0;
				return this.timerMaintenanceComing = null;
			}
			this.timerMaintenanceComing = setInterval(() => {
				this.maintenanceInSec = this.systemMsgDate1 - Math.floor(new Date().getTime() / 1000);
			}, 1000);
		}
	},
	emits:['logout','logoutExpire','show-collection-input','show-module-hover-menu','show-settings'],
	data() {
		return {
			globalSearchInput:'',
			maintenanceInSec:0,
			layoutCheckTimer:null,
			layoutElements:[],               // elements that are shown, based on available space
			layoutElementsAvailableInOrder:[ // elements that can be shown, in order of priority
				'moduleTitles',    // module titles, take up the most space, removed fully
				'collections',     // collection values/icons, replaced by hover menu
				'moduleIcons',     // module icons, replaced by hover menu
				'navigationNext',  // browser forward navigation, optional
				'navigationPrev',  // browser previous navigation, optional
				'feedback',        // feedback action, optional
				'maintenanceTimer',// timer for upcoming maintenance
				'loginName'        // display name for current login
			],
			timerMaintenanceComing:null
		};
	},
	computed:{
		bgStyle:(s) => {
			if(s.settings.colorClassicMode)
				return `background-color:${s.colorHeaderAccent.toString()};`;
			
			return `
				background-color:${s.colorHeaderMain.toString()};
				background-image:radial-gradient(at bottom right, ${s.colorHeaderAccent.toString()} 0%, ${s.colorHeaderMain.toString()} 60%);
				background-size:70% 120%;
				background-position:bottom right;
				background-repeat:no-repeat;
			`;
		},
		bgStyleEntries:(s) => {
			return s.settings.colorClassicMode
				? `background-color:${s.colorHeaderAccent.toString()};`
				: `background-color:${s.colorHeaderMain.toString()};`;
		},
		collectionCounter:(s) => {
			if(s.showCollections) return 0;
			
			let cnt = 0;
			for(let c of s.collectionEntries) {
				if(Number.isInteger(c.value))
					cnt += c.value;
			}
			return cnt;
		},
		collectionEntries:(s) => {
			let consumers = [];
			for(let k in s.collectionIdMap) {
				consumers = consumers.concat(s.collectionIdMap[k].inHeader);
			}
			return s.getConsumersEntries(consumers);
		},
		layoutElementsProcessed:(s) => {
			let elms   = JSON.parse(JSON.stringify(s.layoutElements));
			let elmDel = function(name) {
				const pos = elms.indexOf(name);
				if(pos !== -1)
					elms.splice(pos,1);
			};
			
			// reduce elements based on app && login settings
			if(s.isMobile || !s.settings.headerCaptions || !s.settings.headerModules)
				elmDel('moduleTitles');
			
			if(s.isMobile) {
				elmDel('collections');
				elmDel('loginName');
			}
			
			if(s.isMobile || s.pwaSingle || !s.settings.headerModules)
				elmDel('moduleIcons');
			
			return elms;
		},
		maintenanceComing:(s) => {
			const now = Math.floor(new Date().getTime() / 1000);
			return s.systemMsgActive && s.systemMsgMaintenance &&
				(s.systemMsgDate0 === 0 || s.systemMsgDate0 < now) &&
				(s.systemMsgDate1 === 0 || s.systemMsgDate1 > now) &&
				(s.systemMsgDate1 - now < 1800);
		},
		
		// returns which module to show if regular navigation is disabled
		moduleSingle:(s) => s.moduleIdLast !== null && s.isMobile
			? s.moduleIdMap[s.moduleIdLast] : false,
		moduleSingleActive:(s) => s.moduleSingle !== false && (
			(typeof s.$route.params.moduleName      !== 'undefined' && s.$route.params.moduleName      === s.moduleSingle.name) ||
			(typeof s.$route.params.moduleNameChild !== 'undefined' && s.$route.params.moduleNameChild === s.moduleSingle.name)
		),
		moduleSingleCaption:(s) => {
			if(s.moduleSingleActive && s.isMobile)
				return s.capGen.menu;
			
			const m = s.moduleSingle;
			return m === false ? '' : s.getCaption('moduleTitle',m.id,m.id,m.captions,m.name);
		},
		
		// simple
		isDark:          (s) => s.colorHeaderMain.isDark(),
		isGlobalSearchOn:(s) => s.searchModuleIds.length !== 0,
		pwaSingle:       (s) => s.pwaModuleId !== null,
		showCollections: (s) => s.layoutElementsProcessed.includes('collections'),
		showFeedback:    (s) => s.layoutElementsProcessed.includes('feedback') && s.feedback && !s.isNoAuth,
		showLoginName:   (s) => s.layoutElementsProcessed.includes('loginName'),
		showMaintenance: (s) => s.layoutElementsProcessed.includes('maintenanceTimer'),
		showModuleIcons: (s) => s.layoutElementsProcessed.includes('moduleIcons'),
		showModuleTitles:(s) => s.layoutElementsProcessed.includes('moduleTitles'),
		showNavNext:     (s) => s.layoutElementsProcessed.includes('navigationNext'),
		showNavPrev:     (s) => s.layoutElementsProcessed.includes('navigationPrev'),
		
		// stores
		loginNoCred:         (s) => s.$store.getters['local/loginNoCred'],
		moduleIdMap:         (s) => s.$store.getters['schema/moduleIdMap'],
		moduleNameMap:       (s) => s.$store.getters['schema/moduleNameMap'],
		formIdMap:           (s) => s.$store.getters['schema/formIdMap'],
		collectionIdMap:     (s) => s.$store.getters['schema/collectionIdMap'],
		appResized:          (s) => s.$store.getters.appResized,
		builderEnabled:      (s) => s.$store.getters.builderEnabled,
		busyCounter:         (s) => s.$store.getters.busyCounter,
		capErr:              (s) => s.$store.getters.captions.error,
		capGen:              (s) => s.$store.getters.captions.generic,
		colorHeaderAccent:   (s) => s.$store.getters.colorHeaderAccent,
		colorHeaderMain:     (s) => s.$store.getters.colorHeaderMain,
		feedback:            (s) => s.$store.getters.feedback,
		isAdmin:             (s) => s.$store.getters.isAdmin,
		isAtHistoryEnd:      (s) => s.$store.getters.isAtHistoryEnd,
		isAtHistoryStart:    (s) => s.$store.getters.isAtHistoryStart,
		isAtMenu:            (s) => s.$store.getters.isAtMenu,
		isMobile:            (s) => s.$store.getters.isMobile,
		isNoAuth:            (s) => s.$store.getters.isNoAuth,
		loginName:           (s) => s.$store.getters.loginName,
		loginSessionExpires: (s) => s.$store.getters.loginSessionExpires,
		moduleEntries:       (s) => s.$store.getters.moduleEntries,
		productionMode:      (s) => s.$store.getters.productionMode,
		pwaModuleId:         (s) => s.$store.getters.pwaModuleId,
		moduleIdLast:        (s) => s.$store.getters.moduleIdLast,
		searchModuleIds:     (s) => s.$store.getters.searchModuleIds,
		settings:            (s) => s.$store.getters.settings,
		systemMsgActive:     (s) => s.$store.getters.systemMsgActive,
		systemMsgDate0:      (s) => s.$store.getters.systemMsgDate0,
		systemMsgDate1:      (s) => s.$store.getters.systemMsgDate1,
		systemMsgMaintenance:(s) => s.$store.getters.systemMsgMaintenance,
		systemMsgText:       (s) => s.$store.getters.systemMsgText
	},
	mounted() {
		this.$watch('appResized',this.resized);
		this.$watch(() => [this.colorHeaderAccent,this.colorHeaderMain],() => { this.updateMetaThemeColor() },{
			immediate:true
		});
		this.resized();

		this.$store.commit('keyDownHandlerAdd',{fnc:this.globalSearchStart,key:'F',keyCtrl:true,keyShift:true});
	},
	unmounted() {
		this.$store.commit('keyDownHandlerDel',this.globalSearchStart);
	},
	methods:{
		// externals
		formOpen,
		getCaption,
		getCollectionColumn,
		getConsumersEntries,
		getDateFormat,
		getStringFilled,
		layoutSettleSpace,
		srcBase64Icon,
		
		// display
		keysLockedMsg() {
			this.$store.commit('dialog',{
				captionBody:this.loginNoCred ? this.capErr.SEC['007'] : this.capErr.SEC['002'],
				image:'keyLocked.png'
			});
		},
		updateMetaThemeColor() {
			const color = this.settings.colorClassicMode
				? this.colorHeaderAccent
				: this.colorHeaderMain;
			
			// set meta theme color (for PWA window color)
			document.querySelector('meta[name="theme-color"]').setAttribute('content',color.toString());
		},
		resized() {
			if(this.layoutCheckTimer !== null)
				clearTimeout(this.layoutCheckTimer);
			
			this.layoutCheckTimer = setTimeout(() => {
				this.layoutElements = JSON.parse(JSON.stringify(this.layoutElementsAvailableInOrder));
				this.$nextTick(() => this.layoutSettleSpace(this.layoutElements,this.$refs.empty));
			},300);
		},
		
		// actions
		clickLogoutTimer() {
			const d = this.getDateFormat(new Date(this.loginSessionExpires*1000),'H:i');
			this.$store.commit('dialog',{
				captionBody:this.capGen.dialog.logoutComing.replace('{DATE}',d),
				captionTop:this.capGen.dialog.logoutComingTitle,
				image:'logoff.png',
				buttons:[{
					cancel:true,
					caption:this.capGen.button.relog1,
					exec:() => this.$emit('logoutExpire'),
					keyEnter:true,
					image:'logoff.png'
				},{
					caption:this.capGen.button.relog0,
					keyEscape:true,
					image:'clock.png'
				}]
			});
		},
		clickSingleModuleLink() {
			// module active in mobile mode: toggle menu
			if(this.moduleSingleActive && this.isMobile)
				return this.$store.commit('isAtMenu',!this.isAtMenu);
			
			// no active module in mobile mode: navigate to module
			if(!this.moduleSingleActive && this.isMobile)
				return this.$router.push(`/app/${this.moduleSingle.name}/${this.moduleSingle.name}`);
		},
		globalSearchStart(v) {
			if(this.isGlobalSearchOn)
				this.$store.commit('globalSearchInput',v !== undefined ? v : window.getSelection().toString());
		},
		openSystemMsg() {
			const d = this.getDateFormat(new Date(this.systemMsgDate1*1000),'H:i');
			this.$store.commit('dialog',{
				captionTop:this.capGen.dialog.systemMsg,
				captionBody:this.systemMsgText !== '' ? this.systemMsgText : this.capGen.dialog.maintenanceComing.replace('{DATE}',d),
				image:'warning.png'
			});
		},
		openFeedback() { this.$store.commit('isAtFeedback',true); },
		pagePrev()     { if(!this.isAtHistoryStart) window.history.back(); },
		pageNext()     { if(!this.isAtHistoryEnd)   window.history.forward(); }
	}
};