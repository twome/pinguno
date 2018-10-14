// Convenience shorthands
let d = document
let w = window
let c = console.debug
let cl = console.log
let ci = console.info
let cw = console.warn
let ce = console.error

// Collect the different values of the same property from different instances of an object into an array
let collectPropertyAcrossInstancesDeep = (instanceList, keysArr, instanceNameProp)=>{
	let collection = []

	for (let instance of instanceList){
		let here = instance
		for (let key of keysArr){
			here = here[key] // Dive deeper into the path of keys
		}
		// Optionally return 
		if (instanceNameProp){ here = {here, name: instance[instanceNameProp]} }
		collection.push(here)
	}

	return collection
}

// Clean lodash methods off the global scope
let cleanGlobalKeys = obj => {
	for (let key of Object.keys(obj)){ 
		if (typeof window[key] === 'function') delete window[key] 
	} 
}

export { 
	d,
	c,
	cl,
	ci,
	cw,
	ce,
	cleanGlobalKeys,
	collectPropertyAcrossInstancesDeep 
}