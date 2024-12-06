import {dialogCloseAsk} from '../shared/dialog.js';
import MyInputColor     from '../inputColor.js';
export {MyAdminLoginTemplate as default};

let MyAdminLoginTemplate = {
	name:'my-admin-login-template',
	components:{ MyInputColor },
	template:`<div class="app-sub-window under-header at-top with-margin" @mousedown.self="closeAsk">
		
		<div class="contentBox admin-login-template float" v-if="inputsReady">
			<div class="top">
				<div class="area nowrap">
					<img class="icon" src="images/personTemplate.png" />
					<h1 class="title">{{ isNew ? capApp.titleNew : capApp.title.replace('{NAME}',name) }}</h1>
				</div>
				<div class="area">
					<my-button image="cancel.png"
						@trigger="closeAsk"
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
				<table class="generic-table-vertical fullWidth">
					<tbody>
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
									<option value="Y-m-d">{{ capGen.dateFormat0 }}</option>
									<option value="Y/m/d">{{ capGen.dateFormat1 }}</option>
									<option value="d.m.Y">{{ capGen.dateFormat2 }}</option>
									<option value="d/m/Y">{{ capGen.dateFormat3 }}</option>
									<option value="m/d/Y">{{ capGen.dateFormat4 }}</option>
								</select>
							</td>
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
						<tr>
							<td colspan="2"><b>{{ capAppSet.titleSubNumbers }}</b></td>
						</tr>
						<tr class="default-inputs">
							<td>{{ capAppSet.numberSepThousand }}</td>
							<td>
								<select v-model="settings.numberSepThousand">
									<option value=".">{{ capAppSet.option.numberSeparator.dot }}</option>
									<option value=",">{{ capAppSet.option.numberSeparator.comma }}</option>
									<option value="'">{{ capAppSet.option.numberSeparator.apos }}</option>
									<option value="·">{{ capAppSet.option.numberSeparator.mdot }}</option>
								</select>
							</td>
						</tr>
						<tr class="default-inputs">
							<td>{{ capAppSet.numberSepDecimal }}</td>
							<td>
								<select v-model="settings.numberSepDecimal">
									<option value=".">{{ capAppSet.option.numberSeparator.dot }}</option>
									<option value=",">{{ capAppSet.option.numberSeparator.comma }}</option>
									<option value="'">{{ capAppSet.option.numberSeparator.apos }}</option>
									<option value="·">{{ capAppSet.option.numberSeparator.mdot }}</option>
								</select>
							</td>
						</tr>
						<tr>
							<td colspan="2"><b>{{ capAppSet.titleSubMisc }}</b></td>
						</tr>
						<tr><td colspan="2"><my-button-check v-model="settings.sundayFirstDow"   :caption="capAppSet.sundayFirstDow"   /></td></tr>
						<tr><td colspan="2"><my-button-check v-model="settings.tabRemember"      :caption="capAppSet.tabRemember"      /></td></tr>
						<tr><td colspan="2"><my-button-check v-model="settings.warnUnsaved"      :caption="capAppSet.warnUnsaved"      /></td></tr>
						<tr><td colspan="2"><my-button-check v-model="settings.mobileScrollForm" :caption="capAppSet.mobileScrollForm" /></td></tr>
						<tr><td colspan="2"><my-button-check v-model="settings.boolAsIcon"       :caption="capAppSet.boolAsIcon"       /></td></tr>
						
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
							<td>{{ capAppSet.borders }}</td>
							<td>
								<div class="row gap">
									<my-button-check v-model="settings.bordersAll"     :caption="capGen.more" />
									<my-button-check v-model="settings.bordersSquared" :caption="capAppSet.bordersSquared" />
								</div>
							</td>
						</tr>
						<tr>
							<td>{{ capAppSet.fontFamily }}</td>
							<td>
								<div class="row gap">
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
										
									<select class="short" v-model="settings.fontSize" :title="capAppSet.fontSize">
										<option v-for="i in 11"
											:value="70 + (i*5)"
										>{{ (70 + (i*5)) + '%' }}</option>
									</select>
								</div>
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
							<td>{{ capAppSet.listRows }}</td>
							<td>
								<div class="row gap">
									<my-button-check v-model="settings.listSpaced"  :caption="capAppSet.listSpaced" />
									<my-button-check v-model="settings.listColored" :caption="capAppSet.listColored" />
								</div>
							</td>
						</tr>
						<tr>
							<td>{{ capAppSet.pattern }}</td>
							<td>
								<select v-model="settings.pattern">
									<option :value="null">-</option>
									<option value="bubbles">Bubbles</option>
									<option value="circuits">Circuits</option>
									<option value="cubes">Cubes</option>
									<option value="triangles">Triangles</option>
									<option value="waves">Waves</option>
								</select>
							</td>
						</tr>
						<tr>
							<td>{{ capAppSet.dark }}</td>
							<td><div class="row"><my-bool v-model="settings.dark" :grow="false" /></div></td>
						</tr>
						<tr>
							<td colspan="2"><b>{{ capAppSet.titleSubHeader }}</b></td>
						</tr>
						<tr>
							<td>{{ capGen.applications }}</td>
							<td>
								<div class="row gap">
									<my-button-check v-model="settings.headerModules" :caption="capGen.button.show" />
									<my-button-check
										v-model="settings.headerCaptions"
										:caption="capAppSet.headerCaptions"
										:readonly="!settings.headerModules"
									/>
								</div>
							</td>
						</tr>
						<tr class="default-inputs">
							<td>{{ capAppSet.colorClassicMode }}</td>
							<td>
								<select
									@input="settings.colorClassicMode = $event.target.value === '1'"
									:value="settings.colorClassicMode ? '1' : '0'"
								>
									<option value="0">{{ capAppSet.colorClassicMode0 }}</option>
									<option value="1">{{ capAppSet.colorClassicMode1 }}</option>
								</select>
							</td>
						</tr>
						<tr v-if="!settings.colorClassicMode">
							<td>{{ capAppSet.colorHeader }}</td>
							<td><my-input-color v-model="settings.colorHeader" :allowNull="true" /></td>
						</tr>
						<tr v-if="!settings.colorClassicMode">
							<td>{{ capAppSet.colorHeaderSingle }}</td>
							<td><div class="row"><my-bool v-model="settings.colorHeaderSingle" :grow="false" :reversed="true" /></div></td>
						</tr>
						<tr>
							<td colspan="2"><b>{{ capAppSet.titleSubMenu }}</b></td>
						</tr>
						<tr>
							<td>{{ capAppSet.colorMenu }}</td>
							<td><my-input-color v-model="settings.colorMenu" :allowNull="true" /></td>
						</tr>
					</tbody>
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
		languageCodes:     (s) => s.$store.getters['schema/languageCodesModules'],
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
			boolAsIcon:true,
			bordersAll:false,
			bordersSquared:false,
			colorClassicMode:false,
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
			listColored:false,
			listSpaced:true,
			mobileScrollForm:true,
			numberSepDecimal:'.',
			numberSepThousand:',',
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
		// externals
		dialogCloseAsk,

		handleHotkeys(e) {
			if(e.ctrlKey && e.key === 's') {
				if(this.canSave)
					this.set();
				
				e.preventDefault();
			}
			if(e.key === 'Escape') {
				this.closeAsk();
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
		closeAsk() {
			this.dialogCloseAsk(this.close,this.hasChanges);
		},
		close() {
			this.$emit('close');
		},
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
					image:'delete.png',
					keyEnter:true
				},{
					caption:this.capGen.button.cancel,
					image:'cancel.png',
					keyEscape:true
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