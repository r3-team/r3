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
			<option v-for="n in pageCount" :value="(n-1)*limit" :key="n">
				{{ displayOffset(n, pageCount) }}
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
		pageCount:(s) => {
			if(s.total === 0 || s.limit === 0)
				return 0;
			
			let maxShowPages = 21;
			let maxPages = parseInt(Math.ceil((s.total+1) / s.limit));
			let curentPage = parseInt(Math.ceil((s.offset+1) / s.limit));
			let firstPage = curentPage;
			let lastPage = curentPage;

			// add/substract at most maxShowPages from currentPage, resulting
			// in firstPage and lastPage to be used for the selector
			do {
				if(firstPage > 1) {
					firstPage--;
					maxShowPages--;
				}
				if(lastPage < maxPages) {
					lastPage++;
					maxShowPages--;
				}
			} while(maxShowPages > 1 && (firstPage > 1 || lastPage < maxPages));


			// generate page list for the selector
			let pages = [];
			for(let i = firstPage; i <= lastPage; i++)
			{
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
		displayOffset(page,pageCount) {
			if(page === pageCount)
				return ((page-1)*this.limit)+1 + ' - ' + this.total;
			
			return ((page-1)*this.limit)+1 + ' - ' + (((page-1)*this.limit) + this.limit);
		},
		pageChanged(next) {
			if(next) this.$emit('input',this.offset + this.limit);
			else     this.$emit('input',this.offset - this.limit);
		}
	}
};
