// 3rd-party
import isEqual from '../../node_modules/lodash-es/isEqual.js'
import cloneDeep from '../../node_modules/lodash-es/cloneDeep.js'

// In-house
import { c, ci, cg, cge } from '../util.js'
import { ReactiveProxy, Watcher } from '../../../reactive-object/reactive-object.js'

import { race, assert } from './test-framework.js'

// Shortcuts
let asyncs = [] // Asynchronous tests go in here
let a = assert

// Shared setup
const testSimpleObj = {
	lightColor: 'red',
	dancers: [
		{
			name: 'leon',
			height: 7
		},{
			name: 'ali',
			height: 9
		}
	],
	danceStyle: {
		bpm: 120,
		rules: 'street',
	}
}
let testObj = new ReactiveProxy(cloneDeep(testSimpleObj))

// Simple access of object and properties
;(function(){
	// Setup
	
	let objA = cloneDeep(testObj)

	// Test

	a(objA, 'Access parent object')

	a(objA.lightColor === 'red', 'Access value of property')

	a(isEqual(objA.dancers, [
		{
			name: 'leon',
			height: 7
		},{
			name: 'ali',
			height: 9
		}
	]), 'Consistent structure of property value which is an array')

	a(isEqual(objA.danceStyle, {
		bpm: 120,
		rules: 'street',
	}), 'Consistent structure of property value which is an object')

})()

// Modification of properties
;(function(){
	// Setup

	let objA = cloneDeep(testObj)

	objA.lightColor = 'green' 
	objA.newProp = 'a primitive, like a string' 
	objA.dancers.push('string instead of object') 
	Object.defineProperty(objA, 'danceFloor', { 
		value: 'glowing disco zone',
		writable: false,
		enumerable: false,
		configurable: true
	})

	// Test

	a(objA.lightColor === 'green', 'Can change existing property values')

	a(objA.newProp === 'a primitive, like a string', 'Can create and set new properties')

	a(objA.dancers.length === 3, 'Can push to properties which are arrays')

	a(objA.dancers[2] === 'string instead of object', 'Can access properties which are arrays\' indices')

	a(isEqual({ 
		value: 'glowing disco zone',
		writable: false,
		enumerable: false,
		configurable: true
	}, Object.getOwnPropertyDescriptor(objA, 'danceFloor')), 'Can use defineProperty()')

	a(objA.danceFloor === 'glowing disco zone', 'Can use defineProperty()') 
})()

// Watcher render & callback functions
;(function(Watcher){
	// Setup

	let objA = new ReactiveProxy(cloneDeep(testSimpleObj))
	let fired = 0

	let styleWatcher = new Watcher((oldVal)=>{
		cg('this is the watcher render. old value: ', oldVal)
		c('current value of danceStyle:', objA.danceStyle)
		fired = fired + 1
		c('number of times render fired:', fired)

		cge()
		// We could return a simple sync value, or a Promise.
		// What we return becomes the oldVal for the next render cycle.
		return new Promise(resolve => { 
			setTimeout(()=>{ // Simulate async operation
				console.log('2500ms delay later')
				resolve(styleWatcher.rules)
			}, 2500)
		})
	})

	// Test

	a(styleWatcher instanceof Watcher, 'styleWatcher is a watcher')

	// Setup 

	objA.danceStyle.inspiration = 'greek'

	// Test

	a(fired === 1, 'watcher render function runs once per change made to one of its dependencies')

	objA.danceStyle.inspiration = 'nambian'

	a(fired === 2, 'watcher runs again for the second change')

})(Watcher)



// console.debug('∆∆∆ making big dance fella')
// let objB = new ReactiveProxy(cloneDeep(objA))
// w.objB = objB

// objA.dancers.push({ 
// 	name: 'BIG DANCE FELLA',
// 	height: 918
// })

// objB.dancers.push({ 
// 	name: 'MASSIVE DANCE KING',
// 	height: 9777
// })

// console.debug(`∆∆∆ replacing big lad with new dancers`)
// w.objB.dancers = [
// 	{
// 		name: 'Hot Streak',
// 		speed: 100
// 	},{
// 		name: 'Cool Stuff',
// 		sludginess: 19
// 	}
// ]

// console.debug(`∆∆∆ pushing extra dancer`)
// w.objB.dancers[69] = {
// 	name: 'Fourth Wheel',
// 	speed: 0.5
// }
// w.objB.dancers.push({
// 	name: 'Fourth Wheel',
// 	speed: 0.5
// })

// console.debug(`∆∆∆ adding influences obj-prop to style`)
// w.objB.danceStyle.influences = {
// 	early: {
// 		name: 'jazz',
// 		period: 1940
// 	},
// 	impressionable: [
// 		'metal',
// 		'metallica',
// 		'ferrous substances'
// 	]
// }


// console.debug('∆∆∆ whats the syncronous objB?:', w.objB)

// this.vm = new ReactiveVm({
// 	el: '#reactive-vm-app',
// 	data: { // exposed to all custom el templates
// 		lowestUptime: 69.69,
// 		exportButtons: {
// 			'js-open-log-json': {
// 				name: `js-open-log-json`,
// 				description: `Open JSON log in text editor`
// 			},
// 			'js-open-log-json-this-session': {
// 				name: `js-open-log-json-this-session`,
// 				description: `Open this session's JSON log in text editor`
// 			},
// 			'js-compress-all-logs': {
// 				name: `js-compress-all-logs`,
// 				description: `Compress all JSON logs, copy zip file's path`
// 			}
// 		},
// 		activeServer: {
// 			hostname: 'localhost',
// 			port: '1919'
// 		}
// 	},
// 	methods: { // callable from vm-on-change, vm-on-click etc
// 		openCurrentLogJSON: ()=>{
// 			fetch('/api/1/actions/open-current-log-json', {
// 				method: 'GET'
// 			})
// 		}
// 	}
// })

Promise.all(asyncs).then(val => {
	c('value of `asyncs`:', val)
	ci('[reactiveProxySpec] Test complete')
}, err => { throw err })