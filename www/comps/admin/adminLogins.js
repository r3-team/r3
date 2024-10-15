import MyInputOffset  from '../inputOffset.js';
import MyAdminLogin   from './adminLogin.js';
import {getLoginIcon} from '../shared/admin.js';
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
				<input class="short"
					v-model="byString"
					@keyup.enter.space="byStringSet"
					:placeholder="capGen.username"
				/>
				<select class="short"
					@change="limitSet($event.target.value)"
					:value="limit"
				>
					<option>10</option>
					<option>25</option>
					<option>50</option>
					<option>100</option>
					<option>500</option>
				</select>
			</div>
		</div>
		
		<div class="content grow no-padding">
			<table class="generic-table sticky-top bright">
				<thead>
					<tr>
						<th class="clickable"
							v-for="t in titles"
							@click="orderBySet(t)"
						>
							<div class="row gap centered">
								<img class="line-icon"
									v-if="orderBy === t"
									:src="orderAsc ? 'images/triangleUp.png' : 'images/triangleDown.png'"
								/>
								<span>{{ capApp.titles[t] }}</span>
							</div>
						</th>
					</tr>
				</thead>
				<tbody>
					<tr class="clickable"
						v-for="l in logins"
						:key="l.id"
						@click="loginIdOpen = l.id"
					>
						<td class="loginName">
							<div class="row gap centered">
								<img class="line-icon" :src="getLoginIcon(l.active,l.admin,l.limited,l.noAuth)" />
								<span>{{ l.name }}</span>
							</div>
						</td>
						<td class="bools">{{ l.admin ? capGen.option.yes : capGen.option.no }}</td>
						<td class="bools">{{ l.ldapId !== null ? capGen.option.yes : capGen.option.no }}</td>
						<td class="bools">{{ l.noAuth ? capGen.option.yes : capGen.option.no }}</td>
						<td class="bools">{{ l.limited ? capGen.option.yes : capGen.option.no }}</td>
						<td class="bools">{{ l.active ? capGen.option.yes : capGen.option.no }}</td>
					</tr>
				</tbody>
			</table>
			
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
			orderAsc:true,
			orderBy:'name',
			total:0,
			titles:['name','admin','ldap','noAuth','limited','active']
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
		// externals
		getLoginIcon,

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
		orderBySet(newOrderBy) {
			if(newOrderBy === 'roles')
				return;

			if(this.orderBy === newOrderBy) {
				this.orderAsc = !this.orderAsc;
			}
			else {
				this.orderBy  = newOrderBy;
				this.orderAsc = true;
			}
			this.get();
		},
		
		// backend calls
		get() {
			ws.send('login','get',{
				byId:0,
				byString:this.byString,
				limit:this.limit,
				offset:this.offset,
				orderAsc:['active','admin','limited','noAuth'].includes(this.orderBy) ? !this.orderAsc : this.orderAsc,
				orderBy:this.orderBy,
				meta:false,
				roles:false,
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