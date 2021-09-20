import srcBase64Icon from './shared/image.js';
export {MyHeader as default};

let MyHeader = {
	name:'my-header',
	template:`<div class="app-header shade noPrint">
		
		<div class="app-header-bg" :style="bgStyle" />
		
		<div class="app-header-content" :style="styles">
			<div class="entries">
				
				<template v-if="!isMobile && isAdmin" >
					
					<router-link class="entry no-wrap clickable" to="/builder"
						v-if="builderEnabled && !productionMode"
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
						<span v-if="settings.headerCaptions">{{ me.caption }}</span>
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
			
			<div class="entries">
				
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
		moduleEntries:{ type:Array, required:true }
	},
	emits:['logout'],
	computed:{
		bgStyle:function() {
			// custom color before specific module color
			if(this.customBgHeader !== '')
				return this.customBgHeader;
			
			if(this.moduleColor1 !== '')
				return `background-color:#${this.moduleColor1};`;
			
			return '';
		},
		styles:function() {
			if(this.settings.compact)
				return '';
			
			return `max-width:${this.settings.pageLimit}px;`;
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
		
		// stores
		customBgHeader:function() { return this.$store.getters['local/customBgHeader']; },
		modules:       function() { return this.$store.getters['schema/modules']; },
		moduleNameMap: function() { return this.$store.getters['schema/moduleNameMap']; },
		builderEnabled:function() { return this.$store.getters.builderEnabled; },
		busyCounter:   function() { return this.$store.getters.busyCounter; },
		capGen:        function() { return this.$store.getters.captions.generic; },
		feedback:      function() { return this.$store.getters.feedback; },
		isAdmin:       function() { return this.$store.getters.isAdmin; },
		isAtMenu:      function() { return this.$store.getters.isAtMenu; },
		isMobile:      function() { return this.$store.getters.isMobile; },
		isNoAuth:      function() { return this.$store.getters.isNoAuth; },
		moduleColor1:  function() { return this.$store.getters.moduleColor1; },
		productionMode:function() { return this.$store.getters.productionMode; },
		settings:      function() { return this.$store.getters.settings; }
	},
	methods:{
		// externals
		srcBase64Icon,
		
		cancelRequest:function() { this.$root.wsCancel(); },
		openFeedback: function() { this.$store.commit('isAtFeedback',true); },
		pagePrev:     function() { window.history.back(); },
		pageNext:     function() { window.history.forward(); }
	}
};