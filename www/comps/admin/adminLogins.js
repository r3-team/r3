import MyInputOffset from '../inputOffset.js';
import MyAdminLogin  from './adminLogin.js';
export {MyAdminLogins as default};

let MyAdminLogins = {
	name:'my-admin-logins',
	components:{
		MyAdminLogin,
		MyInputOffset
	},
	template:`<div class="admin-logins contentBox grow">
		<div class="top">
			<div class="area">
				<img class="icon" src="images/person.png" />
				<h1>{{ menuTitle }}</h1>
			</div>
		</div>
		<div class="top lower">
			<div class="area">
				<my-button image="add.png"
					@trigger="loginIdOpen = 0"
					:caption="capGen.button.new"
				/>
				<my-button image="refresh.png"
					@trigger="get"
					:caption="capGen.button.refresh"
				/>
			</div>
			<div class="area default-inputs">
				<my-input-offset
					@input="offsetSet"
					:caption="true"
					:limit="limit"
					:offset="offset"
					:total="total"
				/>
			</div>
			<div class="area wrap default-inputs">
				<my-button
					@trigger="limitSet(20)"
					:caption="capGen.limit"
					:naked="true"
				/>
				<select class="short selector"
					@change="limitSet($event.target.value)"
					:value="limit"
				>
					<option :value="20">{{ 20 }}</option>
					<option :value="30">{{ 30 }}</option>
					<option :value="50">{{ 50 }}</option>
					<option :value="100">{{ 100 }}</option>
					<option :value="200">{{ 200 }}</option>
					<option :value="500">{{ 500 }}</option>
				</select>
				<input class="selector"
					v-model="byString"
					@keyup.enter.space="byStringSet"
					:placeholder="capGen.username"
				/>
			</div>
		</div>
		
		<div class="content grow">
			<div class="generic-entry-list wide">
				<div class="entry clickable"
					v-for="(l,i) in logins"
					@click="loginIdOpen = l.id"
					:key="l.id"
					:title="l.name"
				>
					<div class="row centered">
						<my-button image="person.png"
							v-if="l.active"
							:active="false"
							:naked="true"
						/>
						<my-button image="remove.png"
							v-if="!l.active"
							:active="false"
							:captionTitle="capApp.hint.isInactive"
							:naked="true"
						/>
						<span>{{ l.name }}</span>
					</div>
					<div class="row">
						<my-button image="globe.png"
							v-if="l.noAuth"
							:active="false"
							:captionTitle="capApp.hint.isNoAuth"
							:naked="true"
						/>
						<my-button image="personCog.png"
							v-if="l.admin"
							:active="false"
							:captionTitle="capApp.hint.isAdmin"
							:naked="true"
						/>
						<my-button image="hierarchy.png"
							v-if="l.ldapId !== null"
							:active="false"
							:captionTitle="capApp.hint.isLdap"
							:naked="true"
						/>
						<my-button image="admin.png"
							:active="false"
							:caption="String(l.roleIds.length)"
							:captionTitle="capApp.hint.roles.replace('{COUNT}',String(l.roleIds.length))"
							:naked="true"
						/>
						<my-button image="builder.png"
							:active="false"
							:caption="String(l.records.filter(v => v.id !== null).length)"
							:captionTitle="capApp.hint.records.replace('{COUNT}',String(l.records.filter(v => v.id !== null).length))"
							:naked="true"
						/>
					</div>
				</div>
			</div>
			
			<!-- login -->
			<my-admin-login
				v-if="loginIdOpen !== null"
				@close="loginIdOpen = null;get()"
				:ldaps="ldaps"
				:loginId="loginIdOpen"
				:loginForms="loginForms"
				:loginFormLookups="loginFormLookups"
			/>
		</div>
	</div>`,
	props:{
		menuTitle:{ type:String, required:true }
	},
	data() {
		return {
			// data
			ldaps:[],
			logins:[],
			
			// state
			byString:'',
			limit:50,
			loginIdOpen:null,
			offset:0,
			total:0,
		};
	},
	computed:{
		loginForms:(s) => {
			let out = [];
			for(let m of s.modules) {
				for(let lf of m.loginForms) {
					out.push(lf);
				}
			}
			return out;
		},
		loginFormLookups:(s) => {
			let out = [];
			for(let lf of s.loginForms) {
				out.push({
					attributeIdLogin:lf.attributeIdLogin,
					attributeIdLookup:lf.attributeIdLookup
				});
			}
			return out;
		},
		
		// stores
		modules:(s) => s.$store.getters['schema/modules'],
		capApp: (s) => s.$store.getters.captions.admin.login,
		capGen: (s) => s.$store.getters.captions.generic
	},
	mounted() {
		this.get();
		this.getLdaps();
		this.$store.commit('pageTitle',this.menuTitle);
	},
	methods:{
		// actions
		byStringSet() {
			this.offset = 0;
			this.get();
		},
		limitSet(newLimit) {
			this.limit  = parseInt(newLimit);
			this.offset = 0;
			this.get();
		},
		offsetSet(newOffset) {
			this.offset = newOffset;
			this.get();
		},
		
		// backend calls
		get() {
			ws.send('login','get',{
				byId:0,
				byString:this.byString,
				limit:this.limit,
				offset:this.offset,
				recordRequests:this.loginFormLookups
			},true).then(
				res => {
					this.logins = res.payload.logins;
					this.total  = res.payload.total;
				},
				this.$root.genericError
			);
		},
		getLdaps() {
			ws.send('ldap','get',{},true).then(
				res => this.ldaps = res.payload,
				this.$root.genericError
			);
		}
	}
};