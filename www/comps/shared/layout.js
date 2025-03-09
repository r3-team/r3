// returns whether dropdown of element should appear above it
// takes vertical position of element, vertical space that is usable in total and vertical offset (usually header)
export default function isDropdownUpwards(el,vertPxDropdown,vertPxOffset) {
	// vertical position of element
	let vertPxEl = el.getBoundingClientRect().bottom - vertPxOffset;
	
	// usable vertical space in form
	let vertPxForm = window.innerHeight-vertPxOffset;
	
	// open dropdown upwards, if
	//  dropdown does not fit into the vertical space below element
	//  dropdown going upwards does fit into vertical space above element
	// if neither is true, dropdown goes downwards
	return vertPxEl+vertPxDropdown > vertPxForm && vertPxEl > vertPxDropdown;
};

export function layoutSettleSpace(shownElements,checkElm) {
	// abort if size check element is not defined, has sufficient size or there are no more elements to reduce
	if(checkElm === undefined || checkElm === null || checkElm.offsetWidth > 3 || shownElements.length === 0)
		return;
	
	// space insufficient and still elements available to reduce
	shownElements.shift();                                         // remove next element
	Vue.nextTick(() => layoutSettleSpace(shownElements,checkElm)); // resettle after change
};