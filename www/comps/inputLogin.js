import MyInputSelect from './inputSelect.js';
export {MyInputLogin as default};

let MyInputLogin = {
	name:'my-input-login',
	components:{ MyInputSelect },
	template:`<my-input-select
		v-if="inputText !== null"
		v-model:selected="loginId"
		@request-data="get"
		@updated-text-input="inputText = $event"
		:idsExclude="idsExclude"
		:inputTextSet="inputTextSet"
		:options="logins"
		:placeholder="placeholder"
		:readonly="readonly"
	/>`,
	props:{
		clearInput:  { type:Boolean, required:false, default:false }, // keep text input clear
		idsExclude:  { type:Array,   required:false, default:() => [] },
		modelValue:  { required:true },
		noLdapAssign:{ type:Boolean, required:false, default:false },
		placeholder: { type:String,  required:false, default:'' },
		readonly:    { type:Boolean, required:false, default:false }
	},
	emits:['blurred','focused','update:modelValue'],
	watch:{
		loginId:{
			handler:function(valNew,valOld) {
				if(valNew === null)
					return this.inputTextSet = '';
				
				if(valNew !== valOld && !this.clearInput)
					this.getName();
			},
			immediate:true
		}
	},
	data:function() {
		return {
			inputText:'',
			inputTextSet:'',
			logins:[] // [{'id':123,'name':admin},...]
		};
	},
	computed:{
		loginId:{
			get:function()  { return this.modelValue; },
			set:function(v) {
				this.$emit('update:modelValue',v);
				
				if(this.clearInput)
					this.inputTextSet = '';
			}
		}
	},
	methods:{
		get:function() {
			// if login is set, exclude ID
			let idsExclude = this.loginId !== null
				? this.idsExclude.concat([this.loginId]) : this.idsExclude;
			
			ws.send('login','getNames',{
				byString:this.inputText,
				idsExclude:idsExclude,
				noLdapAssign:this.noLdapAssign
			},true).then(
				(res) => this.logins = res.payload,
				(err) => this.$root.genericError(err)
			);
		},
		getName:function() {
			ws.send('login','getNames',{
				id:this.loginId,
				noLdapAssign:this.noLdapAssign
			},true).then(
				(res) => {
					if(res.payload.length === 1)
						this.inputTextSet = res.payload[0].name;
				},
				(err) => this.$root.genericError(err)
			);
		}
	}
};