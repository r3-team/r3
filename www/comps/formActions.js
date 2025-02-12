import {srcBase64}  from './shared/image.js';
import {getCaption} from './shared/language.js';
export {MyFormActions as default};

let MyFormAction = {
	name:'my-form-action',
	template:`<my-button
		v-if="state !== 'hidden'"
		@trigger="$emit('execute-function',formAction.jsFunctionId)"
		:active="state !== 'readonly'"
		:caption="getCaption('formActionTitle',moduleId,formAction.id,formAction.captions)"
		:imageBase64="formAction.iconId ? srcBase64(iconIdMap[formAction.iconId].file) : ''"
		:large="large"
	/>`,
	props:{
		entityIdMapEffect:{ type:Object,  required:true },
		formAction:       { type:Object,  required:true },
		formId:           { type:String,  required:true },
		large:            { type:Boolean, required:true },
		moduleId:         { type:String,  required:true }
	},
	emits:['execute-function'],
	computed:{
		state:(s) => s.entityIdMapEffect.formAction[s.formAction.id]?.state !== undefined
			? s.entityIdMapEffect.formAction[s.formAction.id].state
			: s.formAction.state,
		
		// stores
		iconIdMap:(s) => s.$store.getters['schema/iconIdMap']
	},
	methods:{
		// external
		getCaption,
		srcBase64
	}
};

let MyFormActions = {
	name:'my-form-actions',
	components:{ MyFormAction },
	template:`<div class="row gap nowrap"
		:class="{ 'form-actions-left':settings.formActionsAlign === 'left', 'form-actions-right':settings.formActionsAlign === 'right' }"
	>
		<my-form-action
			v-if="!noSpace"
			v-for="a in formActions"
			@execute-function="$emit('execute-function',$event)"
			:entityIdMapEffect="entityIdMapEffect"
			:formAction="a"
			:formId="formId"
			:moduleId="moduleId"
			:large="false"
		/>
		<my-button image="open.png"
			@trigger="showPopUp = true"
			v-if="noSpace"
			:caption="capGen.actions"
		/>

		<div class="app-sub-window at-top under-header"
			v-if="showPopUp"
			@click.self.stop="showPopUp = false"
		>
			<div class="form-actions-pop-up contentBox float scroll">
				<div class="top lower">
					<div class="area">
						<img class="icon" src="images/fileText.png" />
						<div class="caption">{{ capGen.formActions }}</div>
					</div>
					<my-button image="cancel.png"
						@trigger="showPopUp = false"
						:blockBubble="true"
						:cancel="true"
					/>
				</div>
				<div class="content">
					<div class="form-actions-pop-up-entries">
						<my-form-action
							v-for="a in formActions"
							@execute-function="$emit('execute-function',$event);showPopUp = false"
							:entityIdMapEffect="entityIdMapEffect"
							:formAction="a"
							:formId="formId"
							:moduleId="moduleId"
							:large="true"
						/>
					</div>
				</div>
			</div>
		</div>
	</div>`,
	props:{
		entityIdMapEffect:{ type:Object,  required:true },
		formActions:      { type:Array,   required:true },
		formId:           { type:String,  required:true },
		moduleId:         { type:String,  required:true },
		noSpace:          { type:Boolean, required:true }
	},
	emits:['execute-function'],
	data() {
		return {
			showPopUp:false,
		};
	},
	computed:{
		capGen:  (s) => s.$store.getters.captions.generic,
		settings:(s) => s.$store.getters.settings
	}
};