export {MyAdminHelp as default};

const MyAdminHelp = {
	name:'my-admin-help',
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
				/>
			</div>
		</div>
		
		<div class="content html-docs" v-html="helpFinal"></div>
	</div>`,
	emits:['close'],
	data() {
		return {
			help:'',
			idPlaceholder:'admin-help_'
		};
	},
	computed:{
		helpFinal:(s) => s.help
			.replace(/href="#(.*?)"/g,'href="'+window.location+'#'+s.idPlaceholder+`$1`+'"')
			.replace(/id="(.*?)"/g,'id="'+s.idPlaceholder+`$1`+'"')
			.replace(/src="(.*?)"/g,'src="help/'+`$1`+'"'),
		
		// stores
		capApp:  (s) => s.$store.getters.captions.admin,
		settings:(s) => s.$store.getters.settings
	},
	mounted() {
		this.get();
	},
	methods:{
		get() {
			let req  = new XMLHttpRequest();
			let lang = this.settings.languageCode;

			if(lang.startsWith('de')) lang = 'de_de';
			else                      lang = 'en_us';
			
			let url = `/help/${lang}_admin.html`;
			req.open('GET',url,true);
			req.send(null);
			req.onreadystatechange = () => {
				if(req.readyState === 4 && req.status === 200)
					this.help = req.responseText;
			};
		}
	}
};