import srcBase64Icon    from './shared/image.js';
import {getColumnTitle} from './shared/column.js';
import {formOpen}       from './shared/form.js';
import {
	getCollectionColumn,
	getCollectionValues
} from './shared/collection.js';
export {MyHeader as default};

let MyHeader = {
	name:'my-header',
	template:`<div class="app-header shade noPrint">
		
		<div class="app-header-bg" :style="bgStyle" />
		
		<div class="app-header-content" :style="styles">
			<div ref="content" class="entries">
				
				<template v-if="!isMobile && isAdmin" >
					
					<router-link class="entry no-wrap clickable" to="/builder"
						v-if="builderEnabled"
					>
						<img src="images/builder.png" />
					</router-link>
					
					<router-link class="entry no-wrap clickable" to="/admin">
						<img src="images/settings.png" />
					</router-link>
				</template>
				
				<!-- home page -->
				<router-link class="entry no-wrap clickable" to="/home">
					<img src="images/home.png" />
				</router-link>
				
				<!-- mobile menu toggle -->
				<div class="entry no-wrap clickable" tabindex="0"
					v-if="menuAvailable && isMobile && moduleActive !== false"
					@click="$store.commit('isAtMenu',!isAtMenu)"
					@keyup.enter.space="$store.commit('isAtMenu',!isAtMenu)"
					:class="{ 'router-link-active':isAtMenu }"
				>
					<img :src="srcBase64Icon(moduleActive.iconId,'images/module.png')" />
					<span>{{ capGen.menu }}</span>
				</div>
				
				<!-- modules -->
				<div class="entry-wrap"
					v-if="!isMobile"
					v-for="me in moduleEntries"
					:key="me.id"
				>
					<div class="entry-bg"
						:class="{ 'router-link-active':$route.params.moduleName === me.name }"
						:style="bgStyle"
					/>
					
					<router-link class="entry clickable"
						:class="{ 'router-link-active':$route.params.moduleName === me.name }"
						:to="'/app/'+me.name"
					>
						<img :src="srcBase64Icon(me.iconId,'images/module.png')" />
						<span v-if="settings.headerCaptions && !reducedHeader">
							{{ me.caption }}
						</span>
					</router-link>
					
					<!-- sub header -->
					<div class="children shade"
						v-if="me.children.length !== 0"
						:style="bgStyle"
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
			
			<div ref="empty" class="entries" style="flex:1 1 auto;"></div>
			
			<div ref="system" class="entries">
				
				<!-- busy indicator -->
    				<transition name="fade_out">
					<div class="entry no-wrap"
						v-if="busyCounter > 0"
						:title="capGen.busy"
					><img src="images/load.gif" /></div>
				</transition>
				
				<!-- collection entries -->
				<div class="entry no-wrap clickable" tabindex="0"
					v-if="collectionCounter === 0"
					v-for="e in collectionEntries"
					@click="formOpen(e.openForm)"
					@keyup.enter="formOpen(e.openForm)"
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
					@click="pagePrev"
					@keyup.enter="pagePrev"
				>
					<img src="images/pagePrev.png" />
				</div>
				<div class="entry no-wrap clickable" tabindex="0"
					v-if="!isMobile"
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
					v-if="feedback && !isNoAuth"
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
		</div>
	</div>`,
	props:{
		bgStyle:      { type:String,  required:true },
		keysLocked:   { type:Boolean, required:true },
		moduleEntries:{ type:Array,   required:true }
	},
	emits:['logout','show-collection-input'],
	data() {
		return {
			contentSizePx:0,        // width in pixel required by all application entries
			contentSizePxBuffer:50, // keep this space free (currently only for busy indicator)
			reducedHeader:false,    // reduce sizes for application entries if space is limited
			sizeCheckTimedOut:false // time-out for checking header size
		};
	},
	computed:{
		collectionCounter:(s) => {
			if(!s.isMobile) return 0;
			
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
		moduleActive:(s) => {
			if(s.$route.params.moduleName === '')
				return false;
			
			if(s.$route.params.moduleNameChild !== '')
				return s.moduleNameMap[s.$route.params.moduleNameChild];
			
			return s.moduleNameMap[s.$route.params.moduleName];
		},
		
		// simple
		menuAvailable:(s) => typeof s.$route.meta.menu !== 'undefined',
		styles:       (s) => s.settings.compact ? '' : `max-width:${s.settings.pageLimit}px;`,
		
		// stores
		modules:        (s) => s.$store.getters['schema/modules'],
		moduleNameMap:  (s) => s.$store.getters['schema/moduleNameMap'],
		formIdMap:      (s) => s.$store.getters['schema/formIdMap'],
		collectionIdMap:(s) => s.$store.getters['schema/collectionIdMap'],
		builderEnabled: (s) => s.$store.getters.builderEnabled,
		busyCounter:    (s) => s.$store.getters.busyCounter,
		capErr:         (s) => s.$store.getters.captions.error,
		capGen:         (s) => s.$store.getters.captions.generic,
		feedback:       (s) => s.$store.getters.feedback,
		isAdmin:        (s) => s.$store.getters.isAdmin,
		isAtMenu:       (s) => s.$store.getters.isAtMenu,
		isMobile:       (s) => s.$store.getters.isMobile,
		isNoAuth:       (s) => s.$store.getters.isNoAuth,
		settings:       (s) => s.$store.getters.settings
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
		getCollectionColumn,
		getCollectionValues,
		getColumnTitle,
		srcBase64Icon,
		
		// display
		keysLockedMsg() {
			this.$store.commit('dialog',{
				captionBody:this.capErr.SEC['002'],
				image:'key_locked.png',
				buttons:[{
					cancel:true,
					caption:this.capGen.button.close,
					keyEscape:true,
					image:'cancel.png'
				}]
			});
		},
		windowResized() {
			if(this.sizeCheckTimedOut)
				return;
			
			if(!this.reducedHeader) {
				if(this.$refs.empty.offsetWidth < this.contentSizePxBuffer) {
					// empty space in header is too small, store currently required space for content, enable reduced header
					this.contentSizePx = this.$refs.content.offsetWidth;
					this.reducedHeader = true;
				}
			}
			else {
				// if empty space is large enough to show full content size, disable reduced header
				if(this.$refs.empty.offsetWidth > this.contentSizePxBuffer + this.contentSizePx - this.$refs.content.offsetWidth)
					this.reducedHeader = false;
			}
			
			// limit header size checks
			this.sizeCheckTimedOut = true;
			setTimeout(() => this.sizeCheckTimedOut = false,100);
		},
		
		// actions
		openFeedback() { this.$store.commit('isAtFeedback',true); },
		pagePrev() { window.history.back(); },
		pageNext() { window.history.forward(); }
	}
};