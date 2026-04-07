import MyBuilderDocField from './builderDocField.js';
import MyBuilderDocSets  from './builderDocSets.js';
import MyInputDecimal    from '../inputDecimal.js';
import {
	MyBuilderDocHeaderFooter,
	MyBuilderDocMarginPadding
} from './builderDocInput.js';

const pageSizeMapMm = {
	'A1':    [594,841],
	'A2':    [420,594],
	'A3':    [297,420],
	'A4':    [210,297],
	'A5':    [148,210],
	'A6':    [105,148],
	'A7':    [74,105],
	'Legal': [216,356],
	'Letter':[216,279]
};

export default {
	name:'my-builder-doc-page',
	components:{
		MyBuilderDocField,
		MyBuilderDocSets,
		MyBuilderDocHeaderFooter,
		MyBuilderDocMarginPadding,
		MyInputDecimal
	},
	provide() {
		return {
			dragData:this.dragData,
			dragFieldIdSet:id => { this.dragData.fieldId = id }
		};
	},
	template:`<div class="builder-doc-page" v-if="page !== false" @dragover.prevent @drop.stop="drop" @click.stop="$emit('setFieldIdOptions',null)" :class="{ clickable:fieldIdOptions !== null }">
		<div class="builder-doc-page-outer" :style="stylePage">

			<div class="builder-doc-padding-margin-hor" v-if="margin.t > 0" :style="styleMarginT"></div>
			<div class="builder-doc-padding-margin-ver" v-if="margin.r > 0" :style="styleMarginR"></div>
			<div class="builder-doc-padding-margin-hor" v-if="margin.b > 0" :style="styleMarginB"></div>
			<div class="builder-doc-padding-margin-ver" v-if="margin.l > 0" :style="styleMarginL"></div>

			<div class="builder-doc-page-body" :style="styleBody">
				<my-builder-doc-field
					v-model="page.fieldFlow"
					@setFieldIdOptions="$emit('setFieldIdOptions',$event)"
					:builderLanguage
					:elmOptions="elmFieldOptions"
					:entityIdMapRef
					:fieldIdOptions
					:isRoot="true"
					:joins
					:moduleId
					:parentSizeX="pageSizeX - margin.l - margin.r"
					:parentSizeY="pageSizeY - margin.t - margin.b"
					:readonly
					:zoom
				/>
			</div>
			<div class="builder-doc-page-footer-header" v-if="header !== false && header.docPageIdInherit === null" :style="styleHeader">
				<my-builder-doc-field
					v-model="page.header.fieldGrid"
					@setFieldIdOptions="$emit('setFieldIdOptions',$event)"
					:builderLanguage
					:elmOptions="elmFieldOptions"
					:entityIdMapRef
					:fieldIdOptions
					:isRoot="true"
					:joins
					:moduleId
					:parentSizeX="pageSizeX"
					:parentSizeY="margin.t"
					:readonly
					:zoom
				/>
			</div>
			<div class="builder-doc-page-footer-header" v-if="footer !== false && footer.docPageIdInherit === null" :style="styleFooter">
				<my-builder-doc-field
					v-model="page.footer.fieldGrid"
					@setFieldIdOptions="$emit('setFieldIdOptions',$event)"
					:builderLanguage
					:elmOptions="elmFieldOptions"
					:entityIdMapRef
					:fieldIdOptions
					:isRoot="true"
					:joins
					:moduleId
					:parentSizeX="pageSizeX"
					:parentSizeY="margin.b"
					:readonly
					:zoom
				/>
			</div>
		</div>

		<!-- options -->
		<teleport v-if="elmPageOptions" :to="elmPageOptions">
			<table class="generic-table-vertical default-inputs">
				<tbody>
					<tr>
						<td>{{ capApp.button.movePage }}</td>
						<td>
							<div class="row gap">
								<my-button image="pagePrev.png" @trigger="$emit('move0')" :active="!readonly && !isPageFirst" />
								<my-button image="pageNext.png" @trigger="$emit('move1')" :active="!readonly && !isPageLast"  />
							</div>
						</td>
					</tr>
					<tr>
						<td>{{ capGen.showDefault1 }}</td>
						<td><my-bool v-model="page.state" :readonly /></td>
					</tr>
					<tr>
						<td>{{ capGen.size }}</td>
						<td>
							<div class="row gap centered">
								<select class="short" v-model="page.size" :disabled="readonly">
									<option v-for="p in pageSizes">{{ p }}</option>
								</select>
								<span>{{ pageSizeX + ' x ' + pageSizeY }}mm</span>
							</div>
						</td>
					</tr>
					<tr>
						<td>{{ capGen.orientation }}</td>
						<td>
							<select v-model="page.orientation" :disabled="readonly">
								<option value="landscape">{{ capGen.orientationLandscape }}</option>
								<option value="portrait">{{ capGen.orientationPortrait }}</option>
							</select>
						</td>
					</tr>
					<my-builder-doc-margin-padding
						v-model:t="page.margin.t"
						v-model:r="page.margin.r"
						v-model:b="page.margin.b"
						v-model:l="page.margin.l"
						@update:all="page.margin = $event"
						:defaults="{t:24,r:15,b:12,l:15}"
						:disableT="headerInherit"
						:disableB="footerInherit"
						:readonly
					/>
					<my-builder-doc-header-footer
						v-model:active="page.header.active"
						v-model:fieldGrid="page.header.fieldGrid"
						v-model:pageIdInherit="page.header.docPageIdInherit"
						:isHeader="true"
						:pages
						:pageId="page.id"
						:pageSizeX="pageSizeX"
						:readonly
					/>
					<my-builder-doc-header-footer
						v-model:active="page.footer.active"
						v-model:fieldGrid="page.footer.fieldGrid"
						v-model:pageIdInherit="page.footer.docPageIdInherit"
						:isHeader="false"
						:pages
						:pageId="page.id"
						:pageSizeX="pageSizeX"
						:readonly
					/>
				</tbody>
			</table>
			<my-builder-doc-sets
				v-model="page.sets"
				:allowData="true"
				:allowValue="true"
				:joins
				:readonly
				:showFont="true"
			/>
		</teleport>
	</div>`,
	props:{
		builderLanguage:{ type:String,        required:true },
		elmPageOptions: { required:true },
		elmFieldOptions:{ required:true },
		entityIdMapRef: { type:Object,        required:true },
		fieldIdOptions: { type:[String,null], required:true },
		joins:          { type:Array,         required:true },
		modelValue:     { type:Object,        required:true },
		moduleId:       { type:String,        required:true },
		pages:          { type:Array,         required:true },
		readonly:       { type:Boolean,       required:true },
		zoom:           { type:Number,        required:true }
	},
	emits:['move0','move1','setFieldIdOptions','update:modelValue'],
	data() {
		return {
			dragData:{
				fieldId:null // ID of field being dragged
			}
		};
	},
	computed:{
		margin:s => {
			let out = JSON.parse(JSON.stringify(s.page.margin));
			if(s.footerInherit) out.b = s.getPageMarginById(s.page.footer.docPageIdInherit).b;
			if(s.headerInherit) out.t = s.getPageMarginById(s.page.header.docPageIdInherit).t;
			return out;
		},

		// inputs
		page:{ // this method updates obj directly
			get()  { return this.modelValue; },
			set(v) { this.$emit('update:modelValue',v); }
		},

		// simple
		footer:       s => s.page.footer.active ? s.page.footer : false,
		footerInherit:s => s.page.footer.docPageIdInherit !== null,
		header:       s => s.page.header.active ? s.page.header : false,
		headerInherit:s => s.page.header.docPageIdInherit !== null,
		isPageFirst:  s => s.pages.findIndex(v => v.id === s.page.id) === 0,
		isPageLast:   s => s.pages.findIndex(v => v.id === s.page.id) === s.pages.length -1,
		pageSizeX:    s => s.page.orientation === 'portrait' ? pageSizeMapMm[s.page.size][0] : pageSizeMapMm[s.page.size][1],
		pageSizeY:    s => s.page.orientation === 'portrait' ? pageSizeMapMm[s.page.size][1] : pageSizeMapMm[s.page.size][0],
		pageSizes:    s => Object.keys(pageSizeMapMm),
		styleBody:    s => `top:${s.margin.t*s.zoom}mm;right:${s.margin.r*s.zoom}mm;bottom:${s.margin.b*s.zoom}mm;left:${s.margin.l*s.zoom}mm`,
		styleFooter:  s => `width:${s.pageSizeX*s.zoom}mm;bottom:0mm;left:0mm;height:${s.margin.b*s.zoom}mm`,
		styleHeader:  s => `width:${s.pageSizeX*s.zoom}mm;top:0mm;left:0mm;height:${s.margin.t*s.zoom}mm`,
		styleMarginT: s => `top:0mm;left:0mm;height:${s.margin.t*s.zoom}mm`,
		styleMarginR: s => `top:0mm;right:0mm;width:${s.margin.r*s.zoom}mm`,
		styleMarginB: s => `bottom:0mm;left:0mm;height:${s.margin.b*s.zoom}mm`,
		styleMarginL: s => `top:0mm;left:0mm;width:${s.margin.l*s.zoom}mm`,
		stylePage:    s => `width:${s.pageSizeX*s.zoom}mm;height:${s.pageSizeY*s.zoom}mm`,

		// stores
		capApp:s => s.$store.getters.captions.builder.doc,
		capGen:s => s.$store.getters.captions.generic
	},
	methods:{
		drop(e) {
			if(e.dataTransfer.types.includes('doc-field')) {
				const field = JSON.parse(e.dataTransfer.getData('application/json'));
				if(field.id === this.fieldIdOptions)
					this.$emit('setFieldIdOptions',null);

				this.dragData.fieldId = null;
			}
		},
		getPageMarginById(id) {
			const ind = this.pages.findIndex(v => v.id === id);
			return ind === -1 ? {t:0,r:0,b:0,l:0} : this.pages[ind].margin;
		}
	}
};