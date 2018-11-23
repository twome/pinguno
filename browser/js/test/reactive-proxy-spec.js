// 3rd-party
import isEqual from '../../node_modules/lodash-es/isEqual.js'

// In-house
import { c, ci, cg, cge } from '../util.js'
import { ReactiveProxy, Watcher } from '../reactive-object.js'

// Shortcuts
const a = console.assert

let asyncs = [] // Asynchronous tests go in here

let race = (fn, timeLimit)=>{
	let prom = new Promise((resolve, reject)=>{
		fn(resolve)
		setTimeout(()=>{
			reject(Error(`[race] Provided function didn't complete before time limit.`))
		}, timeLimit)
	})

	return prom
}

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
objA.dancers.push('string instead of object')
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

a(objA.dancers[2] === 'string instead of object')

a(isEqual({
	value: 'glowing disco zone',
	writable: false,
	enumerable: false,
	configurable: true
}, Object.getOwnPropertyDescriptor(objA, 'danceFloor')))

a(objA.danceFloor === 'glowing disco zone')

// Setup

let fired = 0
let dancerWatcher = new Watcher(()=>{
	cg('watcher render')
	console.log(objA.dancers)
	cge()
	return new Promise(resolve => {
		setTimeout(()=>{
			resolve(objA.dancers[0].name)
		}, 600)
	})
}, (newVal, oldVal)=>{
	cg('watcher callback - old, new', oldVal, newVal)
	fired = fired + 1
	c(fired)
	cge()
})

// Test

a(dancerWatcher instanceof Watcher, 'dancerWatcher is a watcher')

// Setup 

objA.dancers.push({
	name: 'Power Muscle',
	strength: 99,
	height: 1
})

objA.dancers.push({
	name: 'Long Folk',
	strength: 34,
	height: 188
})

// Test

asyncs.push(race((resolve)=>{
	a(fired === 1, 'watcher callback fires')
	resolve(fired)
}, 1000 ))

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
	c('asyncs val:', val)
	ci('[reactiveProxySpec] Test complete')
})