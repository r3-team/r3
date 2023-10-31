import { getCaption } from './shared/language.js';
import srcBase64Icon  from './shared/image.js';
import MyForm from './form.js';
export {MyWidgets as default};

let MyWidget = {
	name:'my-widget',
	components:{ MyForm },
	template:`<div class="widget">
		<div class="header" :style="headerStyle">
			<img class="dragAnchor" src="images/drag.png" v-if="editMode" />
			<span v-if="moduleWidget !== false">{{ getCaption(moduleWidget.captions.widgetTitle,'') }}</span>
		</div>
		<div class="content">
			
			<!-- system widget: module menu -->
			<div class="system-module-menu" v-if="moduleEntry !== false">
				
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
			
			<!-- system widget: login details -->
			
			<!-- form -->
			<my-form
				v-if="form !== false"
				:formId="form.id"
				:isWidget="true"
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
		icon:(s) => {
			
		},
		title:(s) => {
			// use most specific title in order: Widget title, form title, collection title, widget name
			let t = '';
			if(s.moduleWidget !== false)
				t = s.getCaption(s.moduleWidget.captions.widgetTitle,'');
			
			if(t === '' && s.form !== false)
				t = s.getCaption(s.form.captions.formTitle, '');
			
			if(t === '' && s.collection !== false)
				t = s.getCaption(s.collection.captions.collectionTitle, '');
			
			if(t === '')
				t = s.moduleWidget.name;
			
			return t;
		},
		
		// simple
		headerStyle:(s) => s.moduleEntry !== false ? s.moduleEntry.styleBg : '',
		isSystem:   (s) => s.widget.content.startsWith('system'),
		
		// entities
		collection:  (s) => s.moduleWidget === false || s.moduleWidget.collectionId === null ? false : s.collectionIdMap[s.moduleWidget.collectionId],
		form:        (s) => s.moduleWidget === false || s.moduleWidget.formId       === null ? false : s.formIdMap[s.moduleWidget.formId],
		moduleWidget:(s) => s.widget.widgetId === null ? false : s.widgetIdMap[s.widget.widgetId],
		moduleEntry: (s) => {
			if(s.widget.content !== 'systemModuleMenu')
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
		widgetIdMap:    (s) => s.$store.getters['schema/widgetIdMap'],
		moduleEntries:  (s) => s.$store.getters.moduleEntries
	},
	mounted() {
	},
	methods:{
		// externals
		getCaption,
		srcBase64Icon
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
			<my-button image="delete.png"
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
	emits:['remove','set-title'],
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
		
		<my-button image="edit.png"
			v-if="!editMode"
			@trigger="openEditMode"
			:caption="capGen.button.edit"
		/>
		<draggable class="widget-groups" handle=".dragAnchor" group="widget-groups" itemKey="id" animation="150" direction="vertical"
			:list="widgetGroupsInput"
		>
			<template #item="{element,index}">
				<my-widget-group
					@remove="groupDel(index)"
					@set-title="groupSetTitle(index,$event)"
					:editMode="editMode"
					:widgetGroup="element"
				/>
			</template>
		</draggable>
		
		<div class="widgets-sidebar" :class="{ shown:editMode }" v-if="editMode">
			<div class="row gap">
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
	data() {
		return {
			editMode:false,
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
		modules:      (s) => s.$store.getters['schema/modules'],
		capApp:       (s) => s.$store.getters.captions.widgets,
		capGen:       (s) => s.$store.getters.captions.generic,
		moduleEntries:(s) => s.$store.getters.moduleEntries,
		widgetGroups: (s) => s.$store.getters.loginWidgetGroups
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
			this.widgetGroupsInput.splice(index,1);
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