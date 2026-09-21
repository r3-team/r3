import srcBase64Icon from '../shared/image.js';
import { getCaption } from '../shared/language.js';

const MyAdminLoginRole = {
	name: 'my-admin-login-role',
	template: `<td class="minimum role-content">
		<div class="row wrap gap">
			<my-button
				v-for="r in module.roles.filter(v => v.assignable && v.content === content)"
				@trigger="$emit('toggle',r.id)"
				:active="!readonly"
				:caption="getCaption('roleTitle',module.id,r.id,r.captions,r.name)"
				:captionTitle="getCaption('roleDesc',module.id,r.id,r.captions)"
				:image="roleIds.includes(r.id) ? 'checkbox1.png' : 'checkbox0.png'"
				:naked="true"
			/>
		</div>
	</td>`,
	props: {
		content: { type: String, required: true }, // role content to filter by
		module: { type: Object, required: true }, // current module
		readonly: { type: Boolean, required: true },
		roleIds: { type: Array, required: true }  // already enabled roles by ID
	},
	emits: ['toggle'],
	methods: {
		getCaption
	}
};

export default {
	name: 'my-admin-login-roles',
	components: { MyAdminLoginRole },
	template: `<table class="generic-table sticky-top bright">
		<thead>
			<tr v-if="isLdapAssignedRoles">
				<th colspan="4"><b>{{ capApp.ldapAssignActive }}</b></th>
			</tr>
			<tr v-if="isOauthClientAssignedRoles">
				<th colspan="4"><b>{{ capApp.oauthAssignActive }}</b></th>
			</tr>
			<tr>
				<th class="minimum">
					<div class="row centered gap space-between default-inputs">
						<span>{{ capGen.application }}</span>
						<input class="short" placeholder="..." v-model="txtFilter" :title="capGen.button.filter" />
					</div>
				</th>
				<th><my-button image="ok.png" @trigger="toggleByContent('admin')" :active="!isExtRole && !readonly" :caption="capApp.roleContentAdmin" :naked="true" /></th>
				<th><my-button image="ok.png" @trigger="toggleByContent('user')"  :active="!isExtRole && !readonly" :caption="capApp.roleContentUser"  :naked="true" /></th>
				<th><my-button image="ok.png" @trigger="toggleByContent('other')" :active="!isExtRole && !readonly" :caption="capApp.roleContentOther" :naked="true" /></th>
			</tr>
		</thead>
		<tbody>
			<tr
				v-for="m in modulesFiltered"
				:class="{ grouping:m.parentId === null }"
				:key="m.id"
			>
				<td class="minimum">
					<div class="row centered">
						<my-button image="dash.png"
							v-if="m.parentId !== null"
							:active="false"
							:naked="true"
						/>
						<img class="module-icon" :src="srcBase64Icon(m.iconId,'images/module.png')" />
						<span>{{ getCaption('moduleTitle',m.id,m.id,m.captions,m.name) }}</span>
					</div>
				</td>

				<!-- roles to toggle -->
				<my-admin-login-role content="admin" @toggle="toggle($event)" :module="m" :readonly="isExtRole || readonly" :roleIds="modelValue" />
				<my-admin-login-role content="user"  @toggle="toggle($event)" :module="m" :readonly="isExtRole || readonly" :roleIds="modelValue" />
				<my-admin-login-role content="other" @toggle="toggle($event)" :module="m" :readonly="isExtRole || readonly" :roleIds="modelValue" />
			</tr>
		</tbody>
	</table>`,
	props: {
		isExtRole: { type: Boolean, required: true },
		isLdapAssignedRoles: { type: Boolean, required: true },
		isOauthClientAssignedRoles: { type: Boolean, required: true },
		modelValue: { type: Array, required: true },
		readonly: { type: Boolean, required: false, default: false },
	},
	data() {
		return {
			// inputs
			txtFilter: '',
		};
	},
	emits: ['update:modelValue'],
	computed: {
		modulesFiltered: s => s.modules.filter(v => !s.moduleIdMapMeta[v.id].hidden &&
			(s.txtFilter === '' || s.getCaption('moduleTitle', v.id, v.id, v.captions, v.name).toLowerCase().includes(s.txtFilter.toLowerCase()))),

		// stores
		capApp: s => s.$store.getters.captions.admin.login,
		capGen: s => s.$store.getters.captions.generic,
		modules: s => s.$store.getters['schema/modules'],
		moduleIdMapMeta: s => s.$store.getters.moduleIdMapMeta,
	},
	methods: {
		// externals
		getCaption,
		srcBase64Icon,

		// actions
		toggle(id) {
			const roleIds = JSON.parse(JSON.stringify(this.modelValue));
			const pos = roleIds.indexOf(id);

			if (pos === -1) roleIds.push(id);
			else roleIds.splice(pos, 1);

			this.$emit('update:modelValue', roleIds);
		},
		toggleByContent(content) {
			const roleIds = JSON.parse(JSON.stringify(this.modelValue));
			const roleIdsByContent = [];
			for (const m of this.modules) {
				for (const r of m.roles) {
					if (r.assignable && r.content === content)
						roleIdsByContent.push(r.id);
				}
			}
			if (roleIdsByContent.length === roleIds.filter(v => roleIdsByContent.includes(v)).length) {
				// has all roles, remove all
				for (const id of roleIdsByContent) {
					roleIds.splice(roleIds.indexOf(id), 1);
				}
			} else {
				// does not have all roles, add missing
				for (let i = 0, j = roleIdsByContent.length; i < j; i++) {
					if (!roleIds.includes(roleIdsByContent[i]))
						roleIds.push(roleIdsByContent[i]);
				}
			}
			this.$emit('update:modelValue', roleIds);
		},
	}
};
