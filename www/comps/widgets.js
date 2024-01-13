import {getColumnTitle} from './shared/column.js';
import {formOpen}       from './shared/form.js';
import {colorAdjustBg}  from './shared/generic.js';
import {getCaption}     from './shared/language.js';
import srcBase64Icon    from './shared/image.js';
import MyForm           from './form.js';
import {
	getCollectionColumn,
	getCollectionValues
} from './shared/collection.js';
export {MyWidgets as default};

let MyWidget = {
	name:'my-widget',
	components:{ MyForm },
	template:`<div class="widget" v-if="active" :class="cssClasses">
		<div class="header">
			<div class="row gap centered">
				<img class="dragAnchor" src="images/drag.png" v-if="editMode" />
				
				<img
					v-if="moduleSource && moduleSource.iconId !== null"
					:src="srcBase64Icon(moduleSource.iconId,'')"
				/>
				
				<span v-if="moduleWidget">{{ title }}</span>
			</div>
			
			<div class="row gap centered">
				<img class="clickable" src="images/builder.png"
					v-if="moduleWidget && isAdmin && builderEnabled"
					@click.exact="openBuilder(false)"
					@click.middle="openBuilder(true)"
				/>
				<img class="clickable" src="images/cancel.png"
					v-if="editMode && !isTemplate"
					@click="$emit('remove')"
				/>
				
				<div class="moduleBobble" v-if="true" :style="bobbleStyle"></div>
			</div>
		</div>
		<div class="content">
			
			<!-- system widgets -->
			<template v-if="isSystem">
				
				<!-- module menu -->
				<div class="system-module-menu" v-if="moduleEntry">
					
					<router-link class="clickable"
						:to="'/app/'+moduleEntry.name"
					>
						<img :src="srcBase64Icon(moduleEntry.iconId,'images/module.png')" />
						<span>{{ moduleEntry.caption }}</span>
					</router-link>
					
					<div class="children">
						<router-link class="clickable"
							v-for="mec in moduleEntry.children"
							:key="mec.id"
							:to="'/app/'+moduleEntry.name+'/'+mec.name"
						>
							<img :src="srcBase64Icon(mec.iconId,'images/module.png')" />
							<span>{{ mec.caption }}</span>
							
						</router-link>
					</div>
					
					<img class="watermark" :src="srcBase64Icon(moduleEntry.iconId,'images/module.png')" />
				</div>
				
				<!-- login details -->
				
			</template>
			
			<!-- module widgets -->
			<template v-if="moduleWidget">
				<my-form
					v-if="form"
					@records-open="formRecordIds = $event"
					:formId="form.id"
					:isWidget="true"
					:moduleId="form.moduleId"
					:recordIds="formRecordIds"
				/>
				
				<!-- collection -->
				<div class="widget-collection-consumer" v-if="collectionConsumer">
					<img
						v-if="collection.iconId !== null"
						:src="srcBase64Icon(collection.iconId,'')"
					/>
					<span
						v-if="collectionHasDisplay"
						@click="clickCollection"
						:class="{ clickable:collectionOpenForm }"
					>{{ collectionValue + ' ' + collectionTitle }}</span>
				</div>
			</template>
		</div>
	</div>`,
	emits:['remove'],
	props:{
		editMode:  { type:Boolean, required:true },
		isTemplate:{ type:Boolean, required:false, default:false },
		widget:    { type:Object,  required:true }
	},
	data() {
		return {
			formRecordIds:[]
		};
	},
	computed:{
		active:(s) => {
			if(s.moduleWidget) {
				
				// no access to widget
				if(typeof s.access.widget[s.moduleWidget.id] === 'undefined')
					return false;
				
				// no access to collection
				if(s.collection && typeof s.access.collection[s.collection.id] === 'undefined')
					return false;
				
				// collection consumer cases (no display on mobile / no display if empty)
				if(s.collectionConsumer && !s.collectionConsumer.onMobile && s.isMobile)
					return false;
				
				if(s.collectionConsumer && s.collectionConsumer.noDisplayEmpty && (
					s.collectionValue === null || s.collectionValue === 0 || s.collectionValue === '')) {
					
					return false;
				}
			}
			
			if(s.isSystemModuleMenu && !s.moduleEntry)
				return false;
			
			return true;
		},
		bobbleStyle:(s) => {
			let moduleId = null;
			
			if(s.moduleEntry) moduleId = s.moduleEntry.id;
			if(s.collection)  moduleId = s.collection.moduleId;
			if(s.form)        moduleId = s.form.moduleId;
			
			return moduleId !== null && s.moduleIdMap[moduleId].color1 !== null
				? `border-bottom-color:${s.colorAdjustBg(s.moduleIdMap[moduleId].color1)}` : '';
		},
		cssClasses:(s) => {
			let out = [];
			
			if(s.isTemplate)                              out.push('template');
			if(s.moduleWidget && s.moduleWidget.size > 1) out.push('size2');
			
			return out.join(' ');
		},
		title:(s) => {
			// use most specific title in order: Widget title, form title, widget name
			let t = '';
			if(s.moduleWidget)     t = s.getCaption('widgetTitle',s.moduleWidget.moduleId,s.moduleWidget.id,s.moduleWidget.captions);
			if(t === '' && s.form) t = s.getCaption('formTitle',s.form.moduleId,s.form.id,s.form.captions);
			if(t === '')           t = s.moduleWidget ? s.moduleWidget.name : '';
			return t;
		},
		
		// simple
		isSystem:          (s) => s.widget.content.startsWith('system'),
		isSystemModuleMenu:(s) => s.widget.content === 'systemModuleMenu',
		
		// entities
		collection:          (s) => !s.moduleWidget || s.moduleWidget.collection === null ? false : s.collectionIdMap[s.moduleWidget.collection.collectionId],
		collectionConsumer:  (s) => !s.collection ? false : s.moduleWidget.collection,
		collectionHasDisplay:(s) => !s.collectionConsumer ? false : s.collectionConsumer.columnIdDisplay !== null,
		collectionOpenForm:  (s) => !s.collectionConsumer ? false : s.collectionConsumer.openForm,
		collectionTitle:     (s) => !s.collectionHasDisplay ? '' : s.getColumnTitle(s.getCollectionColumn(s.collection.id,s.collectionConsumer.columnIdDisplay),s.collection.moduleId),
		collectionValue:     (s) => !s.collectionHasDisplay ? '' : s.getCollectionValues(s.collection.id,s.collectionConsumer.columnIdDisplay,true),
		form:                (s) => !s.moduleWidget || s.moduleWidget.formId === null ? false : s.formIdMap[s.moduleWidget.formId],
		moduleSource:        (s) => !s.moduleWidget ? false : s.moduleIdMap[s.moduleWidget.moduleId],
		moduleWidget:        (s) => s.widget.widgetId === null ? false : s.widgetIdMap[s.widget.widgetId],
		moduleEntry:         (s) => {
			if(!s.isSystemModuleMenu)
				return false;
			
			for(const me of s.moduleEntries) {
				if(me.id === s.widget.moduleId)
					return me;
			}
			return false;
		},
		
		// stores
		collectionIdMap:(s) => s.$store.getters['schema/collectionIdMap'],
		formIdMap:      (s) => s.$store.getters['schema/formIdMap'],
		moduleIdMap:    (s) => s.$store.getters['schema/moduleIdMap'],
		widgetIdMap:    (s) => s.$store.getters['schema/widgetIdMap'],
		access:         (s) => s.$store.getters.access,
		builderEnabled: (s) => s.$store.getters.builderEnabled,
		isAdmin:        (s) => s.$store.getters.isAdmin,
		isMobile:       (s) => s.$store.getters.isMobile,
		moduleEntries:  (s) => s.$store.getters.moduleEntries
	},
	methods:{
		// externals
		colorAdjustBg,
		formOpen,
		getCaption,
		getCollectionColumn,
		getCollectionValues,
		getColumnTitle,
		srcBase64Icon,
		
		// actions
		clickCollection() {
			if(this.collectionOpenForm)
				this.formOpen(this.collectionOpenForm);
		},
		openBuilder(middle) {
			if(!this.moduleWidget)
				return;
			
			const url = `/builder/widgets/${this.moduleWidget.moduleId}?widgetIdEdit=${this.moduleWidget.id}`;
			
			if(!middle) this.$router.push(url);
			else        window.open(`#${url}`,'_blank');
		}
	}
};

