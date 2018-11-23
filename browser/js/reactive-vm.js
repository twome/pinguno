// In-house 
import { c, ce, ci, cw, info3 } from './util.js'
import { Stack } from '../../util-iso.js'
import { ReactiveProxy } from '../../reactive-object/reactive-object.js'

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
				throw Error('[ReactiveVm] Needs a *unique* selector; you provided a selector that matches >1 page elements.')
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