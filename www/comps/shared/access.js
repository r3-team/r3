export function hasAccessToAttribute(access,attributeId,relationId,requestedAccess) {
	
	// use attribute access first if specified (more specific access wins)
	if(typeof access.attribute[attributeId] !== 'undefined')
		return access.attribute[attributeId] >= requestedAccess;
	
	// use relation access otherwise (inherited access)
	if(typeof access.relation[relationId] !== 'undefined')
		return access.relation[relationId] >= requestedAccess;
	
	return false;
};

export function hasAccessToAnyMenu(menus,menuAccess) {
	for(let i = 0, j = menus.length; i < j; i++) {
		if(menuAccess[menus[i].id] === 1)
			return true;
	}
	return false;
};

export function hasAnyAssignableRole(roles) {
	for(let i = 0, j = roles.length; i < j; i++) {
		if(roles[i].assignable && roles[i].name !== 'everyone')
			return true;
	}
	return false;
};