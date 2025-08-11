import {hasAnyAssignableRole} from '../shared/access.js';
import {getCaption}           from '../shared/language.js';
export {MyAdminLoginRolesAssign as default};

const MyAdminLoginRolesAssign = {
	name:'my-admin-login-roles-assign',
	template:`<div class="column gap">
		<table v-if="modelValue.length !== 0">
			<thead>
				<tr>
					<th>{{ capGen.value }}</th>
					<th>{{ capGen.role }}</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="(r,i) in modelValue" class="default-inputs">
					<td>
						<input
							@input="set(i,'searchString',$event.target.value)"
							:disabled="readonly"
							:placeholder="placeholder"
							:value="r.searchString"
						/>
					</td>
					<td>
						<select
							@change="set(i,'roleId',$event.target.value)"
							:disabled="readonly"
							:value="r.roleId"
						>
							<option :value="null">-</option>
							<optgroup
								v-for="m in modules.filter(v => !v.hidden && hasAnyAssignableRole(v.roles))"
								:label="m.name"
							>
								<option
									v-for="rr in m.roles.filter(v => v.assignable && v.name !== 'everyone')"
									:value="rr.id"
								>{{ getCaption('moduleTitle',m.id,m.id,m.captions,m.name) + ': ' + getCaption('roleTitle',m.id,rr.id,rr.captions,rr.name) }}</option>
							</optgroup>
						</select>
					</td>
					<td>
						<my-button image="cancel.png"
							v-if="!readonly"
							@trigger="remove(i)"
							:naked="true"
						/>
					</td>
				</tr>
			</tbody>
		</table>
		<div>
			<my-button image="add.png"
				@trigger="add"
				:active="!readonly"
				:caption="capGen.button.add"
			/>
		</div>
	</div>`,
	props:{
		modelValue: { type:Array,   required:true },
		placeholder:{ type:String,  required:false, default:'' },
		readonly:   { type:Boolean, required:true }
	},
	emits:['update:modelValue'],
	computed:{
		// stores
		modules:(s) => s.$store.getters['schema/modules'],
		capGen: (s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getCaption,
		hasAnyAssignableRole,

		// actions
		add() {
			let v = JSON.parse(JSON.stringify(this.modelValue));
			v.push({roleId:null,searchString:''});
			this.$emit('update:modelValue',v);
		},
		remove(i) {
			let v = JSON.parse(JSON.stringify(this.modelValue));
			v.splice(i,1);
			this.$emit('update:modelValue',v);
		},
		set(i,name,id) {
			let v = JSON.parse(JSON.stringify(this.modelValue));
			v[i][name] = id;
			this.$emit('update:modelValue',v);
		}
	}
};