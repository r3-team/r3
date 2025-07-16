export {MyAdminLoginMeta as default};

let MyAdminLoginMeta = {
	name:'my-admin-login-meta',
	template:`<table class="generic-table-vertical default-inputs noRowBorders admin-login-meta">
		<tbody>
			<tr>
				<td class="minimum">
					<div class="title-cell">
						<img src="images/edit.png" />
						<span>{{ capGen.name }}</span>
					</div>
				</td>
				<td>
					<table class="fullWidth">
						<tbody>
							<tr>
								<td class="minimum">{{ capApp.nameFore }}</td>
								<td><input class="dynamic" @input="set('nameFore',$event.target.value)" :disabled="readonly" :value="inputs.nameFore" /></td>
							</tr>
							<tr>
								<td class="minimum">{{ capApp.nameSur }}</td>
								<td><input class="dynamic" @input="set('nameSur',$event.target.value)" :disabled="readonly" :value="inputs.nameSur" /></td>
							</tr>
							<tr>
								<td class="minimum">{{ capApp.nameDisplay }}</td>
								<td><input class="dynamic" @input="set('nameDisplay',$event.target.value)" :disabled="readonly" :value="inputs.nameDisplay" /></td>
							</tr>
						</tbody>
					</table>
				</td>
			</tr>
			<tr>
				<td class="minimum">
					<div class="title-cell">
						<img src="images/building1.png" />
						<span>{{ capApp.organization }}</span>
					</div>
				</td>
				<td><input class="dynamic" @input="set('organization',$event.target.value)" :disabled="readonly" :value="inputs.organization" /></td>
			</tr>
			<tr>
				<td class="minimum">
					<div class="title-cell">
						<img src="images/building2.png" />
						<span>{{ capApp.location }}</span>
					</div>
				</td>
				<td><input class="dynamic" @input="set('location',$event.target.value)" :disabled="readonly" :value="inputs.location" /></td>
			</tr>
			<tr>
				<td class="minimum">
					<div class="title-cell">
						<img src="images/department.png" />
						<span>{{ capApp.department }}</span>
					</div>
				</td>
				<td><input class="dynamic" @input="set('department',$event.target.value)" :disabled="readonly" :value="inputs.department" /></td>
			</tr>
			<tr>
				<td class="minimum">
					<div class="title-cell">
						<img src="images/mail2.png" />
						<span>{{ capApp.email }}</span>
					</div>
				</td>
				<td>
					<div class="column gap">
						<input class="dynamic"
							@input="set('email',$event.target.value)"
							@keyup="$emit('input-in-unique-field','email',inputs.email)"
							:disabled="readonly"
							:value="inputs.email"
						/>
						<div v-if="notUniqueEmail && inputs.email !== ''" class="message error">
							{{ capApp.dialog.notUniqueEmail }}
						</div>
					</div>
				</td>
			</tr>
			<tr>
				<td class="minimum">
					<div class="title-cell">
						<img src="images/phone.png" />
						<span>{{ capApp.phone }}</span>
					</div>
				</td>
				<td>
					<table class="fullWidth">
						<tbody>
							<tr>
								<td class="minimum">{{ capApp.phoneMobile }}</td>
								<td><input class="dynamic" @input="set('phoneMobile',$event.target.value)" :disabled="readonly" :value="inputs.phoneMobile" /></td>
							</tr>
							<tr>
								<td class="minimum">{{ capApp.phoneLandline }}</td>
								<td><input class="dynamic" @input="set('phoneLandline',$event.target.value)" :disabled="readonly" :value="inputs.phoneLandline" /></td>
							</tr>
							<tr>
								<td class="minimum">{{ capApp.phoneFax }}</td>
								<td><input class="dynamic" @input="set('phoneFax',$event.target.value)" :disabled="readonly" :value="inputs.phoneFax" /></td>
							</tr>
						</tbody>
					</table>
				</td>
			</tr>
			<tr>
				<td class="minimum">
					<div class="title-cell">
						<img src="images/text_lines.png" />
						<span>{{ capApp.notes }}</span>
					</div>
				</td>
				<td>
					<input class="dynamic"
						v-if="isMapper"
						@input="set('notes',$event.target.value)"
						:disabled="readonly"
						:value="inputs.notes"
					/>
					<textarea class="dynamic"
						v-if="!isMapper"
						@input="set('notes',$event.target.value)"
						:disabled="readonly"
						:value="inputs.notes"
					></textarea>
				</td>
			</tr>
		</tbody>
	</table>`,
	props:{
		isMapper:      { type:Boolean, required:false, default:false },
		modelValue:    { type:Object,  required:true },
		notUniqueEmail:{ type:Boolean, required:false, default:false },
		readonly:      { type:Boolean, required:true }
	},
	emits:['input-in-unique-field','update:modelValue'],
	data() {
		return {
			inputKeys:[
				'department','email','location','nameDisplay','nameFore','nameSur',
				'notes','organization','phoneFax','phoneLandline','phoneMobile'
			]
		};
	},
	computed:{
		inputs:{
			get() {
				let obj = {};
				for(const k of this.inputKeys) {
					obj[k] = this.modelValue[k] !== undefined ? this.modelValue[k] : '';
				}
				return obj;
			}
		},

		// stores
		capApp:(s) => s.$store.getters.captions.admin.loginMeta,
		capGen:(s) => s.$store.getters.captions.generic
	},
	methods:{
		set(name,value) {
			const v = JSON.parse(JSON.stringify(this.inputs));
			v[name] = value;
			this.$emit('update:modelValue',v);
		}
	}
};