// 3rd-party
import cloneDeep from './node_modules/lodash-es/cloneDeep.js'
import last from './node_modules/lodash-es/last.js'
import isEqual from './node_modules/lodash-es/isEqual.js'
import template from './node_modules/lodash-es/template.js'

// In-house 
import { c, ce, ci, cw, info3, info2 } from '../browser/js/util.js'
import { Stack } from '../util-iso.js'

// This is the meta-information for the value of a reactive object's property. It has its own list of Watchers 
// (much like a Publisher) which it notifies whenever its internal value changes.
class KeyMeta {
	constructor(key){
		this.previousValue = undefined
		this.value = undefined
		this.key = key
		this.dependants = new Set()
		this.preExisting = null // Whether or not there are pre-existing values on the target at this key (such as inherited or inbuilt properties)
	}

	set(value){
		this.previousValue = this.value
		this.value = value
		this.notifyDependants()
		return this
	}

	subscribeCurrentWatcher(watcherStack){
		// The watcher must make sure it has added itself to this watcher list before trying to 
		// `get` any reactive properties, if it wants to be automatically registered as a dependency.
		if (last(watcherStack)){
			this.dependants.add(last(watcherStack)) // Add this dependency to the current target watcher
		} else {
			info3('[KeyMeta] Accessed property at $key without having any active watchers.', this.key)
		}
	}

	unsubscribeWatcher(watcher, keyMeta){
		keyMeta.dependants.remove(watcher)
	}

	notifyDependants(){
		info2(`[KeyMeta] Property has changed value at key:`, this.key)
		let renderOutputs = Object.entries(this.dependants).map((dependant, key) => {
			// Allow the dependants to tell us when they're done (if they're asynchronous),
			// so we can choose to perform something
			return Promise.resolve(dependant.update())
		})

		return Promise.all(renderOutputs)
	}
}

/*
	Each ReactiveProxy only stores reactive properties one level deep (its own direct children). 
	It recursively makes its extensible (property-having) children ReactiveProxies before 
*/
class ReactiveProxy {
	constructor(targetObj, watchersToAssign){
		this.watchersToAssign = watchersToAssign || Watcher.stack
		this.metas = {}
		this.originalObj = targetObj

		ReactiveProxy.metasNamespace = '_reactiveVmNamespace_'

		return this.walk(targetObj) // Because we don't return an instance, all instance ("this") references are essentially private
	}

	/*
		Recursively interate through a plain javascript object's properties to replace all its 
		simple properties with proxies
	*/
	walk(target){
		for (let [key, child] of Object.entries(target)){
			// Anything that *can* have properties, we want to shim with a proxy so we can track those properties 
			// with a KeyMeta
			if (Object.isExtensible(child)){
				// Deep-recurse from the bottom up, overwriting any objects with Proxies
				target[key] = new ReactiveProxy(child) 
			}
		}

		return this.makeProxy(target)
	}

	makeProxy(target){
		for (let [key, val] of Object.entries(target)){
			this.metas[key] = new KeyMeta(key).set(val)
		}

		const handler = {
			get: (target, key, receiver)=>{
				/*
					Affects:
						 `[]` accessor operator
						`.` accessor operator
				*/
				info3(`TRAP --- get. getting key:`, key)
				let retrievedValue = this.getKeyValue(target, key)
				return retrievedValue
			},
			set: (target, key, value, /*receiver*/)=>{
				/*
					Affects:
						`=` operator
						Array.push()
				*/
				info3(`TRAP --- set. setting $key to $value:`, key, value)
				this.setKeyValue(target, key, value, this.getMeta(key, target))
				return true
			},
			defineProperty: (target, key, descriptor)=>{
				/*
					Affects:
						Object.defineProperty()
				*/
				info3('TRAP --- defineProperty. descriptor:', descriptor)
				if ('value' in descriptor){ // Data descriptor
					this.setKeyValue(target, key, descriptor.value, this.getMeta(key, target), descriptor)
					return true
				} else if (descriptor.get || descriptor.set ){ // Accessor descriptor
					// We probably shouldn't let user interfere with accessors here
					return false
				} else {
					// Value hasn't changed, so just update the descriptor attributes.
					// We're not changing the value so we probably don't need to call setKeyValue()
					Object.defineProperty(target, key, descriptor)
					return true
				}
			},
			deleteProperty: (target, key)=>{
				/*
					Affects:
						`delete` operator
						Array.pop() ?
				*/
				info3('TRAP --- deleteProperty. key:', key)
				this.deleteKey(target, key, this.getMeta(key, target))
			},
			getOwnPropertyDescriptor: (target, key)=>{
				/*
					Affects:
						Object.getOwnPropertyDescriptor(),
						Object.keys(),
						anObject.hasOwnProperty(),
				*/
				info3('TRAP --- getOwnPropertyDescriptor', key)
				let originalDescriptor = Object.getOwnPropertyDescriptor(target, key)
				return originalDescriptor
			}
		}

		target = new Proxy(target, handler) // Write over target with its Proxy
		return target
	}

