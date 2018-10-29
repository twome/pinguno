// 3rd-party
import cloneDeep from '../node_modules/lodash-es/cloneDeep.js'
import last from '../node_modules/lodash-es/last.js'
import template from '../node_modules/lodash-es/template.js'

const _ = { cloneDeep, last, template }

class ErrorCannotAccessProperty extends Error {
  constructor(currentPropPathKey, currentPropPathValue, nextPropKey, messageForSuper = ''){
    super(messageForSuper)
    this.message = `ErrorCannotAccessProperty: Property ${nextPropKey} can't be accesssed because ${currentPropPathKey} has value ${currentPropPathValue}`
  }
}

class ErrorInvalidPropertyKey extends Error {
	constructor(propKey, messageForSuper = ''){
		super(messageForSuper)
		this.message = `ErrorInvalidPropertyKey: Property ${propKey} has a period "." in its name, which is not allowed as it could lead to confusion.`
	}
}

// TODO: make deep-setting (for arrays) and deep-getting methods
/*
	Recursively walks a plain ES object and replaces each property with a "reactive property". The reactive property 
	stores the real/original value in its own private property, and uses a getter to to automatically register an
	internal list of every "watcher" (render function that depends on this reactive property) that gets the 
	reactive property. Any time that reactive property is changed, its setter automatically calls the 'update' function 
	of every watcher it had added to its internal list of subscribers, which allows users to asynchronously work with
	the updated output/view/rendering of the watcher.

	This works in a very similar way to Angular's and Vue 2.x's "viewmodels".

	Made with help / adapted from tutorial by Matthew Dangerfield, who in turn adapted from Vue.js source
	https://hackernoon.com/how-to-build-your-own-reactivity-system-fc48863a1b7c
*/
class ReactiveObj {
	constructor(objToWatch, watchersToAssign){
		this.$original = _.cloneDeep(objToWatch)

		// Static properties
		ReactiveObj.watchersToAssign = watchersToAssign || Watcher.stack

		return ReactiveObj.walkPlainObject(objToWatch)
	}

	/*
		Recursively interate through a plain javascript object's properties to replace all its 
		simple properties with getter/setter functions (which operate on a private internal value)
	*/
	static walkPlainObject(objToWatch){
		Object.keys(objToWatch).forEach((propKey)=>{
			let propVal = objToWatch[propKey]
			console.debug('[ReactiveObj:walkPlainObject] propKey, propVal', propKey, propVal)

			if (propVal !== null && typeof propVal === 'object'){ // Matches arrays, objects etc
				ReactiveObj.walkPlainObject(propVal)
			}
			
			ReactiveObj.createReactiveProperty(objToWatch, propVal, propKey)
		})

		// TODO: should we seal the output object; can its accessor properties
		// be set() even though their property-attributes (enumerable,
		// configurable, data: writable, data: value, accessor: set, accessor:
		// get) are non-configurable? objToWatch = Object.seal(objToWatch)
		return objToWatch
	}

	// Replace simple "data descriptor" property with an "accessor descriptor" reactive property 
	static createReactiveProperty(parentObject, existingPropVal, propKey){
		let _previousInternalValue
		let _internalValue = existingPropVal
		let _internalDependants = new Set() // each dependency instance is unique to EACH property of the object
		
		Object.defineProperty(parentObject, propKey, {
			enumerable: true,
			configurable: true, 
			get(){
				console.debug(`[ReactiveObj:createReactiveProperty:get] Getting ${propKey}`)
				
				// This is how this reactive property knows which processes are watching/depending on it.
				// This is why we need to use a watcher; so that the reactive object's properties know *which* 
				// processes (watcher's 'dependentProcesses') depend on them

				// The watcher must make sure it has added itself to this watcher list before trying to 
				// `get` any reactive properties, if it wants to be automatically registered as a dependency.
				if (last(ReactiveObj.watchersToAssign)){ //
					_internalDependants.add(last(ReactiveObj.watchersToAssign.current)) // Add this dependency to the current target watcher
					console.debug(`[ReactiveObj:createReactiveProperty:get] List of dependants: ${_internalDependants}`)
				}
				return _internalValue
			},
			set(value){
				console.debug(`[ReactiveObj:createReactiveProperty] Setting ${propKey}`)
				if (value !== _previousInternalValue){ // Prevent unnecessary update runs
					if (value !== null && typeof value === 'object'){
						ReactiveObj.walkPlainObject(value, true)
					}
					_previousInternalValue = _internalValue
					_internalValue = value
					_internalDependants.forEach(dependant => dependant.update())
				}
			}
		})
	}

