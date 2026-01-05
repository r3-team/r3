import MyBuilderDocSets from './builderDocSets.js';
import MyInputDecimal   from '../inputDecimal.js';

const pageSizeMapMm = {
	'A1':    [594,841],
	'A2':    [420,594],
	'A3':    [297,420],
	'A4':    [210,297],
	'A5':    [148,210],
	'A6':    [105,148],
	'A7':    [74,105],
	'Legal': [216,356],
	'Letter':[216,279],
};

export default {
	name:'my-builder-doc-page',
	components:{
		MyBuilderDocSets,
		MyInputDecimal
	},
	template:`<div class="builder-doc-page" v-if="page !== false">
		<div class="builder-doc-page-outer" :style="stylePage">
			<div class="builder-doc-page-footer-header" v-if="header !== false && header.docPageIdInherit === null" :style="styleHeader"></div>
			<div class="builder-doc-page-margin-hor" v-if="margin.l > 0" :style="styleMarginT"></div>
			<div class="builder-doc-page-margin-ver" v-if="margin.r > 0" :style="styleMarginR"></div>
			<div class="builder-doc-page-margin-hor" v-if="margin.b > 0" :style="styleMarginB"></div>
			<div class="builder-doc-page-margin-ver" v-if="margin.l > 0" :style="styleMarginL"></div>
			<div class="builder-doc-page-footer-header" v-if="footer !== false && footer.docPageIdInherit === null" :style="styleFooter"></div>

			<div class="builder-doc-page-body"></div>
		</div>

		<!-- options -->
		<teleport v-if="pageOptionsElm" :to="pageOptionsElm">
			<table class="generic-table-vertical default-inputs">
				<tbody>
					<tr>
						<td>{{ capGen.showDefault1 }}</td>
						<td><my-bool v-model="page.state" :disabled="readonly"/></td>
					</tr>
					<tr>
						<td>{{ capGen.size }}</td>
						<td>
							<select v-model="page.size" :disabled="readonly">
								<option v-for="p in pageSizes">{{ p }}</option>
							</select>
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
					<tr>
						<td>{{ capGen.spacing }}</td>
						<td>
							<my-input-decimal class="short" v-model="page.margin.t" :readonly :allowNull="false" :length="5" :lengthFract="2" />
							<my-input-decimal class="short" v-model="page.margin.r" :readonly :allowNull="false" :length="5" :lengthFract="2" />
							<my-input-decimal class="short" v-model="page.margin.b" :readonly :allowNull="false" :length="5" :lengthFract="2" />
							<my-input-decimal class="short" v-model="page.margin.l" :readonly :allowNull="false" :length="5" :lengthFract="2" />
						</td>
					</tr>
					<my-builder-doc-sets
						v-model="page.sets"
						:allowData="true"
						:allowValue="true"
						:joins
						:readonly
						:targetsFont="true"
					/>
				</tbody>
			</table>
		</teleport>
	</div>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		joins:          { type:Array,   required:true },
		modelValue:     { type:Object,  required:true },
		pageOptionsElm: { required:true },
		readonly:       { type:Boolean, required:true }
	},
	emits:['update:modelValue'],
	computed:{
		page:{ // this method updates obj directly
			get()  { return this.modelValue; },
			set(v) { this.$emit('update:modelValue',v); }
		},

		// simple
		footer:      s => s.page.footer.active ? s.page.footer : false,
		header:      s => s.page.header.active ? s.page.header : false,
		margin:      s => s.page.margin,
		pageSizeX:   s => s.page.orientation === 'portrait' ? pageSizeMapMm[s.page.size][0] : pageSizeMapMm[s.page.size][1],
		pageSizeY:   s => s.page.orientation === 'portrait' ? pageSizeMapMm[s.page.size][1] : pageSizeMapMm[s.page.size][0],
		pageSizes:   s => Object.keys(pageSizeMapMm),
		styleFooter: s => `bottom:0px;left:0px;height:${s.footer.fieldGrid.SizeY}mm`,
		styleHeader: s => `top:0px;left:0px;height:${s.header.fieldGrid.SizeY}mm`,
		styleMarginT:s => `top:0px;left:0px;height:${s.margin.t}mm`,
		styleMarginR:s => `top:0px;right:0px;width:${s.margin.r}mm`,
		styleMarginB:s => `bottom:0px;left:0px;height:${s.margin.b}mm`,
		styleMarginL:s => `top:0px;left:0px;width:${s.margin.l}mm`,
		stylePage:   s => `width:${s.pageSizeX}mm;height:${s.pageSizeY}mm`,

		// stores
		capApp:s => s.$store.getters.captions.builder.doc,
		capGen:s => s.$store.getters.captions.generic
	},
	methods:{
		// actions
		update() {
			this.$emit('update:modelValue',v);
		}
	}
};