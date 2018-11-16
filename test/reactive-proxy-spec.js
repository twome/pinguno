// 3rd-party
import isEqual from '../browser/node_modules/lodash-es/isEqual.js'

// In-house
import { c } from '../browser/js/util.js'
import { ReactiveProxy, ReactiveVm, Watcher } from '../browser/js/reactive-vm.js'

// Shortcuts
const a = console.assert

// Setup

let objA = new ReactiveProxy({
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
})

// Test

a(objA)

a(objA.lightColor === 'red')

a(isEqual(objA.dancers, [
	{
		name: 'leon',
		height: 7
	},{
		name: 'ali',
		height: 9
	}
]))

a(isEqual(objA.danceStyle, {
	bpm: 120,
	rules: 'street',
}))

// Setup

objA.lightColor = 'green'
objA.newProp = 'a primitive, like a string'
objA.dancers.push('speedoString')
Object.defineProperty(objA, 'danceFloor', {
	value: 'glowing disco zone',
	writable: false,
	enumerable: false,
	configurable: true
})

// Test

a(objA.lightColor === 'green')

a(objA.newProp === 'a primitive, like a string')

a(objA.dancers.length === 3)

a(objA.dancers[2] === 'speedoString')

a(isEqual({
	value: 'glowing disco zone',
	writable: false,
	enumerable: false,
	configurable: true
}, Object.getOwnPropertyDescriptor(objA, 'danceFloor')))

a(objA.danceFloor === 'glowing disco zone')

// Setup
let fired = 0
let totalHeight = 0
let dancerWatcher = new Watcher(()=>{
	return objA.dancers.reduce((combinedHeight, dancer)=>{
		c('[watcher render] dancer: ', dancer)
		if (dancer.height){
			combinedHeight += dancer.height
		} else {
			return 0
		}
		c(`[watcher render] Combined dancers height so far = ${combinedHeight}`)
		return combinedHeight
	}, 0)
}, (newHeight, oldHeight)=>{
	c('[watcher callback] oldHeight, newHeight', oldHeight, newHeight)
	fired = 1
	totalHeight = newHeight
})

// Test

a(dancerWatcher instanceof Watcher)

// Setup 

objA.dancers.push({
	name: 'Power Muscle',
	strength: 99,
	height: 1
})

// Test

a(fired === 1)

a(totalHeight === 17, totalHeight)

// Setup
// New previously-nonexistent properties

let newPropWorked = null
let bongWatcher = new Watcher(()=>{
	return objA.bong
}, (newBong, oldBong)=>{
	c('[watcher callback] oldBong, newBong', oldBong, newBong)
	newPropWorked = true
})
objA.bong = 'mighty big bongo'

// Test

a(newPropWorked)

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

console.info('[reactiveProxySpec] Test complete')