export default {
	name:'my-builder-help',
	template:`<div class="contentBox grow">
		<div class="top lower">
			<div class="area">
				<img class="icon" src="images/question.png" />
				<h1>{{ capApp.pageTitleDocs }}</h1>
			</div>
			
			<div class="area">
				<my-button image="cancel.png"
					@trigger="$emit('close')"
					:cancel="true"
				/>
			</div>
		</div>
		
		<div class="content html-docs" v-html="helpFinal"></div>
	</div>`,
	emits:['close'],
	data() {
		return {
			help:'',
			idPlaceholder:'builder-help_'
		};
	},
	computed:{
		helpFinal:(s) => s.help
			.replace(/href="#(.*?)"/g,'href="'+window.location+'#'+s.idPlaceholder+`$1`+'"')
			.replace(/id="(.*?)"/g,'id="'+s.idPlaceholder+`$1`+'"')
			.replace(/src="(.*?)"/g,'src="help/'+`$1`+'"'),
		
		// stores
		capApp:(s) => s.$store.getters.captions.builder
	},
	mounted() {
		this.get();
	},
	methods:{
		get() {
			let req  = new XMLHttpRequest();
			let lang = 'en_us';
			
			let url = `/help/${lang}_builder.html`;
			req.open('GET',url,true);
			req.send(null);
			req.onreadystatechange = () => {
				if(req.readyState === 4 && req.status === 200)
					this.help = req.responseText;
			};
		}
	}
};