export default {
	name:'my-input-offset',
	template:`<div class="input-offset default-inputs">
		<!-- prev page -->
		<my-button image="pagePrev.png"
			v-if="arrows && limit < total"
			@trigger="pageChanged(false)"
			:active="offset !== 0"
			:naked="true"
		/>
		
		<!-- offset selector -->
		<select class="input-offset-selector"
			v-if="offsetSelectShow" 
			v-model="offsetSelect"
			:class="classInput"
			:title="captionText"
		>
			<option v-for="n in pages" :value="(n-1)*limit" :key="n">
				{{ displayOffset(n) }}
			</option>
		</select>
		
		<!-- optional caption -->
		<div v-if="caption" class="input-offset-caption">
			{{ captionText }}
		</div>
		
		<!-- next page -->
		<my-button image="pageNext.png"
			v-if="arrows && limit < total"
			@trigger="pageChanged(true)"
			:active="(offset + limit) < total"
			:naked="true"
		/>
	</div>`,
	props:{
		arrows:    { type:Boolean, required:false, default:true },
		caption:   { type:Boolean, required:false, default:false },
		classInput:{ type:String,  required:false, default: '' },
		limit:     { type:Number,  required:true },
		offset:    { type:Number,  required:true },
		total:     { type:Number,  required:true }
	},
	emits:['input'],
	computed:{
		captionText:(s) => s.offsetSelectShow
			? s.capGen.resultsOf.replace('{CNT}',s.total)
			: s.capGen.results.replace('{CNT}',s.total),
		offsetSelectShow:(s) => s.total > s.limit || s.offset !== 0,
		pageCurr:(s) => parseInt(Math.ceil((s.offset+1) / s.limit)),
		pageLast:(s) => parseInt(Math.ceil((s.total+1)  / s.limit)),
		pages:(s) => {
			if(s.total === 0 || s.limit === 0)
				return [];
			
			let pagesCount = 21;
			let pageStart  = s.pageCurr;
			let pageEnd    = s.pageCurr;

			// add/substract at most pagesCount from current page, resulting in start & end page numbers
			do {
				if(pageStart > 1) {
					pageStart--;
					pagesCount--;
				}
				if(pageEnd < s.pageLast) {
					pageEnd++;
					pagesCount--;
				}
			} while(pagesCount > 1 && (pageStart > 1 || pageEnd < s.pageLast));

			// generate page list for the selector
			let pages = [];
			for(let i = pageStart; i <= pageEnd; i++) {
				pages.push(i)
			}
			return pages;
		},
		
		// inputs
		offsetSelect:{
			get()  { return this.offset; },
			set(v) { this.$emit('input',v); }
		},
		
		// stores
		capGen:(s) => s.$store.getters.captions.generic
	},
	methods:{
		displayOffset(page) {
			return page === this.pageLast
				? ((page-1)*this.limit)+1 + ' - ' + this.total
				: ((page-1)*this.limit)+1 + ' - ' + (((page-1)*this.limit) + this.limit);
		},
		pageChanged(next) {
			if(next) this.$emit('input',this.offset + this.limit);
			else     this.$emit('input',this.offset - this.limit);
		}
	}
};
