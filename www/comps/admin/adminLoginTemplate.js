export {MyAdminLoginTemplate as default};

let MyAdminLoginTemplate = {
	name:'my-admin-login-template',
	template:`<div class="app-sub-window under-header at-top with-margin" @mousedown.self="$emit('close')">
		
		<div class="contentBox admin-login-template popUp" v-if="inputsReady">
			<div class="top">
				<div class="area nowrap">
					<img class="icon" src="images/personTemplate.png" />
					<h1 class="title">{{ isNew ? capApp.titleNew : capApp.title.replace('{NAME}',name) }}</h1>
				</div>
				<div class="area">
					<my-button image="cancel.png"
						@trigger="$emit('close')"
						:cancel="true"
					/>
				</div>
			</div>
			<div class="top lower">
				<div class="area">
					<my-button image="save.png"
						@trigger="set"
						:active="canSave"
						:caption="isNew ? capGen.button.create : capGen.button.save"
					/>
					<my-button image="refresh.png"
						v-if="!isNew"
						@trigger="get"
						:active="hasChanges"
						:caption="capGen.button.refresh"
					/>
					<my-button image="add.png"
						v-if="!isNew && !isGlobal"
						@trigger="id = 0"
						:caption="capGen.button.new"
					/>
					<my-button image="delete.png"
						v-if="!isNew && !isGlobal"
						@trigger="delAsk"
						:cancel="true"
						:caption="capGen.button.delete"
					/>
				</div>
			</div>
			
			<div class="content default-inputs">
				<table class="table-default generic-table-vertical fullWidth">
					<tr>
						<td>{{ capGen.name }}*</td>
						<td><input v-model="name" v-focus :disabled="isGlobal" /></td>
					</tr>
					<tr v-if="isGlobal">
						<td colspan="2">{{ capApp.global }}</td>
					</tr>
					<tr v-if="!isGlobal">
						<td>{{ capGen.comments }}</td>
						<td><textarea v-model="comment" /></td>
					</tr>
					
					<!-- general settings -->
					<tr>
						<td class="grouping" colspan="2">
							<br />
							<div class="contentPartHeader">
								<img class="icon" src="images/settings.png" />
								<h1>{{ capAppSet.titleGeneral }}</h1>
							</div>
						</td>
					</tr>
					<tr>
						<td>{{ capAppSet.headerCaptions }}</td>
						<td><my-bool v-model="settings.headerCaptions" /></td>
					</tr>
					<tr>
						<td>{{ capAppSet.languageCode }}</td>
						<td>
							<select v-model="settings.languageCode">
								<option v-for="l in languageCodes" :value="l">{{ l }}</option>
							</select>
						</td>
					</tr>
					<tr>
						<td>{{ capAppSet.dateFormat }}</td>
						<td>
							<select v-model="settings.dateFormat">
								<option value="Y-m-d">{{ capAppSet.dateFormat0 }}</option>
								<option value="Y/m/d">{{ capAppSet.dateFormat1 }}</option>
								<option value="d.m.Y">{{ capAppSet.dateFormat2 }}</option>
								<option value="d/m/Y">{{ capAppSet.dateFormat3 }}</option>
								<option value="m/d/Y">{{ capAppSet.dateFormat4 }}</option>
							</select>
						</td>
					</tr>
					<tr>
						<td>{{ capAppSet.sundayFirstDow }}</td>
						<td><my-bool v-model="settings.sundayFirstDow" /></td>
					</tr>
					<tr>
						<td>{{ capAppSet.tabRemember }}</td>
						<td><my-bool v-model="settings.tabRemember" /></td>
					</tr>
					<tr>
						<td>{{ capAppSet.warnUnsaved }}</td>
						<td><my-bool v-model="settings.warnUnsaved" /></td>
					</tr>
					<tr>
						<td>{{ capAppSet.mobileScrollForm }}</td>
						<td><my-bool v-model="settings.mobileScrollForm" /></td>
					</tr>
					<tr>
						<td>{{ capAppSet.searchDictionaries }}</td>
						<td>
							<div class="column gap">
								<select v-model="searchDictionaryNew" @change="dictAdd($event.target.value)">
									<option value="">{{ capAppSet.searchDictionaryNew }}</option>
									<option v-for="d in searchDictionaries.filter(v => !settings.searchDictionaries.includes(v) && v !== 'simple')">
										{{ d }}
									</option>
								</select>
								<div class="row wrap gap">
									<div v-for="d in settings.searchDictionaries" class="row centered gap">
										<span>{{ d }}</span>
										<my-button image="delete.png" @trigger="dictDel(d)" :cancel="true" />
									</div>
								</div>
							</div>
						</td>
					</tr>
					
					<!-- theming -->
					<tr>
						<td class="grouping" colspan="2">
							<br />
							<div class="contentPartHeader">
								<img class="icon" src="images/visible1.png" />
								<h1>{{ capAppSet.titleTheme }}</h1>
							</div>
						</td>
					</tr>
					<tr>
						<td>{{ capAppSet.bordersAll }}</td>
						<td><my-bool v-model="settings.bordersAll" /></td>
					</tr>
					<tr>
						<td>{{ capAppSet.bordersSquared }}</td>
						<td><my-bool v-model="settings.bordersSquared" /></td>
					</tr>
					<tr>
						<td>{{ capAppSet.fontFamily }}</td>
						<td>
							<select v-model="settings.fontFamily">
								<optgroup label="sans-serif">
									<option value="calibri">Calibri</option>
									<option value="helvetica">Helvetica</option>
									<option value="segoe_ui">Segoe UI</option>
									<option value="trebuchet_ms">Trebuchet MS</option>
									<option value="verdana">Verdana</option>
								</optgroup>
								<optgroup label="serif">
									<option value="georgia">Georgia</option>
									<option value="times_new_roman">Times New Roman</option>
								</optgroup>
								<optgroup label="cursive">
									<option value="comic_sans_ms">Comic Sans</option>
									<option value="segoe_script">Segoe Script</option>
								</optgroup>
								<optgroup label="monospace">
									<option value="consolas">Consolas</option>
									<option value="lucida_console">Lucida Console</option>
								</optgroup>
							</select>
						</td>
					</tr>
					<tr>
						<td>{{ capAppSet.fontSize }}</td>
						<td>
							<select v-model="settings.fontSize">
								<option v-for="i in 11"
									:value="70 + (i*5)"
								>{{ (70 + (i*5)) + '%' }}</option>
							</select>
						</td>
					</tr>
					<tr>
						<td>{{ capAppSet.spacing }}</td>
						<td>
							<select v-model.number="settings.spacing">
								<option :value="1">{{ capGen.option.size0 }}</option>
								<option :value="2">{{ capGen.option.size1 }}</option>
								<option :value="3">{{ capGen.option.size2 }}</option>
								<option :value="4">{{ capGen.option.size3 }}</option>
								<option :value="5">{{ capGen.option.size4 }}</option>
							</select>
						</td>
					</tr>
					<tr>
						<td>{{ capAppSet.pattern }}</td>
						<td>
							<select v-model="settings.pattern">
								<option :value="null">-</option>
								<option value="bubbles">Bubbles</option>
								<option value="waves">Waves</option>
							</select>
						</td>
					</tr>
					<tr>
						<td>{{ capAppSet.dark }}</td>
						<td><my-bool v-model="settings.dark" /></td>
					</tr>
				</table>
			</div>
		</div>
	</div>`,
	props:{
		templateId:{ type:Number, required:true }
	},
	emits:['close'],
	data() {
		return {
			// inputs
			id:0,
			name:'',
			comment:'',
			searchDictionaryNew:'',
			settings:{},
			
			// states
			inputKeys:['name','comment','settings'],
			inputsOrg:{},     // map of original input values, key = input key
			inputsReady:false // inputs have been loaded
		};
	},
	computed:{
		hasChanges:(s) => {
			if(!s.inputsReady)
				return false;
			
			for(let k of s.inputKeys) {
				if(JSON.stringify(s.inputsOrg[k]) !== JSON.stringify(s[k]))
					return true;
			}
			return false;
		},
		
		// simple states
		canSave: (s) => s.hasChanges && s.name !== '',
		isGlobal:(s) => s.name === 'GLOBAL',
		isNew:   (s) => s.id     === 0,
		
		// stores
		languageCodes:     (s) => s.$store.getters['schema/languageCodes'],
		searchDictionaries:(s) => s.$store.getters['searchDictionaries'],
		capApp:            (s) => s.$store.getters.captions.admin.loginTemplate,
		capAppSet:         (s) => s.$store.getters.captions.settings,
		capGen:            (s) => s.$store.getters.captions.generic
	},
	mounted() {
		window.addEventListener('keydown',this.handleHotkeys);
		this.id = this.templateId;
		
		if(this.id !== 0)
			return this.get();
		
		// new template, apply defaults
		this.settings = {
			bordersAll:false,
			bordersSquared:false,
			colorHeader:null,
			colorHeaderSingle:false,
			colorMenu:null,
			dark:false,
			dateFormat:'Y-m-d',
			fontFamily:'helvetica',
			fontSize:100,
			headerModules:true,
			headerCaptions:true,
			hintUpdateVersion:0,
			languageCode:'en_us',
			mobileScrollForm:true,
			pattern:'bubbles',
			searchDictionaries:['english'],
			spacing:3,
			sundayFirstDow:true,
			tabRemember:true,
			warnUnsaved:true
		};
		this.inputsLoaded();
	},
	unmounted() {
		window.removeEventListener('keydown',this.handleHotkeys);
	},
	methods:{
		handleHotkeys(e) {
			if(e.ctrlKey && e.key === 's') {
				if(this.canSave)
					this.set();
				
				e.preventDefault();
			}
			if(e.key === 'Escape') {
				this.$emit('close');
				e.preventDefault();
			}
		},
		inputsLoaded() {
			for(let k of this.inputKeys) {
				this.inputsOrg[k] = JSON.parse(JSON.stringify(this[k]));
			}
			this.inputsReady = true;
		},
		
		// actions
		dictAdd(entry) {
			this.settings.searchDictionaries.push(entry);
			this.searchDictionaryNew = '';
		},
		dictDel(entry) {
			let pos = this.settings.searchDictionaries.indexOf(entry);
			if(pos !== -1)
				this.settings.searchDictionaries.splice(pos,1);
		},
		
		// backend calls
		delAsk() {
			this.$store.commit('dialog',{
				captionBody:this.capApp.dialog.delete,
				buttons:[{
					cancel:true,
					caption:this.capGen.button.delete,
					exec:this.del,
					image:'delete.png'
				},{
					caption:this.capGen.button.cancel,
					image:'cancel.png'
				}]
			});
		},
		del() {
			ws.send('loginTemplate','del',{id:this.id},true).then(
				() => this.$emit('close'), this.$root.genericError
			);
		},
		get() {
			ws.send('loginTemplate','get',{byId:this.id},true).then(
				res => {
					if(res.payload.length !== 1) return;
					
					let template = res.payload[0];
					this.name     = template.name;
					this.comment  = template.comment;
					this.settings = template.settings;
					this.inputsLoaded();
				},
				this.$root.genericError
			);
		},
		set() {
			ws.send('loginTemplate','set',{
				id:this.id,
				name:this.name,
				comment:this.comment === '' ? null : this.comment,
				settings:this.settings
			},true).then(
				res => {
					if(this.isNew)
						this.id = res.payload;
					
					this.get();
				},
				this.$root.genericError
			);
		}
	}
};