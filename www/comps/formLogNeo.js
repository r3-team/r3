import {getUnixFormat} from './shared/time.js';
export default {
	name:'my-form-log-neo',
	template:`<div class="app-sub-window under-header" @mousedown.left.self="$emit('close')">
		<div class="contentBox float">
			<table>
				<thead>
					<tr>
						<td>{{ capGen.date }}</td>
						<td>-</td>
						<td>{{ capGen.record }}</td>
						<td>{{ capGen.value }}</td>
					</tr>
				</thead>
				<tbody>
					<tr v-for="l in logs">
						<td>{{ getUnixFormat(l.dateChange,settings.dateFormat + ' H:i:S') }}</td>
						<td>{{ l.loginName }}</td>
						<td>{{ l.relationId + '_' + l.recordId }}</td>
						<td>
							<table>
								<tbody>
									<tr v-for="a in l.attributes">
										<td>{{ a.id }}</td>
										<td>{{ a.value }}</td>
									</tr>
								</tbody>
							</table>
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>`,
	props:{
		entityIdMapEffect:{ type:Object, required:true },
		fields:           { type:Array,  required:true },
		joinsIndexMap:    { type:Object, required:true },

		/*
		indexMapRecordKey:  { type:Object,  required:true },
		moduleId:           { type:String,  required:true }
		*/
	},
	emits:['close'],
	data() {
		return {
			logs:[]
		};
	},
	computed:{
		sources:s => { // [ { fieldId:null, index:0, recordIds:[], attributeIds:[] } ]
			let out = [];

			const parseFields = fields => {
				for(const f of fields) {
					switch(f.content) {
						case 'container':
							parseFields(f.fields);
						break;
						case 'tabs':
							for(const t of f.tabs) {
								parseFields(t.fields);
							}
						break;
						case 'data':
							// if field join index is available & field is accessible
							const src = out.find(v => v.fieldId === null && v.index === f.index);
							if(src !== undefined && !src.attributeIds.includes(f.attributeId)) {
		
								const state = s.entityIdMapEffect.field[f.id] !== undefined
									? s.entityIdMapEffect.field[f.id] : f.state;
								
								if(state !== 'hidden')
									src.attributeIds.push(f.attributeId);
							}
						break;
						case 'list':

						break;
					}
				}
			};
			
			for(const k in s.joinsIndexMap) {	
				const j = s.joinsIndexMap[k];

				if(j.recordId !== 0)
					out.push({
						fieldId:null,
						index:j.index,
						recordIds:[j.recordId],
						attributeIds:[]
					});
			}
			parseFields(s.fields);
			return out;
		},

		// stores
		capGen:  s => s.$store.getters.captions.generic,
		settings:s => s.$store.getters.settings
	},
	mounted() {
		this.get(false);
	},
	methods:{
		// externals
		getUnixFormat,

		// actions

		// backend calls
		get(isNextPage) {
			let requests = [];

			// copy sources in cases it changes before responses come back (need to match request response to each source)
			const sources = JSON.parse(JSON.stringify(this.sources));
			for(const src of sources) {
				if(src.recordIds.length === 0 || src.attributeIds.length === 0)
					continue;

				requests.push(ws.prepare('data','getLog',{
					recordIds:src.recordIds,
					attributeIds:src.attributeIds
				}));
			}
			
			if(requests.length === 0)
				return;

			ws.sendMultiple(requests,true).then(
				async responses => {
					let logs = [];
					for(const res of responses) {

						// decrypt values

						logs = logs.concat(res.payload);
					}

					// sort logs by date change (separate requests are sorted individually, but not together)
					logs.sort((a,b) => a.dateChange - b.dateChange);

					// fetch record titles

					// apply processed logs
					if(!isNextPage) this.logs = logs;
					else            this.logs.concat(logs);
				},
				this.$root.genericError
			);
		}
	}
};