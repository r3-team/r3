export {MyAdminDocs as default};

let MyAdminDocs = {
	name:'my-admin-docs',
	template:`<div class="contentBox grow">
		<div class="top lower">
			<div class="area">
				<img class="icon" src="images/question.png" />
				<h1>{{ capApp.titleDocs }}</h1>
			</div>
			
			<div class="area">
				<my-button image="cancel.png"
					@trigger="$emit('close')"
					:cancel="true"
					:tight="true"
				/>
			</div>
		</div>
		
		<div class="content html-docs" v-html="docsFinal"></div>
	</div>`,
	emits:['close'],
	data() {
		return {
			docs:'',
			idPlaceholder:'admin-docs_'
		};
	},
	computed:{
		docsFinal:(s) => s.docs
			.replace(/href="#(.*?)"/g,'href="'+window.location+'#'+s.idPlaceholder+`$1`+'"')
			.replace(/id="(.*?)"/g,'id="'+s.idPlaceholder+`$1`+'"')
			.replace(/src="(.*?)"/g,'src="docs/'+`$1`+'"'),
		
		// stores
		capApp:  (s) => s.$store.getters.captions.admin,
		settings:(s) => s.$store.getters.settings
	},
	mounted() {
		this.get();
	},
	methods:{
		get() {
			let that = this;
			let req  = new XMLHttpRequest();
			
			let lang = this.settings.languageCode;
			if(lang !== 'en_us' && lang !== 'de_de')
				lang = 'en_us';
			
			let url = `/docs/${lang}_admin.html`;
			req.open('GET',url,true);
			req.send(null);
			req.onreadystatechange = function() {
				if(req.readyState === 4 && req.status === 200)
					that.docs = req.responseText;
			};
		}
	}
};