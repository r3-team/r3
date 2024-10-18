import srcBase64Icon     from './shared/image.js';
import {getColumnTitle}  from './shared/column.js';
import {formOpen}        from './shared/form.js';
import {getStringFilled} from './shared/generic.js';
import {getCaption}      from './shared/language.js';
import {getDateFormat}   from './shared/time.js';
import {
	getCollectionColumn,
	getCollectionValues
} from './shared/collection.js';
export {MyHeader as default};

let MyHeader = {
	name:'my-header',
	template:`<div class="app-header shade noPrint" :class="{ isDark:colorHeaderMain.isDark() }" :style="bgStyle">
		
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
				@click="formOpen(e.openForm)"
				@keyup.enter="formOpen(e.openForm)"
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
			<div class="entry no-wrap clickable" tabindex="0"
				v-if="showNavPrev"
				@click="pagePrev"
				@keyup.enter="pagePrev"
			>
				<img src="images/pagePrev.png" />
			</div>
			<div class="entry no-wrap clickable" tabindex="0"
				v-if="showNavNext"
				@click="pageNext"
				@keyup.enter="pageNext"
			>
				<img src="images/pageNext.png" />
			</div>
			
			<!-- keys locked -->
			<div class="entry no-wrap clickable" tabindex="0"
				v-if="keysLocked"
				@click="keysLockedMsg"
				@keyup.enter="keysLockedMsg"
			>
				<img src="images/key_locked.png" />
			</div>
			
			<!-- feedback -->
			<div class="entry no-wrap clickable" tabindex="0"
				v-if="showFeedback"
				@click="openFeedback"
				@keyup.enter="openFeedback"
			>
				<img src="images/feedback.png" />
			</div>
			
			<!-- system message, maintenance timer -->
			<div class="entry clickable" tabindex="0"
				v-if="maintenanceInSec > 0"
				@click="openSystemMsg"
				@keyup.enter="openSystemMsg"
			>
				<img src="images/warning.png" />
				<span v-if="showMaintenance">
					{{ getStringFilled(Math.floor(maintenanceInSec / 60),2,'0') + ':' + getStringFilled(maintenanceInSec % 60,2,'0') }}
				</span>
			</div>
			
			<!-- settings -->
			<div class="entry no-wrap clickable" tabindex="0"
				v-if="!isNoAuth"
				@click="$emit('show-settings')"
				@keyup.enter="$emit('show-settings')"
			>
				<img src="images/person.png" />
				<span>{{ loginName }}</span>
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
		keysLocked:{ type:Boolean, required:true }
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
	emits:['logout','show-collection-input','show-module-hover-menu','show-settings'],
	data() {
		return {
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
				'maintenanceTimer' // timer for upcoming maintenance
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
			let out = [];
			for(let k in s.collectionIdMap) {
				for(let i = 0, j = s.collectionIdMap[k].inHeader.length; i < j; i++) {
					const collection = s.collectionIdMap[k];
					const consumer   = collection.inHeader[i];
					
					if(!consumer.onMobile && s.isMobile)
						continue;
					
					if(s.pwaModuleId !== null && collection.moduleId !== s.pwaModuleId)
						continue;
					
					let value = s.getCollectionValues(
						collection.id,
						consumer.columnIdDisplay,
						true
					);
					if(consumer.noDisplayEmpty && (value === null || value === 0 || value === ''))
						continue;
					
					out.push({
						iconId:collection.iconId,
						openForm:consumer.openForm,
						title:s.getColumnTitle(s.getCollectionColumn(
							collection.id,
							consumer.columnIdDisplay
						),collection.moduleId),
						value:value
					});
				}
			}
			return out;
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
			
			if(s.isMobile)
				elmDel('collections');
			
			if(s.isMobile || s.pwaSingle || !s.settings.headerModules)
				elmDel('moduleIcons');
			
			return elms;
		},
		maintenanceComing:(s) => {
			const now = Math.floor(new Date().getTime() / 1000);
			return s.activated && s.systemMsgActive && s.systemMsgMaintenance &&
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
		pwaSingle:       (s) => s.pwaModuleId !== null,
		showCollections: (s) => s.layoutElementsProcessed.includes('collections'),
		showFeedback:    (s) => s.layoutElementsProcessed.includes('feedback') && s.feedback && !s.isNoAuth,
		showMaintenance: (s) => s.layoutElementsProcessed.includes('maintenanceTimer'),
		showModuleIcons: (s) => s.layoutElementsProcessed.includes('moduleIcons'),
		showModuleTitles:(s) => s.layoutElementsProcessed.includes('moduleTitles'),
		showNavNext:     (s) => s.layoutElementsProcessed.includes('navigationNext'),
		showNavPrev:     (s) => s.layoutElementsProcessed.includes('navigationPrev'),
		
		// stores
		activated:           (s) => s.$store.getters['local/activated'],
		moduleIdMap:         (s) => s.$store.getters['schema/moduleIdMap'],
		moduleNameMap:       (s) => s.$store.getters['schema/moduleNameMap'],
		formIdMap:           (s) => s.$store.getters['schema/formIdMap'],
		collectionIdMap:     (s) => s.$store.getters['schema/collectionIdMap'],
		builderEnabled:      (s) => s.$store.getters.builderEnabled,
		busyCounter:         (s) => s.$store.getters.busyCounter,
		capErr:              (s) => s.$store.getters.captions.error,
		capGen:              (s) => s.$store.getters.captions.generic,
		colorHeaderAccent:   (s) => s.$store.getters.colorHeaderAccent,
		colorHeaderMain:     (s) => s.$store.getters.colorHeaderMain,
		feedback:            (s) => s.$store.getters.feedback,
		isAdmin:             (s) => s.$store.getters.isAdmin,
		isAtMenu:            (s) => s.$store.getters.isAtMenu,
		isMobile:            (s) => s.$store.getters.isMobile,
		isNoAuth:            (s) => s.$store.getters.isNoAuth,
		loginName:           (s) => s.$store.getters.loginName,
		moduleEntries:       (s) => s.$store.getters.moduleEntries,
		pwaModuleId:         (s) => s.$store.getters.pwaModuleId,
		moduleIdLast:        (s) => s.$store.getters.moduleIdLast,
		settings:            (s) => s.$store.getters.settings,
		systemMsgActive:     (s) => s.$store.getters.systemMsgActive,
		systemMsgDate0:      (s) => s.$store.getters.systemMsgDate0,
		systemMsgDate1:      (s) => s.$store.getters.systemMsgDate1,
		systemMsgMaintenance:(s) => s.$store.getters.systemMsgMaintenance,
		systemMsgText:       (s) => s.$store.getters.systemMsgText
	},
	created() {
		window.addEventListener('resize',this.windowResized);
	},
	mounted() {
		this.$watch(() => [this.colorHeaderAccent,this.colorHeaderMain],() => { this.updateMetaThemeColor() },{
			immediate:true
		});
		
		this.windowResized();
	},
	unmounted() {
		window.removeEventListener('resize',this.windowResized);
	},
	methods:{
		// externals
		formOpen,
		getCaption,
		getCollectionColumn,
		getCollectionValues,
		getColumnTitle,
		getDateFormat,
		getStringFilled,
		srcBase64Icon,
		
		// display
		layoutAdjust() {
			this.layoutCheckTimer = null;
			
			if(typeof this.$refs.empty === 'undefined' || this.$refs.empty.offsetWidth > 10 || this.layoutElements.length === 0)
				return;
			
			// space insufficient and still elements available to reduce
			this.layoutElements.shift();       // remove next element
			this.$nextTick(this.layoutAdjust); // recheck after change
		},
		keysLockedMsg() {
			this.$store.commit('dialog',{
				captionBody:this.capErr.SEC['002'],
				image:'key_locked.png'
			});
		},
		updateMetaThemeColor() {
			const color = this.settings.colorClassicMode
				? this.colorHeaderAccent
				: this.colorHeaderMain;
			
			// set meta theme color (for PWA window color)
			document.querySelector('meta[name="theme-color"]').setAttribute('content',color.toString());
		},
		windowResized() {
			if(this.layoutCheckTimer !== null)
				clearTimeout(this.layoutCheckTimer);
			
			this.layoutCheckTimer = setTimeout(() => {
				// reset elements, then wait for layout to settle to check
				this.layoutElements = JSON.parse(JSON.stringify(this.layoutElementsAvailableInOrder));
				this.$nextTick(this.layoutAdjust);
			},300);
		},
		
		// actions
		clickSingleModuleLink() {
			// module active in mobile mode: toggle menu
			if(this.moduleSingleActive && this.isMobile)
				return this.$store.commit('isAtMenu',!this.isAtMenu);
			
			// no active module in mobile mode: navigate to module
			if(!this.moduleSingleActive && this.isMobile)
				return this.$router.push(`/app/${this.moduleSingle.name}/${this.moduleSingle.name}`);
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
		pagePrev()     { window.history.back(); },
		pageNext()     { window.history.forward(); }
	}
};