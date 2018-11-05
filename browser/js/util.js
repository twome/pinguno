import { config } from './config.js'

// Convenience shorthands
export let d = document
export let w = window

export let c = console.debug
export let cl = console.log
export let ci = console.info
export let cw = console.warn
export let ce = console.error

const makeInfoAtLevel = (level) => (...consoleArgs) => { if (config.verbose >= level) console.info(...consoleArgs) }
export let info1 = makeInfoAtLevel(1)
export let info2 = makeInfoAtLevel(2)
export let info3 = makeInfoAtLevel(3)
export let info4 = makeInfoAtLevel(4)
export let info5 = makeInfoAtLevel(5)

// Collect the different values of the same property from different instances of an object into an array
export let collectPropertyAcrossInstancesDeep = (instanceList, keysArr, instanceNameProp)=>{
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
export let cleanGlobalKeys = obj => {
	for (let key of Object.keys(obj)){ 
		if (typeof window[key] === 'function') delete window[key] 
	} 
}