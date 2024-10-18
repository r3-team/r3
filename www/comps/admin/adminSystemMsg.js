import MyInputDate     from '../inputDate.js';
import MyInputRichtext from '../inputRichtext.js';
import {getDateFormat} from '../shared/time.js';
export {MyAdminSystemMsg as default};

let MyAdminSystemMsg = {
	name:'my-admin-system-msg',
	components:{
		MyInputDate,
		MyInputRichtext
	},
	template:`<div class="admin-system-msg contentBox grow">
		<div class="top">
			<div class="area">
				<img class="icon" src="images/warning.png" />
				<h1>{{ menuTitle }}</h1>
			</div>
		</div>
		<div class="top lower">
			<div class="area">
				<my-button image="save.png"
					@trigger="set"
					:active="hasChanges"
					:caption="capGen.button.save"
				/>
				<my-button image="refresh.png"
					@trigger="reset"
					:caption="capGen.button.refresh"
				/>
				<my-button image="visible1.png"
					@trigger="preview"
					:caption="capGen.preview"
				/>
			</div>
		</div>
		
		<div class="content grow">
			<table class="generic-table-vertical default-inputs admin-system-msg-table">
				<tbody>
					<tr>
						<td>{{ capGen.status }}</td>
						<td colspan="2"><span v-html="msgState"></span></td>
					</tr>
					<tr>
						<td>{{ capApp.text }}</td>
						<td colspan="2" class="no-padding">
							<div class="admin-system-msg-text">
								<my-input-richtext
									v-model="text"
									@hotkey="handleHotkeys($event)"
									:readonly="!activated"
								/>
							</div>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.date0 }}</td>
						<td colspan="2">
							<my-input-date class="admin-system-msg-date"
								@set-unix-from="date0 = $event"
								:isDate="true"
								:isReadonly="!activated"
								:isTime="true"
								:isValid="true"
								:unixFrom="date0"
								:useMonth="true"
							/>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.date1 }}</td>
						<td colspan="2">
							<my-input-date class="admin-system-msg-date"
								@set-unix-from="date1 = $event"
								:isDate="true"
								:isReadonly="!activated"
								:isTime="true"
								:isValid="true"
								:unixFrom="date1"
								:useMonth="true"
							/>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.maintenance }}</td>
						<td><my-bool v-model="maintenance" :readonly="date1 === null || !activated" /></td>
						<td>{{ capApp.maintenanceHint }}</td>
					</tr>
					<tr>
						<td>{{ capGen.information }}</td>
						<td colspan="2"><span v-html="capApp.description"></span></td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>`,
	props:{
		menuTitle:{ type:String, required:true }
	},
	computed:{
		hasChanges:(s) => 
			s.date0       !== s.parseFromIntConfig(s.config.systemMsgDate0) ||
			s.date1       !== s.parseFromIntConfig(s.config.systemMsgDate1) ||
			s.maintenance !== s.systemMsgMaint ||
			s.text        !== s.systemMsgText,
		msgState:(s) => {
			if(s.date0 === null && s.date1 === null)
				return s.capApp.state.unset;

			if(s.date0 === null)
				return s.capApp.state.date1Set.replace('{DATE}',s.getDateFormat(new Date(s.date1*1000),'Y-m-d H:i'));

			if(s.date1 === null)
				return s.capApp.state.date0Set.replace('{DATE}',s.getDateFormat(new Date(s.date0*1000),'Y-m-d H:i'));

			return s.capApp.state.datesSet
				.replace('{DATE0}',s.getDateFormat(new Date(s.date0*1000),'Y-m-d H:i'))
				.replace('{DATE1}',s.getDateFormat(new Date(s.date1*1000),'Y-m-d H:i'));
		},

		// stores
		activated:     (s) => s.$store.getters['local/activated'],
		capApp:        (s) => s.$store.getters.captions.admin.systemMsg,
		capGen:        (s) => s.$store.getters.captions.generic,
		config:        (s) => s.$store.getters.config,
		systemMsgMaint:(s) => s.$store.getters.config.systemMsgMaintenance === '1',
		systemMsgText: (s) => s.$store.getters.config.systemMsgText
	},
	data() {
		return {
			// inputs
			date0:0,
			date1:0,
			maintenance:false,
			text:''
		};
	},
	mounted() {
		this.reset();
		this.$store.commit('pageTitle',this.menuTitle);
		this.$store.commit('keyDownHandlerAdd',{fnc:this.set,key:'s',keyCtrl:true});
	},
	unmounted() {
		this.$store.commit('keyDownHandlerDel',this.set);
	},
	methods:{
		// externals
		getDateFormat,

		// actions
		handleHotkeys(e) {
			if(e.ctrlKey && e.key === 's') {
				e.preventDefault();
				this.set();
			}
		},
		preview() {
			this.$store.commit('dialog',{
				captionTop:this.capGen.dialog.systemMsg,
				captionBody:this.text,
				image:'warning.png'
			});
		},
		reset() {
			this.date0       = this.parseFromIntConfig(this.config.systemMsgDate0);
			this.date1       = this.parseFromIntConfig(this.config.systemMsgDate1);
			this.maintenance = this.systemMsgMaint;
			this.text        = this.systemMsgText;
		},
		
		// backend calls
		set() {
			if(!this.hasChanges) return;

			const config = JSON.parse(JSON.stringify(this.config));
			config.systemMsgDate0       = this.parseToIntConfig(this.date0);
			config.systemMsgDate1       = this.parseToIntConfig(this.date1);
			config.systemMsgMaintenance = this.maintenance ? '1' : '0';
			config.systemMsgText        = this.text;
			
			ws.send('config','set',config,true).then(
				() => {}, this.$root.genericError
			);
		},

		// helpers
		parseFromIntConfig(v) {
			return v === '0' ? null : parseInt(v);
		},
		parseToIntConfig(v) {
			return v === null ? '0' : String(v);
		}
	}
};