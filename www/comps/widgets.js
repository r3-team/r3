import { getCaption } from './shared/language.js';
import MyForm from './form.js';
export {MyWidgets as default};

let MyWidget = {
	name:'my-widget',
	components:{ MyForm },
	template:`<div class="widget">
		<div class="header" v-if="moduleWidget !== false">
			<div class="row gap centered">
				<img src="" />
				<span>{{ getCaption(moduleWidget.captions,'') }}</span>
			</div>
		</div>
		<div class="content">
			
			<!-- system widget: module menu -->
			
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
		widget:{ type:Object, required:true }
	},
	computed:{
		// stores
		formIdMap:   (s) => s.$store.getters['schema/formIdMap'],
		widgetIdMap: (s) => s.$store.getters['schema/formIdMap'],
		form:        (s) => s.widget.formId   === null ? false : s.formIdMap[s.widget.formId],
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
		<span class="widget-group-title"></span>
		<div class="widget-group-items">
			<my-widget
				v-for="w in widgetGroup.items"
				:widget="w"
			/>
		</div>
	</div>`,
	props:{
		widgetGroup:{ type:Object, required:true }
	}
};

let MyWidgets = {
	name:'my-widgets',
	components:{
		MyWidget,
		MyWidgetGroup
	},
	template:`<div class="widgets">
		<div class="widget-groups">
			<my-widget-group
				v-for="g in widgetGroups"
				:group="g"
			/>
		</div>
		<div class="widgets-sidebar">
			<my-button image="edit.png"
				@trigger="editMode = !editMode"
				:caption="capGen.button.edit"
			/>
			
			<template v-if="editMode">
				<my-widget
					v-for="w in widgetTemplates"
					:widget="w"
				/>
			</template>
		</div>
	</div>`,
	props:{
		moduleEntries:{ type:Array, required:true }
	},
	data() {
		return {
			editMode:false
		};
	},
	mounted() {
		console.log(this.widgetTemplates);
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
		
		// stores
		modules:     (s) => s.$store.getters['schema/modules'],
		capGen:      (s) => s.$store.getters.captions.generic,
		widgetGroups:(s) => s.$store.getters.loginWidgetGroups
	}
};