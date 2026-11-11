import { setGetterArgs } from './shared/form.js';
import { srcBase64 } from './shared/image.js';
import { getCaption } from './shared/language.js';

const MyFormAction = {
	name: 'my-form-action',
	template: `<my-button
		v-if="state !== 'hidden'"
		@trigger="exec(false)"
		@trigger-middle="exec(true)"
		:active="state !== 'readonly'"
		:caption="getCaption('formActionTitle',moduleId,formAction.id,formAction.captions)"
		:imageBase64="formAction.iconId ? srcBase64(iconIdMap[formAction.iconId].file) : ''"
		:large
	/>`,
	props: {
		entityIdMapEffect: { type: Object, required: true },
		formAction: { type: Object, required: true },
		formId: { type: String, required: true },
		joinsIndexMap: { type: Object, required: true },
		large: { type: Boolean, required: true },
		moduleId: { type: String, required: true }
	},
	emits: ['executed', 'executeFunction', 'openDoc', 'openForm'],
	computed: {
		state: s => s.entityIdMapEffect.formAction[s.formAction.id]?.state !== undefined
			? s.entityIdMapEffect.formAction[s.formAction.id].state
			: s.formAction.state,

		// stores
		iconIdMap: s => s.$store.getters['schema/iconIdMap']
	},
	methods: {
		// external
		getCaption,
		setGetterArgs,
		srcBase64,

		// actions
		exec(middleClick) {
			const fa = this.formAction;
			if (fa.jsFunctionId !== null) this.$emit('executeFunction', fa.jsFunctionId);
			if (fa.openDoc !== null) this.$emit('openDoc', null, fa.openDoc);

			if (fa.openForm !== null) {
				let getterArgs = [];

				if (fa.openForm.attributeIdApply !== null
					&& this.joinsIndexMap[fa.openForm.relationIndexApply] !== undefined
					&& this.joinsIndexMap[fa.openForm.relationIndexApply].recordId !== 0
				) {
					const atrId = fa.openForm.attributeIdApply;
					const recordId = this.joinsIndexMap[fa.openForm.relationIndexApply].recordId;

					getterArgs = this.setGetterArgs(getterArgs, 'attributes', `${atrId}_${recordId}`);
				}
				this.$emit('openForm', [], fa.openForm, getterArgs, middleClick, null, false);
			}
			this.$emit('executed');
		}
	}
};

export default {
	name: 'my-form-actions',
	components: { MyFormAction },
	template: `<div class="row gap nowrap"
		:class="{ 'form-actions-left':settings.formActionsAlign === 'left', 'form-actions-right':settings.formActionsAlign === 'right' }"
	>
		<my-form-action
			v-if="!noSpace"
			v-for="a in formActions"
			@executeFunction="$emit('executeFunction',$event)"
			@openDoc="(...args) => $emit('openDoc',...args)"
			@openForm="(...args) => $emit('openForm',...args)"
			:entityIdMapEffect
			:formAction="a"
			:formId
			:joinsIndexMap
			:large="false"
			:moduleId
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
							@executed="showPopUp = false"
							@executeFunction="$emit('executeFunction',$event)"
							@openDoc="(...args) => $emit('openDoc',...args)"
							@openForm="(...args) => $emit('openForm',...args)"
							:entityIdMapEffect
							:formAction="a"
							:formId
							:joinsIndexMap
							:large="true"
							:moduleId
						/>
					</div>
				</div>
			</div>
		</div>
	</div>`,
	props: {
		entityIdMapEffect: { type: Object, required: true },
		formActions: { type: Array, required: true },
		formId: { type: String, required: true },
		joinsIndexMap: { type: Object, required: true },
		moduleId: { type: String, required: true },
		noSpace: { type: Boolean, required: true }
	},
	emits: ['executeFunction', 'openDoc', 'openForm'],
	data() {
		return {
			showPopUp: false,
		};
	},
	computed: {
		capGen: s => s.$store.getters.captions.generic,
		settings: s => s.$store.getters.settings
	}
};
