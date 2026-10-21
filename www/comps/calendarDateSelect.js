import { getDateFormatNoYear, getDateFromWeek, getWeek, getWeeksInYear } from './shared/time.js';

export default {
	name: 'my-calendar-date-select',
	template: `<div class="calendar-select row gap">
		<my-button image="pagePrev.png"
			@trigger="pageMove(false)"
			:naked="true"
		/>
		<input class="selector date-input medium" type="text"
			v-if="isMonth || isWeek || isDays"
			v-model="yearInput"
		/>
		<select class="selector date-input"
			v-if="isMonth || isDays"
			v-model="monthInput"
		>
			<option value="0">01</option>
			<option value="1">02</option>
			<option value="2">03</option>
			<option value="3">04</option>
			<option value="4">05</option>
			<option value="5">06</option>
			<option value="6">07</option>
			<option value="7">08</option>
			<option value="8">09</option>
			<option value="9">10</option>
			<option value="10">11</option>
			<option value="11">12</option>
		</select>
		<input class="selector date-input short" type="text"
			v-if="isDays"
			v-model="dayInput"
		/>
		<select class="selector date-input"
			v-if="isWeek"
			v-model="weekInput"
		>
			<option
				v-for="i in weeksInYear"
				:title="weekInputTitle(i,yearInput)"
				:value="i"
			>
				{{ capApp.option.calendarWeek + ' ' + i }}
			</option>
		</select>
		<my-button image="pageNext.png"
			@trigger="pageMove(true)"
			:naked="true"
		/>
	</div>`,
	props: {
		daysShow: { type: Number, required: true },
		modelValue: { type: Date, required: true },
		useHotkeys: { type: Boolean, required: false, default: false }
	},
	computed: {
		dayInput: {
			get() { return this.modelValue.getDate(); },
			set(v) {
				const d = new Date(this.modelValue.valueOf());
				d.setDate(v);
				this.$emit('update:modelValue', d);
			}
		},
		monthInput: {
			get() { return this.modelValue.getMonth(); },
			set(v) {
				const d = new Date(this.modelValue.valueOf());

				if (this.isMonth)
					d.setDate(1); // set to 1st to add month correctly

				d.setMonth(v);
				this.$emit('update:modelValue', d);
			}
		},
		weekInput: {
			get() { return this.getWeek(this.modelValue); },
			set(v) {
				let d = new Date(this.modelValue.valueOf());
				d = this.getDateFromWeek(v, d.getFullYear());
				this.$emit('update:modelValue', d);
			}
		},
		yearInput: {
			get() { return this.modelValue.getFullYear(); },
			set(v) {
				if (v.length !== 4) return;

				const d = new Date(this.modelValue.valueOf());
				d.setFullYear(v);
				this.$emit('update:modelValue', d);
			}
		},

		// simple
		isDays: s => s.daysShow === 1 || s.daysShow === 3,
		isMonth: s => s.daysShow === 42,
		isWeek: s => s.daysShow === 5 || s.daysShow === 7,
		weeksInYear: s => s.isWeek ? s.getWeeksInYear(s.modelValue.getFullYear()) : 0,

		// stores
		capApp: s => s.$store.getters.captions.calendar,
		settings: s => s.$store.getters.settings
	},
	emits: ['update:modelValue'],
	mounted() {
		if (this.useHotkeys)
			window.addEventListener('keydown', this.handleHotkeys);
	},
	unmounted() {
		if (this.useHotkeys)
			window.removeEventListener('keydown', this.handleHotkeys);
	},
	methods: {
		// external
		getDateFormatNoYear,
		getDateFromWeek,
		getWeek,
		getWeeksInYear,

		// presentation
		weekInputTitle(week, year) {
			const d0 = getDateFromWeek(week, year);
			if (this.settings.sundayFirstDow)
				d0.setDate(d0.getDate() - 1);

			const d1 = new Date(d0.getTime())
			d1.setDate(d1.getDate() + 6);
			return `${this.getDateFormatNoYear(d0, this.settings.dateFormat)} - ${this.getDateFormatNoYear(d1, this.settings.dateFormat)}`;
		},

		// actions
		handleHotkeys(e) {
			switch (e.key) {
				case 'ArrowLeft': this.pageMove(false); break;
				case 'ArrowRight': this.pageMove(true); break;
			}
		},
		pageMove(forward) {
			if (this.isMonth) {
				this.monthInput = forward ? this.monthInput + 1 : this.monthInput - 1;
				return;
			}

			const d = new Date(this.modelValue.valueOf());

			// 5-days view (Mo-Fr) moves full week
			const dOffset = this.daysShow !== 5 ? this.daysShow : 7;

			d.setDate(d.getDate() + (forward ? dOffset : dOffset - (dOffset * 2)));
			this.$emit('update:modelValue', d);
		}
	}
};
