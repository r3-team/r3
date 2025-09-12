import MyTabs              from './tabs.js';
import {generatePdf}       from './shared/pdf.js';
import {getDateFormat}     from './shared/time.js';
import {
	getCaption,
	getCaptionForLang
} from './shared/language.js';

export default {
	name:'my-articles',
	components:{ MyTabs },
	template:`<div class="contentBox" :class="{ large:showLarge || isMobile, 'float':isFloat }">
		<div class="top lower">
			<div class="area">
				<img class="icon" src="images/question.png" />
				<h1>{{ capApp.title }}</h1>
			</div>
			
			<div class="area">
				<my-button
					v-if="!isMobile"
					@trigger="showLarge = !showLarge"
					:image="showLarge ? 'shrink.png' : 'expand.png'"
				/>
				<my-button image="download.png"
					@trigger="pdfDownload"
					:caption="capApp.button.pdf"
				/>
				<my-button image="cancel.png"
					@trigger="$emit('close')"
					:cancel="true"
				/>
			</div>
		</div>
		
		<my-tabs
			v-if="hasFormHelp"
			v-model="tabTarget"
			:entries="['form','module']"
			:entriesText="[capApp.form,capApp.module]"
		/>
		
		<!-- articles -->
		<div class="articles" ref="articles">
			<!-- index -->
			<div class="articles-toc" v-if="hasArticleIndex">
				<h1>{{ capApp.toc }}</h1>
				<ol>
					<li v-for="a in articlesShown" @click="articleScrollTo(a.id)">{{ a.title }}</li>
				</ol>
			</div>
			
			<div class="article" v-for="(a,i) in articlesShown">
				<div class="article-title pdf-title" :ref="'article_'+a.id" v-if="hasArticleIndex || a.title !== ''">
					<my-button class="pdf-hide"
						@trigger="articleToggle(a.id)"
						:image="!articleIdsClosed.includes(a.id) ? 'triangleDown.png' : 'triangleRight.png'"
						:naked="true"
					/>
					<span>{{ (i+1) + '. ' + a.title }}</span>
				</div>
				<div class="article-body"
					v-if="!articleIdsClosed.includes(a.id)"
					v-html="a.body"
				/>
			</div>
		</div>
	</div>`,
	props:{
		form:         { type:Object,  required:false, default:null }, // show context help of which form
		isFloat:      { type:Boolean, required:true },
		languageForce:{ type:String,  required:false, default:''   }, // language to use (5-letter code)
		moduleId:     { type:String,  required:true }                 // show help of which module
	},
	emits:['close'],
	data() {
		return {
			articleIdsClosed:[],
			tabTarget:this.form !== null && this.form.articleIdsHelp.length !== 0 ? 'form' : 'module',
			showLarge:false
		};
	},
	computed:{
		articlesShown:(s) => {
			let articleIds = s.tabTarget === 'module'
				? s.module.articleIdsHelp : s.form.articleIdsHelp;
			
			let out = [];
			for(let articleId of articleIds) {
				const a    = s.articleIdMap[articleId];
				const body = s.languageForce === ''
					? s.getCaption('articleBody',a.moduleId,a.id,a.captions)
					: s.getCaptionForLang('articleBody',s.languageForce,a.id,a.captions);
				
				if(body === '') continue;
				
				const title = s.languageForce === ''
					? s.getCaption('articleTitle',a.moduleId,a.id,a.captions,'-')
					: s.getCaptionForLang('articleTitle',s.languageForce,a.id,a.captions,'-');
				
				out.push({ id:a.id, body:body, title:title });
			}
			return out;
		},
		
		// simple
		hasArticleIndex:(s) => s.articlesShown.length > 1,
		hasFormHelp:    (s) => s.form !== null && s.form.articleIdsHelp.length !== 0,
		
		// stores
		module:      (s) => s.moduleIdMap[s.moduleId],
		moduleIdMap: (s) => s.$store.getters['schema/moduleIdMap'],
		articleIdMap:(s) => s.$store.getters['schema/articleIdMap'],
		capApp:      (s) => s.$store.getters.captions.articles,
		isMobile:    (s) => s.$store.getters.isMobile
	},
	methods:{
		// externals
		generatePdf,
		getCaption,
		getCaptionForLang,
		getDateFormat,
		
		// actions
		articleToggle(id) {
			let pos = this.articleIdsClosed.indexOf(id);
			
			if(pos === -1) this.articleIdsClosed.push(id);
			else           this.articleIdsClosed.splice(pos,1);
		},
		articleScrollTo(id) {
			this.$refs['article_'+id][0].scrollIntoView();
		},
		pdfDownload() {
			const mod         = this.module;
			const titleDate   = this.getDateFormat(new Date(),'Y-m-d');
			const titleHelp   = this.tabTarget === 'form' ? this.capApp.form : this.capApp.module;
			const titleModule = this.languageForce === ''
				? `${this.getCaption('moduleTitle',mod.id,mod.id,mod.captions,mod.name)} v${mod.releaseBuild}`
				: `${this.getCaptionForLang('moduleTitle',this.languageForce,mod.id,mod.captions,mod.name)} v${mod.releaseBuild}`;
			
			this.generatePdf(
				`${titleModule} - ${titleHelp}.pdf`
				,'a4','p',60,90,`
					<div class="pdf-header">
						<span>${titleModule}</span>
						<span>${titleHelp}</span>
						<span>${titleDate}</span>
					</div>
				`,this.$refs['articles'].innerHTML,'',`
					code{
						font-family:inherit;
						font-weight:bold;
					}
					.pdf-title{
						font-size:120%;
						font-weight:bold;
					}
					.pdf-header{
						display:flex;
						flex-flow:row nowrap;
						justify-content:space-between;
					}
					.pdf-header span{
						font-style:italic;
						font-size:90%;
					}
					.pdf-hide{
						display:none;
					}
				`
			);
		}
	}
};