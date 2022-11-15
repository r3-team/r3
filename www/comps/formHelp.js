import MyInputRichtext    from './inputRichtext.js';
import {getModuleCaption} from './shared/generic.js';
import {generatePdf}      from './shared/pdf.js';
import {getDateFormat}    from './shared/time.js';
export {MyFormHelp as default};

let MyFormHelp = {
	name:'my-form-help',
	components:{MyInputRichtext},
	template:`<div class="form-help contentBox" :class="{ 'pop-up':isPopUp }">
		<div class="top lower">
			<div class="area">
				<img class="icon" src="images/question.png" />
				<h1>{{ capApp.help }}</h1>
			</div>
			
			<div class="area">
				<my-button image="download.png"
					@trigger="pdfDownload"
					:caption="capApp.button.helpPdf"
				/>
				<my-button image="cancel.png"
					@trigger="$emit('close')"
					:cancel="true"
					:tight="true"
				/>
			</div>
		</div>
		
		<div class="articles-tabs" v-if="form.articleIdsHelp.length !== 0">
			<div class="entry" tabindex="0"
				v-for="t in tabs"
				@click="showFrom = t"
				@key.enter="showFrom = t"
				:class="{ active:t === showFrom }"
			>{{ t === 'form' ? capApp.helpForm : capApp.helpModule }}
			</div>
		</div>
		
		<!-- articles -->
		<div class="articles" ref="articles">
			<!-- index -->
			<div class="articles-toc" v-if="hasArticleIndex">
				<h1>{{ capApp.tableOfContents }}</h1>
				<ol>
					<li v-for="a in articlesShown" @click="articleScrollTo(a.id)">
						{{ getArticleTitle(a) }}
					</li>
				</ol>
			</div>
		
			<div class="article" v-for="(a,i) in articlesShown">
				<div class="article-title pdf-title" :ref="'article_'+a.id" v-if="hasArticleIndex || getArticleTitle(a) !== articleTitleEmpty">
					<my-button class="pdf-hide"
						@trigger="articleToggle(a.id)"
						:image="!articleIdsClosed.includes(a.id) ? 'triangleDown.png' : 'triangleRight.png'"
						:naked="true"
						:tight="true"
					/>
					<span>{{ (i+1) + '. ' + getArticleTitle(a) }}</span>
				</div>
				<div class="article-body"
					v-if="!articleIdsClosed.includes(a.id)"
					v-html="a.captions.articleBody[moduleLanguage]"
				/>
			</div>
		</div>
	</div>`,
	props:{
		form:    { type:Object,  required:true },
		isPopUp: { type:Boolean, required:true },
		moduleId:{ type:String,  required:true }
	},
	emits:['close'],
	data:function() {
		return {
			articleIdsClosed:[],
			articleTitleEmpty:'-',
			showFrom:this.form.articleIdsHelp.length !== 0 ? 'form' : 'module',
			tabs:['form','module']
		};
	},
	computed:{
		articlesShown:(s) => {
			let articleIds = s.showFrom === 'module'
				? s.module.articleIdsHelp : s.form.articleIdsHelp;
			
			let out = [];
			for(let articleId of articleIds) {
				let a = s.articleIdMap[articleId];
				if(typeof a.captions.articleBody[s.moduleLanguage] !== 'undefined')
					out.push(a);
			}
			return out;
		},
		hasArticleIndex:(s) => s.articlesShown.length > 1,
		
		// stores
		module:        (s) => s.moduleIdMap[s.moduleId],
		moduleIdMap:   (s) => s.$store.getters['schema/moduleIdMap'],
		articleIdMap:  (s) => s.$store.getters['schema/articleIdMap'],
		capApp:        (s) => s.$store.getters.captions.form,
		moduleLanguage:(s) => s.$store.getters.moduleLanguage
	},
	methods:{
		// externals
		generatePdf,
		getDateFormat,
		getModuleCaption,
		
		// presentation
		getArticleTitle(article) {
			return typeof article.captions.articleTitle[this.moduleLanguage] !== 'undefined'
				? article.captions.articleTitle[this.moduleLanguage] : this.articleTitleEmpty;
		},
		
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
			let titleHelp   = this.showFrom === 'form' ? this.capApp.helpForm : this.capApp.helpModule;
			let titleModule = this.getModuleCaption(this.module,this.moduleLanguage);
			let titleDate   = this.getDateFormat(new Date(),'Y-m-d');
			
			this.generatePdf(
				`${titleModule}_${titleHelp}_${titleDate}.pdf`
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