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

const styleDebug = (css, ...consoleArgs) => {
	consoleArgs[0] = '%c' + consoleArgs[0]
	consoleArgs.splice(1, 0, css)
	return console.debug(...consoleArgs)
}
const styleInfo = (css, ...consoleArgs) => {
	consoleArgs[0] = '%c' + consoleArgs[0]
	consoleArgs.splice(1, 0, css)
	return console.info(...consoleArgs)
}

export let cred = (...consoleArgs) => styleDebug('color: hsla(0,100%,40%,1); font-weight: bold;', ...consoleArgs)
export let cblu = (...consoleArgs) => styleDebug('color: hsla(120,100%,40%,1); font-weight: bold;', ...consoleArgs)
export let cgrn = (...consoleArgs) => styleDebug('color: hsla(240,100%,20%,1); font-weight: bold;', ...consoleArgs)
export let cyel = (...consoleArgs) => styleDebug('color: hsla(60,100%,35%,1); font-weight: bold;', ...consoleArgs)
export let cblk = (...consoleArgs) => styleDebug('background-color: hsla(0,0%,0%,1); color: hsla(60,0%,100%,1); padding: 0.2em 0.4em; font-weight: bold;' , ...consoleArgs)
export let cfaint = (...consoleArgs) => styleInfo('color: hsla(0,0%,0%,0.3);', ...consoleArgs)

cred('big message', 'wow whats this')
cblu('big message', 'wow whats this')
cgrn('big message', 'wow whats this')
cyel('big message', 'wow whats this')
cblk('big message', 'wow whats this')
cfaint('faint as hell')


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