	static setNewKey(parentObj, keyToCreate, value){
		parentObj[keyToCreate] = null // Placeholder value, just to add this key to Object.keys(parentArr)
		ReactiveObj.createReactiveProperty(parentObj, value, keyToCreate)
	}

	// Array-like wrapper for set, for using on Arrays
	static pushNewIndex(parentArr, value){ 
		let keysAsNumbers = Object.keys(parentArr).map(key => Number(key))
		let plainPropKey = Math.max(...keysAsNumbers) + 1 // Increment on the highest existing index (accounting for sparse arrays)
		ReactiveObj.setNewKey(parentArr, plainPropKey, value)
	}
}

/*
	dependentProcess(): a function which returns a value. This function can *depend on* the properties of a reactive object, and so
	each time those reactive properties change, this function is run again to "refresh" its output value. This is basically like
	a "render" function for a template, (and was made for that purpose), but can be used more abstractly.

	callback(newOutput, oldOutput): this is where the consumer gets access to the asynchronous output of dependentProcess(), so 
	that the updated output can be used where it is needed.

	watcherStack: this is a global-like array of potential watchers that are added to each reactive property's *internal* list of
	subscribers as that reactive property is running its *getter* function. The watcher stack is filled up emphemerally and then 
	depleted for each individual reactive property (the relationshi)
*/
class Watcher {
	constructor(dependentProcess, callback, watcherStack){
		this.dependentProcess = dependentProcess
		this.callback = callback
		this.watcherStack = this.watcherStack !== 'undefined' ? this.watcherStack : ReactiveObj.$globalWatcherStack

		// Static properties
		Watcher.stack = Watcher.stack || []
		this.watcherStack = watcherStack || Watcher.stack // Static

		this.dependentOutput = null
		this.update() // Runs the process using initial values
	}

	update(){
		const oldOutput = this.dependentOutput

		this.watcherStack.push(this) // We add this watcher as the current target for the active Dep instance
		// Call the dependentProcess, which uses reactive properties to output something (like a component's HTML)
		this.dependentOutput = Promise.resolve(this.dependentProcess()).then((val)=>{
			this.dependentOutput = val
			this.watcherStack.pop()
			this.callback(this.dependentOutput, oldOutput)
		})		
	}
}



/*
	Wrapper around ReactiveObj to use as a "viewmodel"

	TODO: This basically acts as a factory rather than a normal class
	instance, because the constructor returns a non-instance object (the user
	cannot ever access the instance itself with `this`). Should we refactor/rename this?
*/
class ReactiveVm {
	constructor({
		el = {},
		data = {},
		methods = {}
	}={}){
		this.opt = {el, data, methods} // Save initial args into options object
		
		if (typeof el === 'string'){
			const foundEls = document.querySelectorAll(el)
			el = foundEls[0]
			if (foundEls.length >= 2){
				console.error('[ReactiveVm] Matched elements:', foundEls)
				throw Error('[ReactiveVm] needs a *unique* selector; you provided a selector that matches >1 page elements.')
			}
		}
		if (el instanceof HTMLElement){
			this.el = el
		} else {
			throw Error('[ReactiveVm] needs an active HTMLElement object or a selector string which identifies to a unique HTMLElement as its `el` property.')
		}

		this.watcherStack = []

		this._vm = ReactiveObj(data, this.watcherStack)

		// Attach methods with '$' prefix to root of reactive vm object
		methods.forEach((fn, key)=>{
			if (this._vm[key] === undefined){
				this._vm['$' + key] = fn.bind(this)
			} else {
				throw Error(`[ReactiveVm] Property ${key} already exists; can't attach method of same name.`)
			}
		})

		// Helper properties for user
		this._vm['$data'] = data
		this._vm['$el'] = el
		
		return this._vm
	}
}

export { ReactiveVm, ReactiveObj, Watcher } 