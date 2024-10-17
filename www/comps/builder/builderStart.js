export {MyBuilderStart as default};

let MyBuilderStartIcon = {
	name:'my-builder-start-icon',
	template:`<img class="builder-start-icon"
		:class="{ bad:bad, small:small }"
		:src="!bad ? 'images/ok.png' : 'images/cancel.png'"
	/>`,
	props:{
		bad:  { type:Boolean, required:false, default:false },
		small:{ type:Boolean, required:false, default:false }
	}
};

let MyBuilderStart = {
	name:'my-builder-start',
	components:{MyBuilderStartIcon},
	template:`<div class="builder-start contentBox grow" v-if="module">
		<div class="top lower">
			<div class="area nowrap">
				<img class="icon" src="images/flag.png" />
				<h1 class="title">{{ capApp.title }}</h1>
			</div>
		</div>
		
		<div class="content default-inputs">
			
			<!-- major entities -->
			<div class="builder-start-entities">
				
				<router-link class="builder-start-box builder-start-entity clickable"
					:to="'/builder/relations/'+id" 
				>
					<div class="builder-start-entity-header">
						<my-builder-start-icon :bad="!hasRelations" />
						<h1>{{ capApp.titleRelations }}</h1>
					</div>
					<img class="poster" src="images/databaseHighRes.png" />
					<span>{{ capApp.titleRelationsHint }}</span>
				</router-link>
				
				<router-link class="builder-start-box builder-start-entity clickable"
					:to="'/builder/forms/'+id" 
				>
					<div class="builder-start-entity-header">
						<my-builder-start-icon :bad="!hasForms" />
						<h1>{{ capApp.titleForms }}</h1>
					</div>
					<img class="poster" src="images/fileText.png" />
					<span>{{ capApp.titleFormsHint }}</span>
				</router-link>
				
				<router-link class="builder-start-box builder-start-entity clickable"
					:to="'/builder/menu/'+id" 
				>
					<div class="builder-start-entity-header">
						<my-builder-start-icon :bad="!hasMenu" />
						<h1>{{ capApp.titleMenu }}</h1>
					</div>
					<img class="poster" src="images/menuHighRes.png" />
					<span>{{ capApp.titleMenuHint }}</span>
				</router-link>
				
				<router-link class="builder-start-box builder-start-entity clickable"
					:to="'/builder/roles/'+id" 
				>
					<div class="builder-start-entity-header">
						<my-builder-start-icon :bad="!hasRoles" />
						<h1>{{ capApp.titleRoles }}</h1>
					</div>
					<img class="poster" src="images/personMultipleHighRes.png" />
					<span>{{ capApp.titleRolesHint }}</span>
				</router-link>
			</div>
			
			<!-- visibility -->
			<br /><br />
			<h1>{{ capApp.checks }}</h1>
			
			<div class="builder-start-box builder-start-visibility">
				<div class="builder-start-visibility-header">
					<my-builder-start-icon :bad="readonly" />
					<h1>{{ !readonly ? capApp.checkNotReadonly : capApp.checkNotReadonlyOff }}</h1>
					<router-link v-if="readonly" to="/admin/modules">
						<my-button image="settings.png" :caption="capApp.button.fix" />
					</router-link>
				</div>
				<div class="builder-start-visibility-header">
					<my-builder-start-icon :bad="!isVisible" />
					<h1>{{ isVisible ? capApp.appVisible : capApp.appVisibleOff }}</h1>
				</div>
				<table>
					<tbody>
						<tr>
							<td><my-builder-start-icon :bad="!hasStartForm" :small="true" /></td>
							<td>{{ hasStartForm ? capApp.checkStartForm : capApp.checkStartFormOff }}</td>
							<td>
								<router-link v-if="!hasStartForm" :to="'/builder/module/'+id">
									<my-button image="settings.png" :caption="capApp.button.fix" />
								</router-link>
							</td>
						</tr>
						<tr>
							<td><my-builder-start-icon :bad="!hasMenu" :small="true" /></td>
							<td>{{ hasMenu ? capApp.checkMenu : capApp.checkMenuOff }}</td>
							<td>
								<router-link v-if="!hasMenu" :to="'/builder/menu/'+id">
									<my-button image="settings.png" :caption="capApp.button.fix" />
								</router-link>
							</td>
						</tr>
						<tr>
							<td><my-builder-start-icon :bad="!hasMenuInRole" :small="true" /></td>
							<td>{{ hasMenuInRole ? capApp.checkMenuInRole : capApp.checkMenuInRoleOff }}</td>
							<td>
								<router-link v-if="!hasMenuInRole" :to="'/builder/roles/'+id">
									<my-button image="settings.png" :caption="capApp.button.fix" />
								</router-link>
							</td>
						</tr>
						<tr>
							<td><my-builder-start-icon :bad="isHiddenAdmin" :small="true" /></td>
							<td>{{ !isHiddenAdmin ? capApp.checkNotHidden : capApp.checkNotHiddenOff }}</td>
							<td>
								<router-link v-if="isHiddenAdmin" to="/admin/modules">
									<my-button image="settings.png" :caption="capApp.button.fix" />
								</router-link>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
			
			<!-- external resources -->
			<br /><br />
			<h1>{{ capApp.needHelp }}</h1>
			<div class="builder-start-box builder-start-resources">
				<my-button image="globe.png"
					@trigger="open('https://community.rei3.de/')"
					:caption="capApp.extCommunity"
					:large="true"
				/>
				<my-button image="globe.png"
					@trigger="open('https://rei3.de/en/docs')"
					:caption="capApp.extDocs"
					:large="true"
				/>
			</div>
		</div>
	</div>`,
	props:{
		id:      { type:String,  required:true },
		readonly:{ type:Boolean, required:true }
	},
	computed:{
		hasMenuInRole:(s) => {
			for(let r of s.module.roles) {
				if(Object.keys(r.accessMenus).length !== 0)
					return true;
			}
			return false;
		},
		
		// simple
		hasForms:     (s) => s.module.forms.length !== 0,
		hasMenu:      (s) => s.module.menus.length !== 0,
		hasRelations: (s) => s.module.relations.length !== 0,
		hasRoles:     (s) => s.module.roles.length !== 1,
		hasStartForm: (s) => s.module.formId !== null,
		isHiddenAdmin:(s) => s.module && s.moduleIdMapMeta[s.id].hidden,
		isVisible:    (s) => !s.isHiddenAdmin && s.hasStartForm && s.hasMenu && s.hasMenuInRole,
		
		// stores
		module:         (s) => s.moduleIdMap[s.id],
		moduleIdMap:    (s) => s.$store.getters['schema/moduleIdMap'],
		capApp:         (s) => s.$store.getters.captions.builder.start,
		moduleIdMapMeta:(s) => s.$store.getters.moduleIdMapMeta
	},
	methods:{
		open(url) {
			window.open(url);
		}
	}
};
