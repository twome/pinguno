/* eslint-env browser, node */
// This is above the `import`s so we can immediately clean the global scope after importing by using this function
let cleanLibraryMethodsOffGlobal = (lib)=>{
	let globalRef = typeof global !== 'undefined' && global
	let windowRef = typeof window !== 'undefined' && window
	let globalObject = globalRef || windowRef || this
	Object.keys(lib).forEach(key => delete globalObject[key])
}

import last from './browser/node_modules/lodash-es/last.js'
// cleanLibraryMethodsOffGlobal(_)

// Isomorphic utilities (do not depend on objects specifically available in Node OR browsers)
// Any global-object dependencies must be included as arguments
let isValidURL = (str, URI)=>{
	try {
		new URL(str)
		return true
	} catch (err){
		return false
	}
}

class Enum {
	constructor(valueArr){

		// You can give this an array of strings which are converted to objects
		for (let val of valueArr){
			if (typeof val === 'string'){
				this[val] = {
					accessor: valueArr.indexOf(val) + 1, // Don't use zero-based indices in enums; for truthiness we want the first index to be index 1
					humanName: val
				}
			} else if (typeof val === 'object'){
				this[val.accessor] = {
					accessor: val.accessor,
					humanName: val.humanName || val.accessor
				}
			} else {
				throw new Error('Unknown type for Enum values: must be a string or object with properties "accessor" [and "humanName"]')
			}
		}

		Object.freeze(this)
	}
}

// Last in, first out stack. This is basically just an array, but provides a clearer interface when 
// you're supposed to be interacting with *only* the topmost element of an array
class Stack {
	constructor(){
		this._stack = []
	}

	get current(){
		let top = last(this._stack)
		return (top === undefined) ? null : top
	}

	push(newItem){
		this._stack.push(newItem)
	}

	pop(){
		this._stack.pop()
	}
}

export { cleanLibraryMethodsOffGlobal, isValidURL, Enum, Stack }