let MyWidgetGroup = {
	name:'my-widget-group',
	components:{ MyWidget },
	template:`<div class="widget-group" :class="{ editMode:editMode }">
		<div class="widget-group-title default-inputs">
			<img class="dragAnchor" src="images/drag.png" v-if="editMode" />
			<span v-if="!editMode">{{ widgetGroup.title }}</span>
			<input v-if="editMode" @input="$emit('set-title',$event.target.value)" :value="widgetGroup.title" />
			<my-button image="cancel.png"
				v-if="editMode"
				@trigger="$emit('remove')"
				:naked="true"
			/>
		</div>
		
		<draggable class="widget-group-items" handle=".dragAnchor" group="widget-group-items" itemKey="id" animation="150"
			:list="widgetGroup.items"
		>
			<template #item="{element,index}">
				<my-widget
					@remove="$emit('remove-widget',index)"
					:editMode="editMode"
					:widget="element"
				/>
			</template>
			<template #footer v-if="editMode && widgetGroup.items.length === 0">
				<div class="widget placeholder">
					{{ capApp.placeholder }}
				</div>
			</template>
		</draggable>
	</div>`,
	emits:['remove','remove-widget','set-title'],
	props:{
		editMode:   { type:Boolean, required:true },
		widgetGroup:{ type:Object,  required:true }
	},
	computed:{
		// stores
		capApp:(s) => s.$store.getters.captions.widgets
	}
};

