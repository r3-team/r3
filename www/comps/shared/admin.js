import MyStore from '../../stores/store.js';

export function getLoginIcon(active,admin,limited,noAuth) {
	const activated = MyStore.getters['local/activated'];

	if(!active)              return 'images/personDash.png';
	if(activated && limited) return 'images/personDot.png';
	if(noAuth)               return 'images/personGlobe.png';
	if(admin)                return 'images/personCog.png';

	return 'images/person.png';
};