	getMeta(key, target){
		if (!key) throw Error('[getMeta] Key needed for method .getMeta(key)')

		let metasKey = key
		if (typeof key === 'string' && key in this.metas){
			// Need this to stop clashing with pre-existing properties of this.metas like Array.length or .push()
			metasKey = ReactiveProxy.metasNamespace + key
		}

		if (!(metasKey in this.metas)){
			// Consumer is trying to get a value of a property which doesn't (or rather, shouldn't) already exist, because 
			// none of the traps that should have been fired when someone added a value to this property's key have created 
			// a KeyMeta for this key
			this.addMeta(key, metasKey, target)
		} else if (! (this.metas[metasKey] instanceof KeyMeta)){
			throw Error('[getMeta] this.metas already has this property on it, the value of which is *not* a KeyMeta')
		}
		return this.metas[metasKey]
	}

	addMeta(key, metasKey, target){
		this.metas[metasKey] = new KeyMeta(key)

		if (key in target){
			// This key shares a name with a property / method of these inbuilt objects
			if ([Object, Array, Function].some(inbuilt => key in inbuilt.prototype)){
				// This is a preexisting property, so we need to be cautious about our ability to track it
				this.metas[metasKey].preExisting = true
			} else if (!target.hasOwnProperty(key)){
				// This key is only present on the prototype chain
			}
		}
		
		if (typeof target !== 'undefined' && target[key]){
			this.metas[metasKey].set(target[key])
		}
	}

	getKeyValue(target, key){
		let targetVal = target[key] // Remember, this access could have gone through a proxy before returning to us
		let keyMeta = this.getMeta(key, target)

		if (!isEqual(target[key], keyMeta.value) && typeof targetVal !== 'function'){
			info3(`[ReactiveProxy] Target property "${key}" was changed without updating its KeyMeta (or notifying its dependants)`)
		}

		keyMeta.subscribeCurrentWatcher(this.watchersToAssign)
		return target[key]
	}

	setKeyValue(target, key, value, keyMeta, descriptor){
		if (value !== keyMeta.value){ // Prevent unnecessary update runs
			if (Object.isExtensible(value)){
				value = new ReactiveProxy(value) // We want to recurse to the bottom of the tree before starting to set values
			}
			
			keyMeta.set(value) // This is the part that actually informs watchers 

			if (keyMeta.preExisting){
				info3(`[ReactiveProxy:setKeyValue] Tried to set a preexisting property on the target, such as "length". Silently failing.`)
			} else {
				let descriptorToAssign = Object.assign({ 
					value,
					writable: true,
					enumerable: true,
					configurable: true
				}, descriptor)
				Object.defineProperty(target, key, descriptorToAssign) // Touch the actual internal property
			}
		}
	}

	deleteKey(target, key, keyMeta){
		delete target[key]
		keyMeta.set(undefined)
	}
}



/*
	dependentProcess(): a function which returns a value. This function can *depend on* the properties of a reactive object, and so
	each time those reactive properties change, this function is run again to "refresh" its output value. This is basically like
	a "render" function for a template, (and was made for that purpose), but can be used more abstractly.

	watcherStack: this is a global-like array of potential watchers that are added to each reactive property's *internal* list of
	subscribers as that reactive property is running its *getter* function. The watcher stack is filled up emphemerally and then 
	depleted for each individual reactive property.
*/
class Watcher {
	constructor(dependentProcess, watcherStack){
		this.dependentProcess = dependentProcess

		// Static properties
		Watcher.stack = Watcher.stack || new Stack()

		this.watcherStack = watcherStack || Watcher.stack 

		this.dependentOutput = null
		this.update() // Runs the process using initial values
	}

	update(){
		const oldOutput = this.dependentOutput

		this.watcherStack.push(this) // We add this watcher as the current target for the active Dep instance
		// Call the dependentProcess, which uses reactive properties to output something (like a component's HTML)
		this.dependentOutput = this.dependentProcess(oldOutput)
		c(this.dependentOutput)
		if (this.dependentOutput instanceof Promise){
			this.dependentOutput.then(val => {
				this.dependentOutput = val
				this.watcherStack.pop()
			})
		} else {
			// We've stopped accessing reactive properties, so tell KeyMetas to stop looking for this watcher
			this.watcherStack.pop()
		}
	}
}

export { ReactiveProxy, Watcher } 