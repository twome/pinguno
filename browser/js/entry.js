// 3rd-party
import renderjson from '../node_modules/renderjson/renderjson.js'

// In-house
import { config } from './config.js'
import './compatibility.js'
import { d, w, c, ce, ci } from './util.js'
import { PingunoSession } from './pinguno-session.js'
import { registerDOMNodesToCustomEls } from './custom-el-reg.js' 
import { ReactiveProxy, Watcher, ReactiveVm } from './reactive-vm.js'

// Web Components (custom elements)
import { Indicator } from './components/indicator.js'
import { MoreOptionsBtn } from './components/more-options-btn.js'

class PingunoGUI {
	constructor({...options} = {
		renderVmTickIntervalMs: 1000
	}){
		this.opt = {...options}  // Bind constructor options to the instance

		// State
		this.customElClasses = [
			MoreOptionsBtn,
			Indicator
		]

		this.fetchTimer = {}
		this.liveSession = null
		this.liveSessionJSONPollTick = null
		this.renderVmTick = null

		this.vm = {}

		// TEMP dev inprogress
		let w = window
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
				influences: '_STUB'
			}
		})

		objA.lightColor = 'green'
		objA.newProp = 'a primitive, like a string'
		objA.dancers.push({
			name: 'Power Muscle',
			strength: 99
		})
		objA.dancers.push('speedoString')

		Object.defineProperty(objA, 'danceFloor', {
			value: 'glowing disco zone',
			writable: false,
			enumerable: false,
			configurable: true
		})
		
		// w.objA.dancers.push('just a string')
		// c('w.objA.lightColor', w.objA.lightColor )
		// c('w.objA.newProp', w.objA.newProp )
		// c('w.objA.dancers', w.objA.dancers )


		// console.debug('∆∆∆ making watcher')
		// w.dancerWatcher = new Watcher(()=>{
		// 	return w.objA.dancers.reduce((combinedHeight, dancer)=>{
		// 		console.log('[watcher render] dancer: ', dancer)
		// 		if (dancer.height){
		// 			combinedHeight += dancer.height	
		// 		} else {
		// 			return 0
		// 		}
		// 		console.log(`[watcher render] Combined dancers height so far = ${combinedHeight}`)
		// 		return combinedHeight
		// 	}, 0)
		// }, (oldHeight, newHeight)=>{
		// 	console.debug('[watcher callback] oldHeight, newHeight', oldHeight, newHeight)
		// })
		// console.debug('∆∆∆ making big dance fella')
		// w.objB = new ReactiveProxy(Object.assign(w.objA, {
		// 	dancers: [
		// 		{ 
		// 			name: 'BIG DANCE FELLA',
		// 			height: 918
		// 		}
		// 	]
		// }))
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

		console.debug('Final synchronous objA:', objA)
		w.objA = objA
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
	}


	// USER INPUT

	registerInputHandlers(){
		for (let el of d.querySelectorAll('.js-toggle-live-pinging')){
			el.addEventListener('click', e => {
				clearInterval(this.liveSessionJSONPollTick)
			})
		}
	}



	// RENDERING

	simpleJSONRender(parsedObj){
		let jsonOutputEl = document.querySelector('.c-json-output')

		let existing = jsonOutputEl.querySelector('.renderjson')
		if (existing) jsonOutputEl.removeChild(existing)
		jsonOutputEl.appendChild(renderjson(parsedObj))
	}



	// NETWORK

	fetchAndParse(jsonUrl){
		return fetch(jsonUrl).then((res)=>{
			return res.json()
		}, (err)=>{
			return Error(err) // TEMP this should be graceful
		})
	}

	onFetchedSession(session){
		this.fetchTimer.end = new Date()
		if (config.verbose >= 3) console.info(`Session fetch took ${this.fetchTimer.end - this.fetchTimer.start}ms`)
		this.liveSession = new PingunoSession(session)
		
		this.vm.liveSessionLoaded = Object.keys(this.liveSession).length >= 1
		this.vm.lowestUptime = this.liveSession.getLowestUptime()
		this.vm.lowestMeanGoodRTT = this.liveSession.getLowestMeanGoodRTT()
		this.simpleJSONRender(session)
	}

	registerDataPolls(){
		// Fetch static/mock data for use in rendering
		let onLiveSessionJSONPoll = ()=>{
			this.fetchTimer.start = new Date()
			let fetched = this.fetchAndParse('/api/1/live-session')
			fetched.then((session)=>{
				this.onFetchedSession(session)
			}, err => {
				throw Error(err)
			})
		}
		this.liveSessionJSONPollTick = setInterval(onLiveSessionJSONPoll, 2000)
		onLiveSessionJSONPoll()
	}
}

/*
	Kickoff
*/
if (config.verbose >= 3) ci('Running entry.js')

let gui = new PingunoGUI()
gui.registerDataPolls()