export default {
	name:'my-list-input-rows-empty',
	template:`<table class="list-input-rows"
		@click="$emit('clicked')"
		:class="{ clickable:!readonly }"
	>
		<tbody>
			<tr>
				<td class="minimum">
					<slot name="input-icon" />
				</td>
				<td>
					<div class="list-input-row-items">
						<input class="input" data-is-input="1" data-is-input-empty="1" enterkeyhint="send"
							@click="$emit('focus')"
							@focus="$emit('focus')"
							@input="$emit('text-updated',$event.target.value)"
							@keyup="$emit('key-pressed',$event)"
							:class="{ invalid:!valid }"
							:disabled="readonly"
							:placeholder="placeholder"
							:tabindex="!readonly ? 0 : -1"
							:value="text"
						/>
					</div>
				</td>
				<td class="minimum">
					<div class="list-input-row-items nowrap">
						<my-button image="add.png"
							v-if="!readonly && showCreate"
							@trigger="$emit('clicked-open')"
							@trigger-middle="$emit('clicked-open-middle')"
							:blockBubble="true"
							:captionTitle="capApp.inputHintCreate"
							:naked="true"
						/>
						<my-button image="pageDown.png"
							:active="!readonly"
							:naked="true"
						/>
					</div>
				</td>
			</tr>
		</tbody>
	</table>`,
	props:{
		anyRows:   { type:Boolean, required:true },
		focused:   { type:Boolean, required:true },
		readonly:  { type:Boolean, required:true },
		text:      { type:String,  required:true },
		showCreate:{ type:Boolean, required:true },
		valid:     { type:Boolean, required:true }
	},
	emits:['clicked','clicked-open','clicked-open-middle','focus','key-pressed','text-updated'],
	computed:{
		placeholder:(s) => s.focused ? '' : (s.anyRows ? s.capApp.inputPlaceholderAdd : s.capGen.threeDots),

		// stores
		capApp:(s) => s.$store.getters.captions.list,
		capGen:(s) => s.$store.getters.captions.generic
	}
};