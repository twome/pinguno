// 3rd-party
import cloneDeep from '../node_modules/lodash-es/cloneDeep.js'
import last from '../node_modules/lodash-es/last.js'
import isEqual from '../node_modules/lodash-es/isEqual.js'
import template from '../node_modules/lodash-es/template.js'

// In-house 
import { cg, cge, c, ce, ci, cw, debug2, cred, cblu, cgrn, cyel, cblk, cfaint } from './util.js'
import { Stack } from '../../util-iso.js'

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
			cw('[KeyMeta] Accessed property at $key without having any active watchers.', this.key)
		}
	}

	unsubscribeWatcher(watcher, keyMeta){
		keyMeta.dependants.remove(watcher)
	}

	notifyDependants(){
		cgrn(`[KeyMeta] ${this.key} has changed value!`)
		Object.entries(this.dependants).map((dependant, key) => {
			// Allow the dependants to tell us when they're done (if they're asynchronous),
			// so we can choose to perform something
			return Promise.resolve(dependant.update())
		})

		return Promise.all(this.dependants)
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
		cg('walking', target)
		for (let [key, child] of Object.entries(target)){
			c(`[walk] walking key, child`, key, child)
			// Anything that *can* have properties, we want to shim with a proxy so we can track those properties 
			// with a KeyMeta
			if (Object.isExtensible(child)){
				c(`[walk] walking found an extensible child at key, walking that....`, key)
				// Deep-recurse from the bottom up, overwriting any objects with Proxies
				target[key] = new ReactiveProxy(child) 
			}
		}

		c('[walk] about to makeProxy for target:', target)
		let topAncestorProxy = this.makeProxy(target)
		c('[walk] topAncestorProxy:', topAncestorProxy)
		cge()
		return topAncestorProxy
	}

	makeProxy(target){
		cg('makeProxy')
		c('before adding metas for existing keys')
		c('target entries:', Object.entries(target))
		c('prexisting proxy metas:', this.metas)
		for (let [key, val] of Object.entries(target)){
			c('[makeProxy] creating new meta for key:', key)
			this.metas[key] = new KeyMeta(key).set(val)
		}
		cge()

		const handler = {
			get: (target, key, receiver)=>{
				/*
					Affects:
						 `[]` accessor operator
						`.` accessor operator
				*/
				cyel(`TRAP --- getting key:`, key)
				let retrievedValue = this.getKeyValue(target, key)
				return retrievedValue
			},
			set: (target, key, value, /*receiver*/)=>{
				/*
					Affects:
						`=` operator
						Array.push()
				*/
				cyel(`TRAP --- setting $key to $value:`, key, value)
				this.setKeyValue(target, key, value, this.getMeta(key, target))
				return true
			},
			defineProperty: (target, key, descriptor)=>{
				/*
					Affects:
						Object.defineProperty()
						Array.pop() ?
				*/
				cyel('TRAP --- defineProperty. descriptor:', descriptor)
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
				cyel('TRAP --- delete')
				this.deleteKey(target, key, this.getMeta(key, target))
			},
			getOwnPropertyDescriptor: (target, key)=>{
				/*
					Affects:
						Object.getOwnPropertyDescriptor(),
						Object.keys(),
						anObject.hasOwnProperty(),
				*/
				cyel(`TRAP --- getOwnPropertyDescriptor`)
				let originalDescriptor = Object.getOwnPropertyDescriptor(target, key)
				c(originalDescriptor)
				return originalDescriptor
				// return Object.assign(originalDescriptor, {
				// 	enumerable: true,
				// 	configurable: true
				// })
			}
		}

		target = new Proxy(target, handler) // Write over target with its Proxy
		c(`[makeProxy] made the actual proxy from target; proxy is:`, target)
		return target
	}

	getMeta(key, target){
		cg('getMeta for key:', key)
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
			c('No KeyMeta found for key, creating meta for $key', key)
			this.addMeta(key, metasKey, target)
		} else if (! (this.metas[metasKey] instanceof KeyMeta)){
			throw Error('[getMeta] this.metas already has this property on it, the value of which is *not* a KeyMeta')
		}
		c(`returning`, this.metas[metasKey])
		cge()
		return this.metas[metasKey]
	}

	addMeta(key, metasKey, target){
		cg('addMeta', key)
		this.metas[metasKey] = new KeyMeta(key)

		if (key in target){
			// This key shares a name with a property / method of these inbuilt objects
			if ([Object, Array, Function].some(inbuilt => key in inbuilt.prototype)){
				// This is a preexisting property, so we need to be cautious about our ability to track it
				this.metas[metasKey].preExisting = true
				cw(`"${key}" is a shared name with an Object/Array inbuilt property`)
				
			} else if (!target.hasOwnProperty(key)){
				// This key is only present on the prototype chain
			}
		}
		
		if (typeof target !== 'undefined' && target[key]){
			c(`Adding the initial value of $key we found:`, key)
			this.metas[metasKey].set(target[key])
		}
		cge()
	}

	getKeyValue(target, key){
		cg('getKeyValue for key', key)
		let targetVal = target[key] // Remember, this access could have gone through a proxy before returning to us
		let keyMeta = this.getMeta(key, target)

		// TEMP dev only
		c('[getKeyValue] getOwnPropertyDescriptor, getOwnPropertyNames, getOwnPropertySymbols', Object.getOwnPropertyDescriptor(target, key), Object.getOwnPropertyNames(target), Object.getOwnPropertySymbols(target))
		c(`[getKeyValue] key, targetVal, target`, key, targetVal, target)
		
		// TEMP dev only
		if (!isEqual(target[key], keyMeta.value) && typeof targetVal !== 'function'){
			cw(`[ReactiveProxy] Property "${key}" was changed without updating its KeyMeta (or notifying its dependants)`)
		}

		keyMeta.subscribeCurrentWatcher(this.watchersToAssign)
		c(`[getKeyValue] asking for $key, got:`, key, target[key])
		cge()
		return target[key]
	}

	setKeyValue(target, key, value, keyMeta, descriptor){
		cg('setKeyValue $key, $keyMeta, $value', key, keyMeta, value)
		if (value !== keyMeta.value){ // Prevent unnecessary update runs
			if (Object.isExtensible(value)){
				c('new value is an extensible object! shimming it with a new ReactiveProxy before we set its value:')
				value = new ReactiveProxy(value) // We want to recurse to the bottom of the tree before starting to set values
				cblk('new value after proxifying:', value)
			}
			
			keyMeta.set(value) // This is the part that actually informs watchers 
			c('changed keyMeta:', keyMeta)

			if (keyMeta.preExisting){
				cw(`Tried to set a preexisting property on the target, such as "length". Silently failing.`)
				if (keyMeta.value !== target[key]){
					cw(`keyMeta's value differs from target's; $keyMeta.value, $target[key]`, keyMeta.value, target[key])
				}
			} else {
				c(`descriptor provided: `, descriptor)
				let descriptorToAssign = Object.assign({ 
					value,
					writable: true,
					enumerable: true,
					configurable: true
				}, descriptor)
				c('descriptor to define on prop:', descriptorToAssign)
				Object.defineProperty(target, key, descriptorToAssign) // Touch the actual internal property
				c('changed target! new target prop attributes:', Object.getOwnPropertyDescriptor(target, key))
			}
		} else {
			c('value wasn\'t changed')
		}
		cge()
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

		// Static properties
		Watcher.stack = Watcher.stack || new Stack()
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
	Wrapper around ReactiveProxy which binds it to a DOM element, in order to use the ReactiveProxy as a "viewmodel"

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

		this.watcherStack = new Stack()

		this._vm = ReactiveProxy(data, this.watcherStack)

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

export { ReactiveVm, ReactiveProxy, Watcher } 