let MyWidgets = {
	name:'my-widgets',
	components:{
		MyWidget,
		MyWidgetGroup
	},
	template:`<div class="widgets">
		<div class="widgets-content-wrap">
			<div class="widgets-content"
				:class="{ editMode:editMode }"
				:style="'max-width:' + widgetWidth + 'px'"
			>
				<draggable class="widget-groups" handle=".dragAnchor" group="widget-groups" itemKey="id" animation="150" direction="vertical"
					:class="{ editMode:editMode, flowsAsRow:widgetFlow === 'row' }"
					:list="widgetGroupsInput"
				>
					<template #item="{element,index}">
						<my-widget-group
							@remove="groupDel(index)"
							@remove-widget="widgetDel(index,$event)"
							@set-title="groupSetTitle(index,$event)"
							:editMode="editMode"
							:widgetGroup="element"
						/>
					</template>
				</draggable>
			</div>
		</div>
		
		<div class="widgets-sidebar" :class="{ shown:editMode }" v-if="!isMobile">
			<div class="row gap wrap">
				<my-button image="edit.png"
					v-if="!editMode"
					@trigger="openEditMode"
					:caption="capGen.button.edit"
				/>
				<my-button image="save.png"
					v-if="editMode"
					@trigger="set"
					:active="hasChanges"
					:caption="capGen.button.save"
				/>
				<my-button image="refresh.png"
					v-if="editMode"
					@trigger="reset"
					:active="hasChanges"
					:caption="capGen.button.refresh"
				/>
				<my-button image="add.png"
					v-if="editMode"
					@trigger="groupAdd"
					:caption="capApp.button.groupAdd"
				/>
				<my-button image="cancel.png"
					v-if="editMode"
					@trigger="editMode = !editMode"
					:caption="capGen.button.close"
					:cancel="true"
				/>
			</div>
			
			<div class="widgets-sidebar-content" v-if="editMode">
				<div class="widgets-sidebar-title">
					<span>{{ capGen.settings }}</span>
				</div>
				<div class="widgets-sidebar-content-box default-inputs">
					<table>
						<tr>
							<td>{{ capApp.flow }}</td>
							<td>
								<select v-model="flowInput">
									<option value="column">{{ capApp.option.flowColumn }}</option>
									<option value="row">{{ capApp.option.flowRow }}</option>
								</select>
							</td>
						</tr>
						<tr>
							<td>{{ capApp.width }}</td>
							<td>
								<div class="row centered gap">
									<my-button image="remove.png" @trigger="widthInput -= widthSteps" :active="widthInput > widthSteps" />
									<input disabled="disabled" :value="widthInput" />
									<my-button image="add.png" @trigger="widthInput += widthSteps" />
								</div>
							</td>
						</tr>
					</table>
				</div>
			</div>
			
			<div class="widgets-sidebar-content shrinks" v-if="editMode">
				<div class="widgets-sidebar-title default-inputs">
					<span>{{ capGen.available }}</span>
					<select class="auto" v-model="templateFilter">
						<option value="all">{{ capGen.button.all }}</option>
						<option value="module">{{ capApp.option.filterModule }}</option>
						<option value="system">{{ capApp.option.filterSystem }}</option>
					</select>
				</div>
				<draggable class="widget-group-items templates widgets-sidebar-content-box" handle=".dragAnchor" itemKey="id" animation="150"
					:group="{ name:'widget-group-items', put:false }"
					:list="widgetTemplates"
				>
					<template #item="{element,index}">
						<my-widget
							:editMode="editMode"
							:isTemplate="true"
							:widget="element"
						/>
					</template>
				</draggable>
			</div>
		</div>
	</div>`,
	data() {
		return {
			editMode:false,
			templateFilter:'all', // filter for widget templates (all, module, system)
			widgetGroupsInput:[], // widget groups, updated by user input
			widthSteps:50
		};
	},
	computed:{
		moduleIdsAccessible:(s) => {
			let out = [];
			for(const me of s.moduleEntries) {
				out.push(me.id);
			}
			return out;
		},
		moduleIdsUsedMenu:(s) => {
			let out = [];
			for(const g of s.widgetGroupsInput) {
				for(const w of g.items) {
					if(w.moduleId !== null)
						out.push(w.moduleId);
				}
			}
			return out;
		},
		widgetIdsUsed:(s) => {
			let out = [];
			for(const g of s.widgetGroupsInput) {
				for(const w of g.items) {
					if(w.widgetId !== null)
						out.push(w.widgetId);
				}
			}
			return out;
		},
		widgetTemplates:(s) => {
			let out = [];
			
			if(s.templatesSystem) {
				// system widget: module menu
				for(const m of s.modules) {
					if(!s.moduleIdsAccessible.includes(m.id) || s.moduleIdsUsedMenu.includes(m.id))
						continue;
					
					out.push({
						content:'systemModuleMenu',
						moduleId:m.id,
						widgetId:null
					});
				}
			}
			
			if(s.templatesModule) {
				// module widgets
				for(const m of s.modules) {
					for(const w of m.widgets) {
						if(s.widgetIdsUsed.includes(w.id))
							continue;
						
						out.push({
							content:'moduleWidget',
							moduleId:null,
							widgetId:w.id
						});
					}
				}
			}
			return out;
		},
		
		// inputs
		flowInput:{
			get()  { return this.widgetFlow; },
			set(v) { this.$store.commit('local/widgetFlow',v); }
		},
		widthInput:{
			get()  { return this.widgetWidth; },
			set(v) { this.$store.commit('local/widgetWidth',v); }
		},
		
		// simple
		hasChanges:     (s) => JSON.stringify(s.widgetGroups) !== JSON.stringify(s.widgetGroupsInput),
		templatesModule:(s) => s.templateFilter === 'all' || s.templateFilter === 'module',
		templatesSystem:(s) => s.templateFilter === 'all' || s.templateFilter === 'system',
		
		// stores
		widgetFlow:   (s) => s.$store.getters['local/widgetFlow'],
		widgetWidth:  (s) => s.$store.getters['local/widgetWidth'],
		modules:      (s) => s.$store.getters['schema/modules'],
		capApp:       (s) => s.$store.getters.captions.widgets,
		capGen:       (s) => s.$store.getters.captions.generic,
		isMobile:     (s) => s.$store.getters.isMobile,
		moduleEntries:(s) => s.$store.getters.moduleEntries,
		widgetGroups: (s) => s.$store.getters.loginWidgetGroups
	},
	mounted() {
		// if, at mount, there are no widget groups, prepopulate with module menus
		if(this.widgetGroups.length === 0) {
			let wg = [];
			for(const m of this.modules) {
				if(!this.moduleIdsAccessible.includes(m.id))
					continue;
				
				wg.push({
					content:'systemModuleMenu',
					moduleId:m.id,
					widgetId:null
				});
			}
			this.$store.commit('loginWidgetGroups',[{
				title:this.capGen.applications,
				items:wg
			}]);
		}
		
		// reset widget group input
		this.reset();
		
		window.addEventListener('keydown',this.handleHotkeys);
	},
	unmounted() {
		window.removeEventListener('keydown',this.handleHotkeys);
	},
	methods:{
		reset() {
			this.widgetGroupsInput = JSON.parse(JSON.stringify(this.widgetGroups));
		},
		
		// actions
		groupAdd() {
			this.widgetGroupsInput.push({
				title:this.capApp.groupNameNew,
				items:[]
			});
		},
		groupDel(index) {
			this.widgetGroupsInput.splice(index,1);
		},
		groupSetTitle(index,value) {
			this.widgetGroupsInput[index].title = value;
		},
		handleHotkeys(evt) {
			if(this.hasChanges && evt.ctrlKey && evt.key === 's') {
				evt.preventDefault();
				this.set();
			}
		},
		openEditMode() {
			if(this.widgetGroupsInput.length === 0)
				this.groupAdd();
			
			this.editMode = true;
		},
		widgetDel(groupIndex,widgetIndex) {
			this.widgetGroupsInput[groupIndex].items.splice(widgetIndex,1);
		},
		
		// backend calls
		set() {
			ws.send('loginWidgetGroups','set',this.widgetGroupsInput,true).then(
				res => {
					this.$store.commit('loginWidgetGroups',this.widgetGroupsInput);
					this.reset();
				},
				this.genericError
			);
		}
	}
};