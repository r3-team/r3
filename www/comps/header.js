import srcBase64Icon         from './shared/image.js';
import {getColumnTitle}      from './shared/column.js';
import {formOpen}            from './shared/form.js';
import {openLink}            from './shared/generic.js';
import {getCaptionForModule} from './shared/language.js';
import {
	getCollectionColumn,
	getCollectionValues
} from './shared/collection.js';
export {MyHeader as default};

let MyHeader = {
	name:'my-header',
	template:`<div class="app-header shade noPrint" :class="{ isDark:colorHeaderMainDark }" :style="bgStyle">
		
		<div ref="content" class="entries">
			
			<!-- module hover menu action -->
			<div class="entry no-wrap clickable" tabindex="0"
				v-if="!showModuleIcons"
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
				<span v-if="!isMobile && pwaSingle">{{ capGen.home }}</span>
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
			
			<!-- settings -->
			<router-link class="entry no-wrap clickable" to="/settings"
				v-if="!isNoAuth"
			>
				<img src="images/person.png" />
			</router-link>
			
			<!-- log off -->
			<div class="entry no-wrap clickable" tabindex="0"
				v-if="isNoAuth"
				@click="$emit('logout')"
				@keyup.enter="$emit('logout')"
			>
				<img src="images/logoff.png" />
			</div>
		</div>
		
		<div class="app-header-loading" v-if="busyCounter > 0"></div>
	</div>`,
	props:{
		keysLocked:   { type:Boolean, required:true },
		moduleEntries:{ type:Array,   required:true }
	},
	emits:['logout','show-collection-input','show-module-hover-menu'],
	data() {
		return {
			layoutCheckTimer:null,
			layoutReducedElements:[],        // list of elements that needed to be reduced to fit the current window width
			layoutReducibleElementsInOrder:[ // list of elements that can be reduced, in order of priority
				'moduleTitles',   // module titles, take up the most space, removed fully
				'collections',    // collection values/icons, replaced by hover menu
				'moduleIcons',    // module icons, replaced by hover menu
				'navigationNext', // browser forward navigation
				'navigationPrev', // browser previous navigation
				'feedback'        // feedback action
			],
		};
	},
	watch:{
		colorHeaderMain:{
			handler(v) {
				// set meta theme color (for PWA window color)
				document.querySelector('meta[name="theme-color"]').setAttribute('content',`#${v}`);
			},
			immediate:true
		}
	},
	computed:{
		bgStyle:(s) => {
			return `
				background-color:#${s.colorHeaderMain};
				background-image:radial-gradient(at bottom right, #${s.colorHeaderAccent} 0%, #${s.colorHeaderMain} 60%);
				background-size:70% 120%;
				background-position:bottom right;
				background-repeat:no-repeat;
			`;
		},
		bgStyleEntries:(s) => `background-color:#${s.colorHeaderMain};`,
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
					let collection = s.collectionIdMap[k];
					let consumer   = collection.inHeader[i];
					
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
						)),
						value:value
					});
				}
			}
			return out;
		},
		elementsReduced:(s) => {
			let elms = JSON.parse(JSON.stringify(s.layoutReducedElements));
			
			// reduce elements based on app && login settings
			if(s.isMobile || !s.settings.headerCaptions || !s.settings.headerModules)
				elms.push('moduleTitles');
			
			if(s.isMobile)
				elms.push('collections');
			
			if(s.isMobile || s.pwaSingle || !s.settings.headerModules)
				elms.push('moduleIcons');
			
			return elms;
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
			
			return s.moduleSingle === false
				? '' : s.getCaptionForModule(s.moduleSingle.captions.moduleTitle,s.moduleSingle.name,s.moduleSingle);
		},
		
		// simple
		pwaSingle:       (s) => s.pwaModuleId !== null,
		showCollections: (s) => !s.elementsReduced.includes('collections'),
		showFeedback:    (s) => !s.elementsReduced.includes('feedback') && s.feedback && !s.isNoAuth,
		showModuleIcons: (s) => !s.elementsReduced.includes('moduleIcons'),
		showModuleTitles:(s) => !s.elementsReduced.includes('moduleTitles'),
		showNavNext:     (s) => !s.elementsReduced.includes('navigationNext'),
		showNavPrev:     (s) => !s.elementsReduced.includes('navigationPrev'),
		
		// stores
		modules:            (s) => s.$store.getters['schema/modules'],
		moduleIdMap:        (s) => s.$store.getters['schema/moduleIdMap'],
		moduleNameMap:      (s) => s.$store.getters['schema/moduleNameMap'],
		formIdMap:          (s) => s.$store.getters['schema/formIdMap'],
		collectionIdMap:    (s) => s.$store.getters['schema/collectionIdMap'],
		builderEnabled:     (s) => s.$store.getters.builderEnabled,
		busyCounter:        (s) => s.$store.getters.busyCounter,
		capErr:             (s) => s.$store.getters.captions.error,
		capGen:             (s) => s.$store.getters.captions.generic,
		colorHeaderAccent:  (s) => s.$store.getters.colorHeaderAccent,
		colorHeaderMain:    (s) => s.$store.getters.colorHeaderMain,
		colorHeaderMainDark:(s) => s.$store.getters.colorHeaderMainDark,
		feedback:           (s) => s.$store.getters.feedback,
		isAdmin:            (s) => s.$store.getters.isAdmin,
		isAtMenu:           (s) => s.$store.getters.isAtMenu,
		isMobile:           (s) => s.$store.getters.isMobile,
		isNoAuth:           (s) => s.$store.getters.isNoAuth,
		pwaModuleId:        (s) => s.$store.getters.pwaModuleId,
		moduleIdLast:       (s) => s.$store.getters.moduleIdLast,
		settings:           (s) => s.$store.getters.settings
	},
	created() {
		window.addEventListener('resize',this.windowResized);
	},
	mounted() {
		this.windowResized();
	},
	unmounted() {
		window.removeEventListener('resize',this.windowResized);
	},
	methods:{
		// externals
		formOpen,
		getCaptionForModule,
		getCollectionColumn,
		getCollectionValues,
		getColumnTitle,
		openLink,
		srcBase64Icon,
		
		// display
		layoutAdjust() {
			this.layoutCheckTimer = null;
			const enoughSpace = this.$refs.empty.offsetWidth > 10;
			
			if(enoughSpace || this.elementsReduced.length === this.layoutReducibleElementsInOrder.length)
				return;
			
			// space insufficient and still elements available to reduce
			for(const elm of this.layoutReducibleElementsInOrder) {
				if(this.elementsReduced.includes(elm))
					continue;
				
				this.layoutReducedElements.push(elm);
				
				// recheck after adjustment, in case further reduction is required
				this.$nextTick(this.layoutAdjust);
				break;
			}
		},
		keysLockedMsg() {
			this.$store.commit('dialog',{
				captionBody:this.capErr.SEC['002'],
				image:'key_locked.png'
			});
		},
		windowResized() {
			if(this.layoutCheckTimer !== null)
				clearTimeout(this.layoutCheckTimer);
			
			this.layoutCheckTimer = setTimeout(() => {
				this.layoutReducedElements = [];   // reset reduced elements for new window size
				this.$nextTick(this.layoutAdjust); // wait for layout to settle before adjustments
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
		openFeedback() { this.$store.commit('isAtFeedback',true); },
		pagePrev()     { window.history.back(); },
		pageNext()     { window.history.forward(); }
	}
};