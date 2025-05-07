// used in full page fields, watching $route path [0} & $route.query [1]
// if route is the same but query changed, there is something to update
export function routeChangeFieldReload(newVals,oldVals) {
	
	if(newVals[0] !== oldVals[0])
		return false; // route has changed, form will reload on its own

	if(newVals[1] === oldVals[1])
		return false; // same route, query has not changed, nothing to do
	
	return true;
};

// parses given parameter from route URL getter in given value store
// params: { param1:{ parse:'int', value:0 } }
// 'parse' defines how parameter is to be parsed
// 'value' serves as default value, is overwritten if valid parameter is found
export function routeParseParams(params) {
	for(let name in params) {
		if(typeof this.$route.query[name] === 'undefined')
			continue;
		
		switch(params[name].parse) {
			case 'int':
				params[name].value = parseInt(this.$route.query[name]);
				if(isNaN(params[name].value))
					params[name].value = 0;
				
			break;
			case 'string':
				params[name].value = this.$route.query[name];
			break;
			
			// custom parsing
			case 'listOrder':
				let items  = this.$route.query[name].split(',');
				let orders = [];
				
				for(let i = 0, j = items.length; i < j; i++) {
					
					let parts = items[i].split('_');
					if(parts.length !== 3)
						continue;
					
					if(parts[0] === 'expr') {
						orders.push({
							expressionPos:parseInt(parts[1]),
							ascending:parts[2] === 'asc'
						});
					}
					else {
						orders.push({
							index:parseInt(parts[0]),
							attributeId:parts[1],
							ascending:parts[2] === 'asc'
						});
					}
				}
				params[name].value = JSON.stringify(orders);
			break;
		}
	}
};