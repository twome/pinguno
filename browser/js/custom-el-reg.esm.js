import { d, w, c, ce, ci } from './util.esm.js'
import { MoreOptionsBtn } from './components/more-options-btn.esm.js'
import { Indicator } from './components/indicator.esm.js'

let customEls = [
	MoreOptionsBtn,
	Indicator
]

// Get a reference to the "classed" version of every instance (DOM element) of each custom element we've made
let registerDOMNodesToCustomEls = (customEls, existingInstances)=>{
	let customElInstances = existingInstances || new Map()
	for (let customEl of customEls){
		if (! customElInstances.get(customEl)) customElInstances.set(customEl, [])
		let instancesForElType = customElInstances.get(customEl)
		d.querySelectorAll(customEl.selector).forEach(el => {
			let classedEl = new customEl(el)
			instancesForElType.push(classedEl)
			customElInstances.set(customEl, instancesForElType)
		})	
	}
	return customElInstances
}

export { customEls, registerDOMNodesToCustomEls }