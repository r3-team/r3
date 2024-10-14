import {getUnixFormat} from '../shared/time.js';
import MyInputOffset   from '../inputOffset.js';
export {MyAdminSessions as default};

let MyAdminSessions = {
	name:'my-admin-sessions',
	components:{MyInputOffset},
	template:`<div class="admin-sessions contentBox grow">
	
		<div class="top">
			<div class="area">
				<img class="icon" src="images/personServer.png" />
				<h1>{{ menuTitle }}</h1>
			</div>
		</div>
		<div class="top lower">
			<div class="area">
				<my-button image="refresh.png"
					@trigger="get"
					:caption="capGen.button.refresh"
				/>
			</div>
			<div class="area default-inputs" v-if="!noData">
				<my-input-offset
					@input="offset = $event;get()"
					:caption="true"
					:limit="limit"
					:offset="offset"
					:total="total"
				/>
			</div>
			<div class="area default-inputs">
				<input class="short"
					v-model="byString"
					@keyup.enter="startAtPageFirst"
					:placeholder="capGen.textSearch"
				/>
				
				<select v-model.number="limit" @change="startAtPageFirst">
					<option>10</option>
					<option>25</option>
					<option>50</option>
					<option>100</option>
					<option>500</option>
					<option>1000</option>
				</select>
			</div>
		</div>
		
		<div class="content default-inputs" :class="{ 'no-padding':!noData }">
			
			<span v-if="noData"><i>{{ capApp.noData }}</i></span>
			
			<table class="generic-table bright" v-if="!noData">
				<thead>
					<tr>
						<th class="clickable"
							v-for="t in titles"
							@click="orderBySet(t)"
						>
							<div class="row gap">
								<img class="line-icon"
									v-if="orderBy === t"
									:src="orderAsc ? 'images/triangleUp.png' : 'images/triangleDown.png'"
								/>
								<span>{{ capApp.titles[t] }}</span>
							</div>
						</td>
					</tr>
				</thead>
				<tbody>
					<tr v-for="s in sessions">
						<td>{{ s.loginName }}</td>
						<td>{{ s.loginDisplay }}</td>
						<td>
							<div class="row gap centered">
								<img class="line-icon" src="images/department.png" />
								<span>{{ s.loginDepartment }}</span>
							</div>
						</td>
						<td>{{ s.admin ? capGen.option.yes : capGen.option.no }}</td>
						<td>{{ s.noAuth ? capGen.option.yes : capGen.option.no }}</td>
						<td>{{ s.limited ? capGen.option.yes : capGen.option.no }}</td>
						<td>
							<div class="row gap centered">
								<img class="line-icon" src="images/server.png" />
								<span>{{ s.nodeName }}</span>
							</div>
						</td>
						<td>
							<div class="row gap centered">
								<img class="line-icon" src="images/screen.png" v-if="s.device === 'fatClient'" />
								<img class="line-icon" src="images/globe.png"  v-if="s.device === 'browser'"   />
								<span>{{ capApp.option[s.device] }}</span>
							</div>
						</td>
						<td>{{ s.address }}</td>
						<td>{{ getUnixFormat(s.date,settings.dateFormat+' H:i') }}</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>`,
	props:{
		menuTitle:{ type:String, required:true }
	},
	data() {
		return {
			// data
			sessions:[],
			total:50,
			
			// state
			byString:'',
			limit:50,
			offset:0,
			orderAsc:false,
			orderBy:'date',
			titles:[
				'loginName','loginDisplay','loginDepartment','admin',
				'noAuth','limited','nodeName','device','address','date'
			]
		};
	},
	computed:{
		noData:(s) => s.total === 0,
		pages: (s) => Math.ceil(s.total / s.limit),

		// stores
		capApp:  (s) => s.$store.getters.captions.admin.loginSessions,
		capGen:  (s) => s.$store.getters.captions.generic,
		settings:(s) => s.$store.getters.settings
	},
	mounted() {
		this.get();
		this.$store.commit('pageTitle',this.menuTitle);
	},
	methods:{
		// externals
		getUnixFormat,

		// actions
		byStringSet() {
			this.offset = 0;
			this.get();
		},
		orderBySet(newOrderBy) {
			if(this.orderBy === newOrderBy) {
				this.orderAsc = !this.orderAsc;
			}
			else {
				this.orderBy  = newOrderBy;
				this.orderAsc = true;
			}
			this.get();
		},
		startAtPageFirst() {
			this.offset = 0;
			this.get();
		},
		
		// backend calls
		get() {
			ws.send('loginSession','get',{
				byString:this.byString === '' ? null : this.byString,
				limit:this.limit,
				offset:this.offset,
				orderAsc:this.orderAsc,
				orderBy:this.orderBy
			},true).then(
				res => {
					this.sessions = res.payload.sessions;
					this.total    = res.payload.total;
				},
				this.$root.genericError
			);
		}
	}
};