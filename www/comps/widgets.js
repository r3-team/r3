import { getCaption } from './shared/language.js';
import MyForm from './form.js';
export {MyWidgets as default};

let MyWidget = {
	name:'my-widget',
	components:{ MyForm },
	template:`<div class="widget">
		<div class="header">
			<div class="row gap centered">
				<img class="dragAnchor" src="images/drag.png" v-if="editMode" />
				<span v-if="moduleWidget !== false">{{ getCaption(moduleWidget.captions,'') }}</span>
			</div>
		</div>
		<div class="content">
			
			<!-- system widget: module menu -->
			<div v-if="isSystem">
				SYSTEM WIDGET
			</div>
			
			<!-- system widget: login details -->
			
			<!-- form -->
			<my-form
				v-if="form !== false"
				:formId="form.id"
				:moduleId="form.moduleId"
				:recordIds="[]"
			/>
			
			<!-- collection -->
		</div>
	</div>`,
	props:{
		editMode:{ type:Boolean, required:true },
		widget:  { type:Object,  required:true }
	},
	computed:{
		// simple
		isSystem:(s) => s.widget.content.startsWith('system'),
		
		// stores
		formIdMap:   (s) => s.$store.getters['schema/formIdMap'],
		widgetIdMap: (s) => s.$store.getters['schema/widgetIdMap'],
		form:        (s) => s.moduleWidget === false || s.moduleWidget.formId === null ? false : s.formIdMap[s.moduleWidget.formId],
		moduleWidget:(s) => s.widget.widgetId === null ? false : s.widgetIdMap[s.widget.widgetId]
	},
	methods:{
		// externals
		getCaption
	}
};

let MyWidgetGroup = {
	name:'my-widget-group',
	components:{ MyWidget },
	template:`<div class="widget-group">
		<div class="widget-group-title default-inputs">
			<img class="dragAnchor" src="images/drag.png" v-if="editMode" />
			<span v-if="!editMode">{{ widgetGroup.title }}</span>
			<input v-if="editMode" @input="$emit('set-title',$event.target.value)" :value="widgetGroup.title" />
		</div>
		
		<draggable class="widget-group-items" handle=".dragAnchor" group="widget-group-items" itemKey="id" animation="150"
			:list="widgetGroup.items"
		>
			<template #item="{element,index}">
				<my-widget
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
	emits:['set-title'],
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
		<draggable class="widget-groups" handle=".dragAnchor" group="widget-groups" itemKey="id" animation="150" direction="vertical"
			:list="widgetGroupsInput"
		>
			<template #item="{element,index}">
				<my-widget-group
					@set-title="groupSetTitle(index,$event)"
					:editMode="editMode"
					:widgetGroup="element"
				/>
			</template>
		</draggable>
		
		<div class="widgets-sidebar">
			<div class="row gap">
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
			
			<draggable class="widget-group-items" handle=".dragAnchor" group="widget-group-items" itemKey="id" animation="150"
				v-if="editMode"
				:list="widgetTemplates"
			>
				<template #item="{element,index}">
					<my-widget
						:editMode="editMode"
						:widget="element"
					/>
				</template>
			</draggable>
		</div>
	</div>`,
	props:{
		moduleEntries:{ type:Array, required:true }
	},
	data() {
		return {
			editMode:true,
			widgetGroupsInput:[] // widget groups, updated by user input
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
		widgetIdsUsed:(s) => {
			let out = [];
			for(const g of s.widgetGroups) {
				for(const w of g.items) {
					if(w.widgetId !== null)
						out.push(w.widgetId);
				}
			}
			return out;
		},
		widgetTemplates:(s) => {
			let out = [];
			
			// system widget: login details
			out.push({
				content:'systemLoginDetails',
				moduleId:null,
				widgetId:null
			});
			
			// system widget: module menu
			for(const m of s.modules) {
				if(!s.moduleIdsAccessible.includes(m.id))
					continue;
				
				out.push({
					content:'systemModuleMenu',
					moduleId:m.id,
					widgetId:null
				});
			}
			
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
			return out;
		},
		
		// simple
		hasChanges:(s) => JSON.stringify(s.widgetGroups) !== JSON.stringify(s.widgetGroupsInput),
		
		// stores
		modules:     (s) => s.$store.getters['schema/modules'],
		capApp:      (s) => s.$store.getters.captions.widgets,
		capGen:      (s) => s.$store.getters.captions.generic,
		widgetGroups:(s) => s.$store.getters.loginWidgetGroups
	},
	mounted() {
		this.reset();
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
			this.widgetGroupsInput.splice(i,1);
		},
		groupSetTitle(index,value) {
			this.widgetGroupsInput[index].title = value;
		},
		openEditMode() {
			if(this.widgetGroupsInput.length === 0)
				this.groupAdd();
			
			this.editMode = true;
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