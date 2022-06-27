import srcBase64Icon    from './shared/image.js';
import {getColumnTitle} from './shared/column.js';
import {getFormRoute}   from './shared/form.js';
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
					<div class="entry no-wrap clickable" tabindex="0"
						v-if="busyCounter > 0"
						@click="cancelRequest"
						@keyup.enter="cancelRequest"
						:title="capGen.busy"
					>
						<img src="images/load.gif" />
					</div>
				</transition>
				
				<!-- collection entries -->
				<div class="entry no-wrap clickable" tabindex="0"
					v-for="e in collectionEntries"
					@click="openForm(e.formIdOpen)"
					@keyup.enter="openForm(e.formIdOpen)"
					:title="e.title"
				>
					<img v-if="e.iconId !== null" :src="srcBase64Icon(e.iconId,'')" />
					<span>{{ e.value }}</span>
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
	emits:['logout'],
	data:function() {
		return {
			contentSizePx:0,        // width in pixel required by all application entries
			contentSizePxBuffer:50, // keep this space free (currently only for busy indicator)
			reducedHeader:false,    // reduce sizes for application entries if space is limited
			sizeCheckTimedOut:false // time-out for checking header size
		};
	},
	computed:{
		collectionEntries:function() {
			let out = [];
			for(let k in this.collectionIdMap) {
				for(let i = 0, j = this.collectionIdMap[k].inHeader.length; i < j; i++) {
					let collection = this.collectionIdMap[k];
					let consumer   = collection.inHeader[i];
					
					if(!consumer.onMobile && this.isMobile)
						continue;
					
					let value = this.getCollectionValues(
						collection.id,
						consumer.columnIdDisplay,
						true
					);
					if(consumer.noDisplayEmpty && (value === null || value === 0 || value === ''))
						continue;
					
					out.push({
						formIdOpen:consumer.formIdOpen,
						iconId:collection.iconId,
						title:this.getColumnTitle(this.getCollectionColumn(
							collection.id,
							consumer.columnIdDisplay
						)),
						value:value
					});
				}
			}
			return out;
		},
		menuAvailable:function() {
			return typeof this.$route.meta.menu !== 'undefined';
		},
		moduleActive:function() {
			if(this.$route.params.moduleName === '')
				return false;
			
			if(this.$route.params.moduleNameChild !== '')
				return this.moduleNameMap[this.$route.params.moduleNameChild];
			
			return this.moduleNameMap[this.$route.params.moduleName];
		},
		styles:function() {
			if(this.settings.compact)
				return '';
			
			return `max-width:${this.settings.pageLimit}px;`;
		},
		
		// stores
		modules:        function() { return this.$store.getters['schema/modules']; },
		moduleNameMap:  function() { return this.$store.getters['schema/moduleNameMap']; },
		collectionIdMap:function() { return this.$store.getters['schema/collectionIdMap']; },
		builderEnabled: function() { return this.$store.getters.builderEnabled; },
		busyCounter:    function() { return this.$store.getters.busyCounter; },
		capErr:         function() { return this.$store.getters.captions.error; },
		capGen:         function() { return this.$store.getters.captions.generic; },
		feedback:       function() { return this.$store.getters.feedback; },
		isAdmin:        function() { return this.$store.getters.isAdmin; },
		isAtMenu:       function() { return this.$store.getters.isAtMenu; },
		isMobile:       function() { return this.$store.getters.isMobile; },
		isNoAuth:       function() { return this.$store.getters.isNoAuth; },
		settings:       function() { return this.$store.getters.settings; }
	},
	created:function() {
		window.addEventListener('resize',this.windowResized);
	},
	mounted:function() {
		this.windowResized();
	},
	unmounted:function() {
		window.removeEventListener('resize',this.windowResized);
	},
	methods:{
		// externals
		getCollectionColumn,
		getCollectionValues,
		getColumnTitle,
		getFormRoute,
		srcBase64Icon,
		
		// display
		keysLockedMsg:function() {
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
		windowResized:function() {
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
		cancelRequest:function() { this.$root.wsCancel(); },
		openFeedback: function() { this.$store.commit('isAtFeedback',true); },
		pagePrev:     function() { window.history.back(); },
		pageNext:     function() { window.history.forward(); },
		openForm:function(formId) {
			if(formId !== null)
				this.$router.push(this.getFormRoute(formId,0,false));
		}
	}
};