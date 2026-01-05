import MyBuilderDocFields from './builderDocFields.js';

export default {
	name:'my-builder-doc-field',
	components:{},
	template:`<div class="builder-doc-field dragAnchor"
		:class="{ 'layout-flow':!template && isFlow, 'layout-grid':!template && isGrid }"
		:style
		:key="field.id"
	>
		<div class="builder-doc-field-title">{{ title }}</div>
		
		<my-builder-doc-fields
			v-if="hasChildren"
			v-model="field.fields"
			:builderLanguage
			:entityIdMapRef
			:template
		/>
	</div>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		entityIdMapRef: { type:Object,  required:false, default:() => {return {}} },
		modelValue:     { type:Object,  required:true },
		template:       { type:Boolean, required:true }
	},
	emits:['update:modelValue'],
	computed:{
		style:s => {
			return s.template || s.isFlow || s.field.sizeY === 0 ? '' : `height:${s.field.sizeY}mm`
		},
		title:s => {
			switch(s.field.content) {
				case 'data': return `${s.field.attributeIndex} ${s.attribute.name}`; break;
				case 'flow': return 'FLOW';
				case 'grid': return 'GRID';
				case 'list': return 'LIST';
				case 'text': return 'TEXT';
			}
			return '';
		},

		// inputs
		field:{ // this method updates obj directly
			get()  { return this.modelValue; },
			set(v) { this.$emit('update:modelValue',v); }
		},

		// simple
		attribute:  s => s.isData ? s.attributeIdMap[s.field.attributeId] : null,
		isData:     s => s.field.content === 'data',
		isFlow:     s => ['flow','flowBody'].includes(s.field.content),
		isGrid:     s => ['grid','gridFooter','gridHeader'].includes(s.field.content),
		hasChildren:s => !s.template && (s.isFlow || s.isGrid),

		// stores
		attributeIdMap:s => s.$store.getters['schema/attributeIdMap'],
		capApp:        s => s.$store.getters.captions.builder.doc,
		capGen:        s => s.$store.getters.captions.generic
	},
	beforeCreate() {
		// import at runtime due to circular dependencies
		this.$options.components.MyBuilderDocFields = MyBuilderDocFields;
	},
	methods:{
	}
};