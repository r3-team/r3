import {getCaption} from './shared/language.js';
import {
	getQueryExpressions,
	getRelationsJoined
} from './shared/query.js';
import {
	getUnixFormat,
	getUnixShifted,
	getUtcTimeStringFromUnix
} from './shared/time.js';

export default {
	name:'my-chart',
	components:{ echarts:VueECharts },
	template:`<div class="chart">
		<div class="input-toolbar default-inputs" v-if="needsHeader || hasChoices">
			<div></div>
			<select class="auto"
				@change="$emit('set-login-option','choiceId',$event.target.value)"
				v-if="hasChoices"
				:value="choiceId"
			>
				<option v-for="c in choices" :value="c.id">
					{{ getCaption('queryChoiceTitle',moduleId,c.id,c.captions,c.name) }}
				</option>
			</select>
		</div>
		<echarts ref="chart"
			v-if="ready"
			:option="option"
			:theme="settings.dark ? 'dark' : ''"
		/>
	</div>`,
	props:{
		choices:        { type:Array,   required:false, default:() => [] },
		columns:        { type:Array,   required:true },
		filters:        { type:Array,   required:true },
		formLoading:    { type:Boolean, required:true },
		isHidden:       { type:Boolean, required:true },
		limit:          { type:Number,  required:true },
		loginOptions:   { type:Object,  required:true },
		moduleId:       { type:String,  required:true },
		needsHeader:    { type:Boolean, required:true },
		optionJson:     { type:String,  required:true },  // general chart options object, as JSON
		optionOverwrite:{ required:false, default:null }, // overwrite entire echarts option object (incl. data)
		query:          { type:Object,  required:true }
	},
	emits:['set-login-option'],
	data() {
		return {
			option:{},
			ready:false
		};
	},
	computed:{
		dateTimeColumnIndexes:(s) => {
			let out = [];
			for(let i = 0, j = s.columns.length; i < j; i++) {
				let atr = s.attributeIdMap[s.columns[i].attributeId];
				if(['datetime','date','time'].includes(atr.contentUse))
					out.push(i);
			}
			return out;
		},
		
		// simple
		hasChoices:  (s) => s.choices.length > 1 && !s.hasOverwrite,
		hasOverwrite:(s) => s.optionOverwrite !== null,

		// login options
		choiceId:(s) => s.$root.getOrFallback(s.loginOptions,'choiceId',s.choices.length === 0 ? null : s.choices[0].id),
		
		// stores
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		appResized:    (s) => s.$store.getters.appResized,
		settings:      (s) => s.$store.getters.settings
	},
	mounted() {
		// setup watchers
		this.$watch('appResized',this.resized);
		this.$watch('formLoading',val => {
			if(!val) this.get();
		});
		this.$watch('isHidden',val => {
			if(!val) this.$nextTick(this.resized);
		});
		this.$watch('optionOverwrite',val => {
			if(val !== null) {
				this.option = this.optionOverwrite;
				this.ready  = true;
			}
		});
		this.$watch(() => [this.columns,this.filters],(newVals,oldVals) => {
			for(let i = 0, j = newVals.length; i < j; i++) {
				if(JSON.stringify(newVals[i]) !== JSON.stringify(oldVals[i]))
					return this.get();
			}
		});

		// set option overwrite, if enabled
		if(this.optionOverwrite !== null) {
			this.option = this.optionOverwrite;
			this.ready  = true;
		}
	},
	methods:{
		// externals
		getCaption,
		getQueryExpressions,
		getRelationsJoined,
		getUnixFormat,
		getUnixShifted,
		getUtcTimeStringFromUnix,
		
		// actions
		resized() {
			if(typeof this.$refs.chart !== 'undefined')
				this.$refs.chart.resize();
		},
		
		// backend calls
		get() {
			// no need to fetch data if entire options object (incl. data) is overwritten
			if(this.hasOverwrite)
				return;

			ws.send('data','get',{
				relationId:this.query.relationId,
				joins:this.getRelationsJoined(this.query.joins),
				expressions:this.getQueryExpressions(this.columns),
				filters:this.filters,
				orders:this.query.orders,
				limit:this.limit
			},true).then(
				res => {
					// option overwrites
					this.option = JSON.parse(this.optionJson);
					
					// overwrite font styles
					if(typeof this.option.textStyle === 'undefined')
						this.option.textStyle = {};
					
					this.option.textStyle.fontFamily = 'Roboto,Arial,Helvetica,sans-serif';
					this.option.textStyle.fontSize = 14 * this.settings.fontSize / 100;
					
					// overwrite background if not set (dark mode is not transparent)
					if(typeof this.option.backgroundColor === 'undefined')
						this.option.backgroundColor = 'transparent';
					
					// set dataset defaults if empty
					// source header is false, otherwise first column will be used as dimension name
					if(typeof this.option.dataset === 'undefined')
						this.option.dataset = {
							source:[],
							sourceHeader:false
						};
					
					// overwrite dataset source with query data (currently only 1 dataset is usable)
					this.option.dataset.source = [];
					for(let row of res.payload.rows) {
						
						// apply date|time column display options
						if(this.dateTimeColumnIndexes.length !== 0) {
							for(const columnIndex of this.dateTimeColumnIndexes) {
								const atr   = this.attributeIdMap[this.columns[columnIndex].attributeId];
								let   value = row.values[columnIndex];
								
								switch(atr.contentUse) {
									case 'date':     value = this.getUnixFormat(this.getUnixShifted(value,true),'Y-m-d'); break;
									case 'datetime': value = this.getUnixFormat(value,'Y-m-d H:i');                       break;
									case 'time':     value = this.getUtcTimeStringFromUnix(value);                        break;
								}
								row.values[columnIndex] = value;
							}
						}
						this.option.dataset.source.push(row.values);
					}
					this.ready = true;
				},
				this.$root.genericError
			);
		}
	}
};