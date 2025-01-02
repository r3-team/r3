export function hasAccessToRelation(access,relationId,requestedAccess) {
	if(typeof access.relation[relationId] !== 'undefined')
		return access.relation[relationId] >= requestedAccess;
	
	return false;
};

export function hasAccessToAttribute(access,attributeId,relationId,requestedAccess) {
	
	// use attribute access first if specified (more specific access wins)
	if(typeof access.attribute[attributeId] !== 'undefined')
		return access.attribute[attributeId] >= requestedAccess;
	
	// use relation access otherwise (inherited access)
	if(typeof access.relation[relationId] !== 'undefined')
		return access.relation[relationId] >= requestedAccess;
	
	return false;
};

export function hasAccessToAnyMenu(menuTabs,menuAccess) {
	for(const mt of menuTabs) {
		for(const m of mt.menus) {
			if(menuAccess[m.id] === 1)
				return true;
		}
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

export function getStartFormId(module,access) {
	
	// return NULL if no menu access is granted at all
	if(!hasAccessToAnyMenu(module.menuTabs,access.menu))
		return null;
	
	// check role specific start form
	for(let i = 0, j = module.startForms.length; i < j; i++) {
		
		if(access.roleIds.includes(module.startForms[i].roleId))
			return module.startForms[i].formId;
	}
	
	// return default start form (NULL is allowed)
	return module.formId;
};