import srcBase64Icon   from '../shared/image.js';
import {openLink}      from '../shared/generic.js';
import {getUnixFormat} from '../shared/time.js';
import {getCaption}    from '../shared/language.js';

export default {
	name:'my-admin-modules-item',
	template:`<tr :class="{ grouping:module.parentId === null }">
		<td class="noWrap">
			<div class="row centered">
				<my-button image="dash.png"
					v-if="module.parentId !== null"
					:active="false"
					:naked="true"
				/>
				<img class="module-icon" :src="srcBase64Icon(module.iconId,'images/module.png')" />
				<span>{{ getCaption('moduleTitle',module.id,module.id,module.captions,module.name) }}</span>
			</div>
		</td>
		<td class="minimum">v{{ module.releaseBuild }}</td>
		<td class="noWrap">
			{{ module.releaseDate === 0 ? '-' : getUnixFormat(module.releaseDate,settings.dateFormat) }}
		</td>
		<td class="noWrap">
			<div v-if="!isInRepo">
				<i>{{ capApp.repoNotIncluded }}</i>
			</div>
			
			<div v-if="isOutdatedApp">
				<i>{{ capApp.repoOutdatedApp }}</i>
			</div>
			
			<div v-if="isUpToDate">
				{{ capApp.repoUpToDate }}
			</div>
		
			<my-button
				v-if="isReadyForUpdate"
				@trigger="$emit('install',repoModule.moduleId)"
				:active="!installStarted && !productionMode"
				:caption="capApp.button.update.replace('{VERSION}',repoModule.releaseBuild)"
				:image="!installStarted ? 'download.png' : 'load.gif'"
			/>
		</td>
		<td class="noWrap">
			<my-button image="question.png"
				@trigger="$emit('showHelp',module.id)"
				:active="hasHelp"
				:captionTitle="capGen.help"
			/>
		</td>
		<td class="noWrap">
			<my-button image="time.png"
				@trigger="$emit('showLog',changeLog)"
				:active="changeLog !== '' && changeLog !== null"
				:captionTitle="capApp.changeLog"
			/>
		</td>
		<td class="noWrap" v-if="builderEnabled">
			<my-bool
				@update:modelValue="ownerWarning"
				:modelValue="owner"
				:readonly="productionMode"
				:reversed="true"
			/>
		</td>
		<td class="noWrap">
			<my-bool
				v-model="hidden"
				@update:modelValue="change"
				:readonly="productionMode"
			/>
		</td>
		<td class="default-inputs">
			<input class="short"
				v-model.number="position"
				@input="change"
				:disabled="productionMode"
			/>
		</td>
		<td>
			<div class="row gap">
				<my-button image="builder.png"
					:active="builderEnabled"
					@trigger="openBuilder(false)"
					@trigger-middle="openBuilder(true)"
					:captionTitle="capGen.button.openBuilder"
				/>
				<my-button image="delete.png"
					@trigger="delAsk"
					:active="!productionMode"
					:cancel="true"
					:captionTitle="capGen.button.delete"
				/>
			</div>
		</td>
		<td></td>
	</tr>`,
	props:{
		installStarted:{ type:Boolean, required:true },
		module:        { type:Object,  required:true },
		options:       { type:Object,  required:true },
		repoModules:   { type:Array,   required:true },
		warningShown:  { type:Boolean, required:true }
	},
	emits:['change','install','showLog','showHelp','shownWarning'],
	data() {
		return {
			id:this.module.id,
			hidden:this.options.hidden,
			owner:this.options.owner,
			position:this.options.position
		};
	},
	computed:{
		hasHelp:s => s.module.articleIdsHelp.length !== 0
			&& typeof s.articleIdMap[s.module.articleIdsHelp[0]].captions.articleBody[s.settings.languageCode] !== 'undefined',
		moduleNamesDependendOnUs:s => {
			let out = [];
			for(let i = 0, j = s.moduleIdsDependendOnUs.length; i < j; i++) {
				let m = s.moduleIdMap[s.moduleIdsDependendOnUs[i]];
				out.push(m.name);
			}
			return out;
		},
		moduleIdsDependendOnUs:s => {
			let out = [];
			let addDependendIds = function(moduleParent) {
				// check all other modules for dependency to parent module
				for(let moduleChild of s.modules) {
					// root, parent module or was already added
					if(moduleChild.id === s.module.id || moduleChild.id === moduleParent.id || out.includes(moduleChild.id))
						continue;
					
					for(let moduleIdChildDependsOn of moduleChild.dependsOn) {
						if(moduleIdChildDependsOn === moduleParent.id) {
							out.push(moduleChild.id);
							
							// add dependencies from child as well
							addDependendIds(moduleChild);
							break;
						}
					}
				}
			};
			
			// get dependencies of this module (root)
			addDependendIds(s.module);
			return out;
		},
		
		// repository
		repoModule:s => {
			for(let i = 0, j = s.repoModules.length; i < j; i++) {
				if(s.repoModules[i].moduleId === s.id)
					return s.repoModules[i];
			}
			return false;
		},
		
		// simple
		changeLog:       s => s.repoModule === false ? '' : s.repoModule.changeLog,
		isInRepo:        s => s.repoModule !== false,
		isOutdated:      s => s.isInRepo && s.repoModule.releaseBuild    > s.module.releaseBuild,
		isOutdatedApp:   s => s.isInRepo && s.repoModule.releaseBuildApp > s.appVersionBuild,
		isReadyForUpdate:s => s.isInRepo && s.isOutdated && !s.isOutdatedApp,
		isUpToDate:      s => s.isInRepo && !s.isOutdated,
		
		// stores
		appVersionBuild:s => s.$store.getters['local/appVersionBuild'],
		modules:        s => s.$store.getters['schema/modules'],
		moduleIdMap:    s => s.$store.getters['schema/moduleIdMap'],
		articleIdMap:   s => s.$store.getters['schema/articleIdMap'],
		builderEnabled: s => s.$store.getters.builderEnabled,
		capApp:         s => s.$store.getters.captions.admin.modules,
		capGen:         s => s.$store.getters.captions.generic,
		productionMode: s => s.$store.getters.productionMode,
		settings:       s => s.$store.getters.settings
	},
	methods:{
		// externals
		getCaption,
		getUnixFormat,
		openLink,
		srcBase64Icon,
		
		// actions
		change() {
			this.$emit('change',this.module.id,{
				hidden:this.hidden,
				owner:this.owner,
				position:this.position
			});
		},
		openBuilder(middle) {
			if(!middle) this.$router.push('/builder/module/'+this.module.id);
			else        this.openLink('#/builder/module/'+this.module.id,true);
		},
		ownerToggle() {
			this.owner = !this.owner;
			this.change();
		},
		ownerWarning(state) {
			if(!state || this.warningShown)
				return this.ownerToggle();
			
			this.$store.commit('dialog',{
				captionBody:this.capApp.dialog.owner,
				captionTop:this.capApp.dialog.ownerTitle,
				image:'warning.png',
				buttons:[{
					cancel:true,
					caption:this.capGen.button.apply,
					exec:this.ownerToggle,
					keyEnter:true,
					image:'warning.png'
				},{
					caption:this.capGen.button.cancel,
					keyEscape:true,
					image:'cancel.png'
				}]
			});
			this.$emit('shownWarning');
		},
		
		// backend calls
		delAsk() {
			let appNames = '';
			
			if(this.moduleNamesDependendOnUs.length !== 0)
				appNames = this.capApp.dialog.deleteApps.replace('{LIST}',
					`<li>${this.moduleNamesDependendOnUs.join('</li><li>')}</li>`
				);
			
			this.$store.commit('dialog',{
				captionBody:this.capApp.dialog.delete.replace('{APPS}',appNames),
				captionTop:this.capApp.dialog.deleteTitle.replace('{APP}',this.module.name),
				image:'warning.png',
				buttons:[{
					cancel:true,
					caption:this.capGen.button.delete,
					exec:this.delAsk2,
					keyEnter:true,
					image:'delete.png'
				},{
					caption:this.capGen.button.cancel,
					keyEscape:true,
					image:'cancel.png'
				}]
			});
		},
		delAsk2() {
			this.$nextTick(() => {
				this.$store.commit('dialog',{
					captionBody:this.capApp.dialog.deleteMulti.replace('{COUNT}',this.moduleNamesDependendOnUs.length + 1),
					captionTop:this.capApp.dialog.deleteTitle.replace('{APP}',this.module.name),
					image:'warning.png',
					buttons:[{
						cancel:true,
						caption:this.capGen.button.delete,
						exec:this.del,
						keyEnter:true,
						image:'delete.png'
					},{
						caption:this.capGen.button.cancel,
						keyEscape:true,
						image:'cancel.png'
					}]
				});
			});
		},
		del() {
			let requests = [ws.prepare('module','del',this.id)];
			
			// add dependencies to delete
			for(let id of this.moduleIdsDependendOnUs) {
				requests.push(ws.prepare('module','del',id));
			}
			
			ws.sendMultiple(requests,true).then(
				() => this.$root.schemaReload(),
				this.$root.genericError
			);
		}
	}
};